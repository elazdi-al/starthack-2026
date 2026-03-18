"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { animate } from "motion"
import { motion, useMotionValue } from "motion/react"
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { triggerHaptic } from "@/lib/haptics"
import { springs } from "@/lib/springs"
import { cn } from "@/lib/utils"

interface SwitchProps {
  checked?: boolean
  className?: string
  defaultChecked?: boolean
  disabled?: boolean
  id?: string
  label?: string
  name?: string
  onToggle?: (checked: boolean) => void
  required?: boolean
  value?: string
}

const TRACK_WIDTH = 34
const TRACK_HEIGHT = 20
const THUMB_SIZE = 16
const THUMB_OFFSET = 2
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2
const PILL_EXTEND = 2
const PRESS_EXTEND = 4
const PRESS_SHRINK = 4
const DRAG_DEAD_ZONE = 2

const Switch = forwardRef<HTMLDivElement, SwitchProps>(
  (
    {
      checked: checkedProp,
      className,
      defaultChecked = false,
      disabled = false,
      id,
      label,
      name,
      onToggle,
      required,
      value,
    },
    ref
  ) => {
    const generatedId = useId()
    const labelId = `${generatedId}-label`
    const isControlled = checkedProp !== undefined

    const [hovered, setHovered] = useState(false)
    const [pressed, setPressed] = useState(false)
    const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked)

    const dragging = useRef(false)
    const didDrag = useRef(false)
    const pointerStart = useRef<{
      clientX: number
      originX: number
    } | null>(null)

    const checked = isControlled ? checkedProp : uncontrolledChecked

    const motionX = useMotionValue(
      checked ? THUMB_OFFSET + THUMB_TRAVEL : THUMB_OFFSET
    )

    const thumbWidth = pressed
      ? THUMB_SIZE + PRESS_EXTEND
      : hovered
        ? THUMB_SIZE + PILL_EXTEND
        : THUMB_SIZE
    const thumbHeight = pressed ? THUMB_SIZE - PRESS_SHRINK : THUMB_SIZE
    const thumbY = pressed ? THUMB_OFFSET + PRESS_SHRINK / 2 : THUMB_OFFSET
    const extraWidth = thumbWidth - THUMB_SIZE
    const thumbX = checked
      ? THUMB_OFFSET + THUMB_TRAVEL - extraWidth
      : THUMB_OFFSET

    useEffect(() => {
      if (dragging.current) {
        return
      }

      animate(motionX, thumbX, springs.moderate)
    }, [motionX, thumbX])

    const commitChecked = useCallback(
      (nextChecked: boolean) => {
        if (nextChecked === checked || (isControlled && !onToggle)) {
          return
        }

        if (!isControlled) {
          setUncontrolledChecked(nextChecked)
        }

        onToggle?.(nextChecked)
        triggerHaptic("selection")
      },
      [checked, isControlled, onToggle]
    )

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (disabled) {
          return
        }

        if (event.pointerType === "mouse" && event.button !== 0) {
          return
        }

        setPressed(true)
        dragging.current = false
        didDrag.current = false
        pointerStart.current = {
          clientX: event.clientX,
          originX: motionX.get(),
        }

        event.currentTarget.setPointerCapture(event.pointerId)
      },
      [disabled, motionX]
    )

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!pointerStart.current) {
          return
        }

        const delta = event.clientX - pointerStart.current.clientX

        if (!dragging.current) {
          if (Math.abs(delta) < DRAG_DEAD_ZONE) {
            return
          }

          dragging.current = true
        }

        const dragMin = THUMB_OFFSET
        const pressedThumbWidth = THUMB_SIZE + PRESS_EXTEND
        const dragMax = TRACK_WIDTH - THUMB_OFFSET - pressedThumbWidth
        const rawX = pointerStart.current.originX + delta

        motionX.set(Math.max(dragMin, Math.min(dragMax, rawX)))
      },
      [motionX]
    )

    const handlePointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!pointerStart.current) {
          return
        }

        setPressed(false)

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        if (dragging.current) {
          didDrag.current = true
          dragging.current = false

          const currentX = motionX.get()
          const dragMin = THUMB_OFFSET
          const pressedThumbWidth = THUMB_SIZE + PRESS_EXTEND
          const dragMax = TRACK_WIDTH - THUMB_OFFSET - pressedThumbWidth
          const midpoint = (dragMin + dragMax) / 2
          const shouldBeOn = currentX > midpoint

          if (shouldBeOn !== checked) {
            commitChecked(shouldBeOn)
          } else {
            const snapTarget = checked
              ? THUMB_OFFSET + THUMB_TRAVEL
              : THUMB_OFFSET

            animate(motionX, snapTarget, springs.moderate)
          }

          requestAnimationFrame(() => {
            didDrag.current = false
          })
        }

        pointerStart.current = null
      },
      [checked, commitChecked, motionX]
    )

    const handlePointerCancel = useCallback(() => {
      setPressed(false)
      dragging.current = false
      didDrag.current = false
      pointerStart.current = null

      const snapTarget = checked ? THUMB_OFFSET + THUMB_TRAVEL : THUMB_OFFSET
      animate(motionX, snapTarget, springs.moderate)
    }, [checked, motionX])

    return (
      <div
        ref={ref}
        className={cn(
          "relative z-10 flex items-center gap-2.5 px-3 py-2 select-none touch-none",
          disabled ? "opacity-50 pointer-events-none" : "cursor-pointer",
          className
        )}
        data-slot="switch"
        onClick={() => {
          if (disabled || didDrag.current) {
            return
          }

          commitChecked(!checked)
        }}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            setHovered(true)
          }
        }}
        onPointerLeave={() => {
          setHovered(false)
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <SwitchPrimitive.Root
          aria-labelledby={label ? labelId : undefined}
          checked={checked}
          className={cn(
            "relative shrink-0 rounded-full outline-none",
            "transition-colors duration-80",
            "focus-visible:ring-1 focus-visible:ring-[#6B97FF] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          data-slot="switch-control"
          disabled={disabled}
          id={id}
          name={name}
          onCheckedChange={(nextChecked) => {
            if (didDrag.current) {
              return
            }

            commitChecked(nextChecked)
          }}
          onClick={(event) => {
            event.stopPropagation()
          }}
          required={required}
          style={{
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            backgroundColor: checked
              ? hovered
                ? "#5C89F2"
                : "#6B97FF"
              : hovered
                ? "color-mix(in oklab, var(--accent), var(--foreground) 10%)"
                : "var(--accent)",
          }}
          value={value}
        >
          <motion.span
            animate={{
              height: thumbHeight,
              width: thumbWidth,
              y: thumbY,
            }}
            className="absolute top-0 left-0 block rounded-full bg-white shadow-sm"
            data-slot="switch-thumb"
            initial={false}
            style={{ x: motionX }}
            transition={springs.moderate}
          />
        </SwitchPrimitive.Root>

        {label ? (
          <span
            className={cn(
              "text-[13px] transition-[color] duration-80",
              checked ? "text-foreground" : "text-muted-foreground"
            )}
            data-slot="switch-label"
            id={labelId}
          >
            {label}
          </span>
        ) : null}
      </div>
    )
  }
)

Switch.displayName = "Switch"

export { Switch }
export type { SwitchProps }
