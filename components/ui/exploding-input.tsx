"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { createRoot, type Root } from "react-dom/client"

import { cn } from "@/lib/utils"

type HorizontalDirection = "left" | "center" | "right"
type VerticalDirection = "top" | "center" | "bottom"

type ExplodingInputProps = Omit<InputPrimitive.Props, "content"> & {
  content?: React.ReactNode[]
  count?: number
  direction?: {
    horizontal?: HorizontalDirection
    vertical?: VerticalDirection
  }
  gravity?: number
  duration?: number
  scale?: {
    value?: number
    randomize?: boolean
    randomVariation?: number
  }
  rotation?: {
    value?: number
    animate?: boolean
  }
  wrapperClassName?: string
  targetRef?: React.RefObject<HTMLInputElement | null>
}

type Particle = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  gravity: number
  birthTime: number
  lifeMs: number
  scale: number
  scaleStart: number
  scaleEnd: number
  rotate: number
  rotateStart: number
  rotateEnd: number
  opacity: number
  element: HTMLDivElement
  root: Root | null
  timeoutId: number
  isDead: boolean
}

const MAX_PARTICLES_PER_INPUT = 5
const MIN_PARTICLE_SCALE = 0.1
const MAX_PARTICLE_SCALE = 4
const DEFAULT_DIRECTION = { horizontal: "center", vertical: "top" } as const
const DEFAULT_SCALE = { value: 1, randomize: false, randomVariation: 0 } as const
const DEFAULT_ROTATION = { value: 0, animate: false } as const

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function mapLinear(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
) {
  if (inMax === inMin) {
    return outMin
  }

  const progress = (value - inMin) / (inMax - inMin)
  return outMin + progress * (outMax - outMin)
}

function createPRNG(seed: number) {
  let state = seed

  return function nextRandom() {
    state |= 0
    state = (state + 1831565813) | 0

    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function removeParticle(particle: Particle) {
  if (particle.isDead) {
    return
  }

  particle.isDead = true
  window.clearTimeout(particle.timeoutId)
  particle.root?.unmount()
  particle.element.remove()
}

function ExplodingInput({
  className,
  wrapperClassName,
  targetRef,
  content = [],
  count = 1,
  direction = DEFAULT_DIRECTION,
  gravity = 0.7,
  duration = 3,
  scale = DEFAULT_SCALE,
  rotation = DEFAULT_ROTATION,
  onInput,
  ...props
}: ExplodingInputProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const particleContainerRef = React.useRef<HTMLDivElement>(null)
  const particlesRef = React.useRef<Particle[]>([])
  const particleIdRef = React.useRef(0)
  const randomRef = React.useRef(() => Math.random())
  const animationFrameRef = React.useRef<number | null>(null)
  const measurementCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const seed = ((Date.now() & 4294967295) ^ Math.floor(Math.random() * 4294967295)) >>> 0
    randomRef.current = createPRNG(seed)

    return () => {
      for (const particle of particlesRef.current) {
        removeParticle(particle)
      }

      particlesRef.current = []

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  React.useEffect(() => {
    let previousTime = performance.now()

    function updateParticles(currentTime: number) {
      const delta = Math.min(32, currentTime - previousTime)
      previousTime = currentTime
      const deltaSeconds = delta / 1000
      const now = performance.now()

      for (const particle of particlesRef.current) {
        if (particle.isDead) {
          continue
        }

        const age = now - particle.birthTime
        if (age >= particle.lifeMs) {
          continue
        }

        const progress = age / particle.lifeMs

        particle.vy += particle.gravity * deltaSeconds
        particle.x += particle.vx * deltaSeconds
        particle.y += particle.vy * deltaSeconds
        particle.scale = mapLinear(progress, 0, 1, particle.scaleStart, particle.scaleEnd)
        particle.rotate = mapLinear(progress, 0, 1, particle.rotateStart, particle.rotateEnd)
        particle.opacity =
          progress > 0.7 ? mapLinear(progress, 0.7, 1, 1, 0) : 1

        const clampedScale = clamp(particle.scale, MIN_PARTICLE_SCALE, 3)

        particle.element.style.transform = `translate(${particle.x}px, ${particle.y}px) translate(-50%, -50%) scale(${clampedScale}) rotate(${particle.rotate}deg)`
        particle.element.style.opacity = String(particle.opacity)
      }

      animationFrameRef.current = requestAnimationFrame(updateParticles)
    }

    animationFrameRef.current = requestAnimationFrame(updateParticles)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const getTextWidth = React.useCallback((input: HTMLInputElement, text: string) => {
    if (!measurementCanvasRef.current) {
      measurementCanvasRef.current = document.createElement("canvas")
    }

    const context = measurementCanvasRef.current.getContext("2d")
    if (!context) {
      return 0
    }

    const styles = window.getComputedStyle(input)
    context.font =
      styles.font ||
      `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`

    const letterSpacing = Number.parseFloat(styles.letterSpacing)
    const extraLetterSpacing = Number.isNaN(letterSpacing)
      ? 0
      : Math.max(text.length - 1, 0) * letterSpacing

    return context.measureText(text).width + extraLetterSpacing
  }, [])

  const getSpawnPosition = React.useCallback((input: HTMLInputElement) => {
    const container = containerRef.current
    if (!container) {
      return null
    }

    const inputRect = input.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const styles = window.getComputedStyle(input)
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0
    const textAlign = styles.textAlign
    const caretIndex =
      typeof input.selectionStart === "number" ? input.selectionStart : input.value.length
    const textBeforeCaret = input.value.slice(0, caretIndex)
    const textWidth = getTextWidth(input, textBeforeCaret)
    const contentWidth = inputRect.width - paddingLeft - paddingRight
    const inputStartX = inputRect.left - containerRect.left
    let textOriginX = inputStartX + paddingLeft

    if (textAlign === "center") {
      textOriginX += Math.max((contentWidth - textWidth) / 2, 0)
    }

    if (textAlign === "right" || textAlign === "end") {
      textOriginX += Math.max(contentWidth - textWidth, 0)
    }

    const minX = inputStartX + paddingLeft
    const maxX = inputStartX + inputRect.width - paddingRight
    const x =
      textBeforeCaret.length > 0
        ? clamp(textOriginX + textWidth - input.scrollLeft, minX, maxX)
        : minX
    const y = inputRect.top - containerRect.top + inputRect.height / 2

    return { x, y }
  }, [getTextWidth])

  const spawnParticlesAtPosition = React.useCallback((x: number, y: number) => {
    const particleContainer = particleContainerRef.current
    if (!particleContainer) {
      return
    }

    const particlesToSpawn = clamp(Math.round(count), 1, MAX_PARTICLES_PER_INPUT)

    for (let index = 0; index < particlesToSpawn; index += 1) {
      const horizontalValue =
        direction.horizontal === "left"
          ? -0.4
          : direction.horizontal === "right"
            ? 0.4
            : 0
      const verticalValue =
        direction.vertical === "top"
          ? -0.7
          : direction.vertical === "bottom"
            ? 0.7
            : 0
      const velocityX = mapLinear(horizontalValue, -1, 1, -800, 800) + (randomRef.current() * 2 - 1) * 300
      const velocityY = mapLinear(verticalValue, -1, 1, -800, 800) + (randomRef.current() * 2 - 1) * 300
      const baseScale = scale.value ?? 1
      const randomVariation = scale.randomVariation ?? 0
      const scaleVariation =
        scale.randomize && randomVariation > 0
          ? baseScale * (randomVariation / 100)
          : 0
      const particleScale = clamp(
        baseScale + (randomRef.current() * 2 - 1) * scaleVariation,
        MIN_PARTICLE_SCALE,
        MAX_PARTICLE_SCALE
      )
      const baseRotation = rotation.value ?? 0
      const startRotation = rotation.animate ? (randomRef.current() * 2 - 1) * 180 : baseRotation
      const endRotation =
        rotation.animate
          ? startRotation + (randomRef.current() * 2 - 1) * 360
          : baseRotation

      const element = document.createElement("div")
      element.style.position = "absolute"
      element.style.left = "0"
      element.style.top = "0"
      element.style.display = "flex"
      element.style.alignItems = "center"
      element.style.justifyContent = "center"
      element.style.pointerEvents = "none"
      element.style.willChange = "transform, opacity"
      element.style.transformOrigin = "50% 50%"
      element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${particleScale}) rotate(${startRotation}deg)`
      element.style.opacity = "1"

      particleContainer.appendChild(element)

      particleIdRef.current += 1

      let root: Root | null = null

      if (content.length > 0) {
        const particleContent = content[(particleIdRef.current - 1) % content.length]

        if (particleContent !== undefined) {
          root = createRoot(element)
          root.render(<>{particleContent}</>)
        }
      } else {
        const fallback = document.createElement("div")
        fallback.style.width = "0.375rem"
        fallback.style.height = "0.375rem"
        fallback.style.borderRadius = "9999px"
        fallback.style.backgroundColor = "var(--icon-accent-blue)"
        fallback.style.boxShadow = "0 0 18px rgba(10, 132, 255, 0.28)"
        element.appendChild(fallback)
      }

      const particle: Particle = {
        id: particleIdRef.current,
        x,
        y,
        vx: velocityX,
        vy: velocityY,
        gravity: mapLinear(clamp(gravity, -1, 1), -1, 1, -2000, 2000),
        birthTime: performance.now(),
        lifeMs: duration * 1000,
        scale: particleScale,
        scaleStart: particleScale,
        scaleEnd: particleScale,
        rotate: startRotation,
        rotateStart: startRotation,
        rotateEnd: endRotation,
        opacity: 1,
        element,
        root,
        timeoutId: 0,
        isDead: false,
      }

      particle.timeoutId = window.setTimeout(() => {
        removeParticle(particle)
        particlesRef.current = particlesRef.current.filter(({ id }) => id !== particle.id)
      }, duration * 1000)

      particlesRef.current.push(particle)
    }
  }, [content, count, direction.horizontal, direction.vertical, duration, gravity, rotation.animate, rotation.value, scale.randomVariation, scale.randomize, scale.value])

  React.useEffect(() => {
    if (!targetRef?.current) {
      return
    }

    const input = targetRef.current

    const handleExternalInput = (event: Event) => {
      if (prefersReducedMotion) {
        return
      }

      const spawnPosition = getSpawnPosition(event.currentTarget as HTMLInputElement)

      if (spawnPosition) {
        spawnParticlesAtPosition(spawnPosition.x, spawnPosition.y)
      }
    }

    input.addEventListener("input", handleExternalInput)

    return () => {
      input.removeEventListener("input", handleExternalInput)
    }
  }, [getSpawnPosition, prefersReducedMotion, spawnParticlesAtPosition, targetRef])

  const handleInput: NonNullable<InputPrimitive.Props["onInput"]> = (event) => {
    onInput?.(event)

    if (targetRef || event.defaultPrevented || prefersReducedMotion) {
      return
    }

    const input = event.currentTarget as HTMLInputElement
    const spawnPosition = getSpawnPosition(input)

    if (spawnPosition) {
      spawnParticlesAtPosition(spawnPosition.x, spawnPosition.y)
    }
  }

  if (targetRef) {
    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        data-slot="exploding-input-wrapper"
        className={cn(
          "pointer-events-none absolute inset-0 overflow-visible",
          wrapperClassName
        )}
      >
        <div
          ref={particleContainerRef}
          aria-hidden="true"
          data-slot="exploding-input-particles"
          className="pointer-events-none absolute inset-0 overflow-visible"
        />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-slot="exploding-input-wrapper"
      className={cn("relative w-full overflow-visible", wrapperClassName)}
    >
      <InputPrimitive
        data-slot="exploding-input"
        className={cn(
          "type-body h-10 w-full min-w-0 rounded-none border-0 border-b border-input bg-transparent px-0 pb-2 pt-0 text-[var(--dial-text-primary)] transition-[border-color,color,opacity] outline-none placeholder:text-[var(--dial-text-label)] focus-visible:border-[var(--input-hover)] focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-[var(--destructive)]",
          className
        )}
        onInput={handleInput}
        {...props}
      />
      <div
        ref={particleContainerRef}
        aria-hidden="true"
        data-slot="exploding-input-particles"
        className="pointer-events-none absolute inset-0 overflow-visible"
      />
    </div>
  )
}

export { ExplodingInput }
export type { ExplodingInputProps }
