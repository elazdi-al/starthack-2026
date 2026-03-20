"use client";

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useIsVisible } from "@/lib/use-is-visible";
import { cn } from "@/lib/utils";

const OUTER_SIZE_RATIO = 72 / 64;
const DEFAULT_COLORS = ["#DBDCE0", "#ffffff"] as const;
const PERLIN_NOISE_URL = "https://elevenlabs.io/assets/images/convai/perlin-noise.png";
const NOISE_PNG_URL =
  "https://eleven-public-cdn.elevenlabs.io/marketing_website/_next/static/media/noise.24b8225d.png";
const NOISE_AVIF_URL =
  "https://eleven-public-cdn.elevenlabs.io/marketing_website/_next/static/media/noise@20aq.289c1f1d.avif";
const AGENTS_ORB_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAA00lEQVR42gHIADf/Af788OwBDv4BAP8AAPz+APv7/+Xu+wYEBAHf9v7q9/4GBAMIBQADAQAFAPj6+O/8/QsBksLN5fUQ/P3+DAT1DgLuCvvfBP/zHx84AWCfrfL6FO/kzQH01wD03QD++PwGHBseNAGw2erZ5PDGwqX04cUA+/v7/gX3+wMJChABwuf3BP7vubul5NzP6urt7O33x9fCRUBwAYKlsCce+//83Nfb1t3j+NHU4RQGGkpPXAGwwcHa3MkiKRsDBg33+Qnf2t8UCw0nJiufFm95mfw9JgAAAABJRU5ErkJggg==";

/**
 * Fragment shader matching the ElevenLabs ConvAI widget exactly.
 * All animation is driven purely by uTime (elapsed seconds).
 * No volume uniforms - volume response is handled via CSS transforms.
 */
const ORB_FRAGMENT_SHADER = `#define GLSLIFY 1
uniform float uTime;
uniform float uOffsets[7];
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform sampler2D uPerlinTexture;
varying vec2 vUv;

const float PI = 3.14159265358979323846;

bool drawOval(vec2 polarUv, vec2 polarCenter, float a, float b, bool reverseGradient, float softness, out vec4 color) {
  vec2 p = polarUv - polarCenter;
  float oval = (p.x * p.x) / (a * a) + (p.y * p.y) / (b * b);

  float edge = smoothstep(1.0, 1.0 - softness, oval);

  if (edge > 0.0) {
    float gradient = reverseGradient ? 1.0 - (p.x / a + 1.0) / 2.0 : (p.x / a + 1.0) / 2.0;
    color = vec4(vec3(gradient), 0.8 * edge);
    return true;
  }
  return false;
}

vec3 colorRamp(float grayscale, vec3 color1, vec3 color2, vec3 color3, vec3 color4) {
  if (grayscale < 0.33) {
    return mix(color1, color2, grayscale * 3.0);
  } else if (grayscale < 0.66) {
    return mix(color2, color3, (grayscale - 0.33) * 3.0);
  } else {
    return mix(color3, color4, (grayscale - 0.66) * 3.0);
  }
}

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  vec2 u = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)), dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );

  return 0.5 + 0.5 * n;
}

float sharpRing(vec2 uv, float theta, float time) {
  float ringStart = 1.0;
  float ringWidth = 0.5;
  float noiseScale = 5.0;

  vec2 noiseCoord = vec2(theta / (2.0 * PI), time * 0.1);
  noiseCoord *= noiseScale;

  float noise = noise2D(noiseCoord);
  noise = (noise - 0.5) * 4.0;

  return ringStart + noise * ringWidth * 1.5;
}

float smoothRing(vec2 uv, float time) {
  float angle = atan(uv.y, uv.x);
  if (angle < 0.0) angle += 2.0 * PI;

  vec2 noiseCoord = vec2(angle / (2.0 * PI), time * 0.1);
  noiseCoord *= 6.0;

  float noise = noise2D(noiseCoord);
  noise = (noise - 0.5) * 8.0;

  float ringStart = 0.9;
  float ringWidth = 0.3;

  return ringStart + noise * ringWidth;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float radius = length(uv);
  float theta = atan(uv.y, uv.x);
  if (theta < 0.0) theta += 2.0 * PI;

  vec4 color = vec4(1.0, 1.0, 1.0, 1.0);

  float originalCenters[7] = float[7](0.0, 0.5 * PI, 1.0 * PI, 1.5 * PI, 2.0 * PI, 2.5 * PI, 3.0 * PI);

  float centers[7];
  for (int i = 0; i < 7; i++) {
    centers[i] = originalCenters[i] + 0.5 * sin(uTime / 20.0 + uOffsets[i]);
  }

  float a, b;
  vec4 ovalColor;

  for (int i = 0; i < 7; i++) {
    float noise = texture(uPerlinTexture, vec2(mod(centers[i] + uTime * 0.05, 1.0), 0.5)).r;
    a = noise * 1.5;
    b = noise * 4.5;
    bool reverseGradient = i % 2 == 1;

    float distTheta = abs(theta - centers[i]);
    if (distTheta > PI) distTheta = 2.0 * PI - distTheta;
    float distRadius = radius;

    float softness = 0.4;

    if (drawOval(vec2(distTheta, distRadius), vec2(0.0, 0.0), a, b, reverseGradient, softness, ovalColor)) {
      color.rgb = mix(color.rgb, ovalColor.rgb, ovalColor.a);
      color.a = max(color.a, ovalColor.a);
    }
  }

  float ringRadius1 = sharpRing(uv, theta, uTime);
  float ringRadius2 = smoothRing(uv, uTime);

  float ringAlpha1 = radius >= ringRadius1 ? 0.3 : 0.0;
  float ringAlpha2 = smoothstep(ringRadius2 - 0.05, ringRadius2 + 0.05, radius) * 0.25;

  float totalRingAlpha = max(ringAlpha1, ringAlpha2);

  vec3 ringColor = vec3(1.0);
  color.rgb = 1.0 - (1.0 - color.rgb) * (1.0 - ringColor * totalRingAlpha);

  vec3 color1 = vec3(0.0, 0.0, 0.0);
  vec3 color2 = uColor1;
  vec3 color3 = uColor2;
  vec3 color4 = vec3(1.0, 1.0, 1.0);

  float luminance = color.r;
  color.rgb = colorRamp(luminance, color1, color2, color3, color4);

  gl_FragColor = color;
}
`;

const ORB_VERTEX_SHADER = `#define GLSLIFY 1
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

type VolumeReader = () => number;

type OrbUniforms = {
  uColor1: { value: THREE.Color };
  uColor2: { value: THREE.Color };
  uOffsets: { value: Float32Array<ArrayBufferLike> };
  uPerlinTexture: { value: THREE.Texture };
  uTime: { value: number };
};

/** Convert sRGB color to linear space (gamma 2.2) matching the ElevenLabs widget. */
function toLinear(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  return new THREE.Color(c.r ** 2.2, c.g ** 2.2, c.b ** 2.2);
}

function NoiseOverlay({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("absolute inset-0 mix-blend-overlay", className)}
      style={{
        "--noise-png": `url(${NOISE_PNG_URL})`,
        imageRendering: "pixelated",
        backgroundImage: `image-set(url(${NOISE_AVIF_URL}) type('image/avif'), var(--noise-png) type('image/png'))`,
        backgroundSize: "256px",
        ...style,
      } as React.CSSProperties}
    />
  );
}

function BlurredPlaceholder({
  src,
  blur = 8,
  className,
}: {
  src: string;
  blur?: number;
  className?: string;
}) {
  const filterId = React.useId().replace(/:/g, "");

  return (
    <svg aria-hidden="true" className={className}>
      <filter id={filterId} colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={blur} />
        <feColorMatrix
          values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1"
          result="s"
        />
        <feFlood x="0" y="0" width="100%" height="100%" />
        <feComposite operator="out" in="s" />
        <feComposite in2="SourceGraphic" />
        <feGaussianBlur stdDeviation={blur} />
      </filter>
      <image
        width="100%"
        height="100%"
        href={src}
        preserveAspectRatio="xMidYMid slice"
        style={{ filter: `url(#${filterId})` }}
      />
    </svg>
  );
}

/**
 * Three.js mesh that renders the orb shader.
 * Matches the ElevenLabs widget: only uTime drives animation.
 */
function OrbMesh({
  colors,
}: {
  colors: readonly [string, string];
}) {
  const meshRef = React.useRef<THREE.Mesh>(null);
  const color1Ref = React.useRef(toLinear(colors[0]));
  const color2Ref = React.useRef(toLinear(colors[1]));
  const startTimeRef = React.useRef(performance.now());
  const uniformsRef = React.useRef<OrbUniforms | null>(null);
  const [perlinTexture, setPerlinTexture] = React.useState<THREE.Texture | null>(
    null,
  );
  const [offsets, setOffsets] = React.useState<Float32Array<ArrayBufferLike> | null>(
    null,
  );

  React.useEffect(() => {
    setOffsets(
      Float32Array.from({ length: 7 }, () => Math.random() * Math.PI * 2),
    );
  }, []);

  React.useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      PERLIN_NOISE_URL,
      (texture: THREE.Texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        setPerlinTexture(texture);
      },
      undefined,
      (error: unknown) => {
        console.error("[CallOverlay] Failed to load ElevenLabs orb noise texture", error);
      },
    );
  }, []);

  React.useEffect(() => {
    color1Ref.current = toLinear(colors[0]);
    color2Ref.current = toLinear(colors[1]);
  }, [colors]);

  const uniforms = React.useMemo<OrbUniforms | null>(() => {
    if (!offsets || !perlinTexture) {
      return null;
    }

    return {
      uColor1: { value: toLinear(colors[0]) },
      uColor2: { value: toLinear(colors[1]) },
      uOffsets: { value: offsets },
      uPerlinTexture: { value: perlinTexture },
      uTime: { value: 0 },
    };
  }, [colors, offsets, perlinTexture]);

  React.useEffect(() => {
    uniformsRef.current = uniforms;
  }, [uniforms]);

  useFrame(() => {
    const activeUniforms = uniformsRef.current;

    if (!meshRef.current || !activeUniforms) {
      return;
    }

    // Elapsed seconds since mount, matching the ElevenLabs widget render loop
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    activeUniforms.uTime.value = elapsed;

    // Smooth color transitions when props change
    activeUniforms.uColor1.value.lerp(color1Ref.current, 0.05);
    activeUniforms.uColor2.value.lerp(color2Ref.current, 0.05);
  });

  if (!uniforms) {
    return null;
  }

  return (
    <mesh ref={meshRef}>
      <circleGeometry args={[4, 64]} />
      <shaderMaterial
        attach="material"
        fragmentShader={ORB_FRAGMENT_SHADER}
        uniforms={uniforms}
        vertexShader={ORB_VERTEX_SHADER}
      />
    </mesh>
  );
}

function OrbCanvas({
  colors = DEFAULT_COLORS,
}: {
  colors?: readonly [string, string];
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Canvas
      className={cn(
        "absolute inset-0 transition-opacity duration-1000 ease-in-out",
        mounted ? "opacity-100" : "opacity-0",
      )}
      dpr={[1, 2]}
      frameloop="always"
      gl={{ powerPreference: "high-performance" }}
    >
      <OrbMesh colors={colors} />
    </Canvas>
  );
}

function OrbLayer() {
  const layerRef = React.useRef<HTMLDivElement>(null);
  const isVisible = useIsVisible(layerRef);

  return (
    <div ref={layerRef} className="absolute inset-0">
      <BlurredPlaceholder
        blur={8}
        className="absolute inset-0 size-full"
        src={AGENTS_ORB_PLACEHOLDER}
      />

      {isVisible ? (
        <div className="absolute inset-0">
          <OrbCanvas />
        </div>
      ) : null}

      <div className="absolute inset-0 mix-blend-overlay">
        <NoiseOverlay className="absolute inset-0 mix-blend-overlay" style={{ opacity: 0.5 }} />
      </div>
    </div>
  );
}

export function ElevenLabsHomeOrb({
  className,
  displaySize = 256,
  getInputVolume,
  getOutputVolume,
}: {
  className?: string;
  displaySize?: number;
  getInputVolume?: VolumeReader;
  getOutputVolume?: VolumeReader;
}) {
  const outerWidth = displaySize * OUTER_SIZE_RATIO;
  const orbRef = React.useRef<HTMLDivElement>(null);
  const bgRef = React.useRef<HTMLDivElement>(null);

  // CSS-based volume animation matching the ElevenLabs widget (function Mh):
  // - avatarBackground scales UP with output volume when AI is speaking
  // - avatarImage scales DOWN with input volume when user is speaking
  // - No volume data goes to the shader; all volume response is CSS transforms
  React.useEffect(() => {
    if (!getInputVolume && !getOutputVolume) return;

    let rafId: number;

    function animate() {
      const inputVol = getInputVolume?.() ?? 0;
      const outputVol = getOutputVolume?.() ?? 0;
      const isSpeaking = outputVol > 0.01;

      if (orbRef.current) {
        const imageScale = isSpeaking ? 1 : 1 - inputVol * 0.6;
        orbRef.current.style.transform = `scale(${imageScale})`;
      }

      if (bgRef.current) {
        const bgScale = isSpeaking ? 1 + outputVol * 0.6 : 1;
        bgRef.current.style.transform = `scale(${bgScale})`;
      }

      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [getInputVolume, getOutputVolume]);

  return (
    <div
      className={cn("relative isolate max-w-full", className)}
      style={{ width: outerWidth, height: displaySize }}
    >
      {/* Background layer - scales up with output volume (avatarBackground) */}
      <div
        ref={bgRef}
        className="absolute inset-0 z-10 pointer-events-none"
      >
        <div
          className="relative mx-auto max-w-full aspect-square"
          style={{ width: displaySize }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <OrbLayer />
          </div>
        </div>
      </div>

      {/* Orb image layer - scales down with input volume (avatarImage) */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div
          className="relative mx-auto max-w-full aspect-square transition duration-[400ms] ease-in-out origin-top"
          style={{ width: displaySize }}
        >
          <div
            ref={orbRef}
            className="absolute inset-0 overflow-hidden rounded-full origin-top sm:origin-center"
          >
            <div className="absolute left-0 top-0 aspect-square w-full overflow-hidden rounded-full">
              <OrbLayer />
              <div className="absolute inset-0 rounded-full ring-[0.5px] ring-inset ring-black/[0.075]" />
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative z-30 mx-auto aspect-square max-w-full"
        style={{ width: displaySize }}
      >
        <div
          className="absolute -bottom-12 -left-3 -right-3 -top-12 flex flex-col-reverse py-5 sm:-left-12 sm:-right-12"
          style={{
            maskImage:
              "linear-gradient(transparent, white 3rem, white calc(100% - 5rem), transparent calc(100% - 2rem))",
          }}
        >
          <div className="mt-auto flex flex-col gap-4" />
        </div>
      </div>
    </div>
  );
}
