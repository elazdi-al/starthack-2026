"use client";
/* eslint-disable @next/next/no-img-element -- sprites need plain <img> inside CSS-transformed layers */

import { type CSSProperties, type ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion } from "motion/react";
import { X, Crosshair } from "@phosphor-icons/react";
import { AnimatedParameterValue } from "@/components/ui/animated-parameter-value";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useGreenhouseStore,
  CROP_DB,
  type CropInfo,
  type CropType,
  type TileData,
} from "@/lib/greenhouse-store";
import { CropVideoPreview } from "@/components/interface/crop-video-preview";
import { useAnimationConfig } from "@/lib/use-animation-config";
import {
  INTERIOR_SPRITES,
  SHELL_SPRITES,
  SITE_PROPS,
  TERRAIN_SPRITES,
  type InteriorSprite,
  type ShellPanel,
  type SiteSprite,
} from "@/lib/greenhouse-sprites";

const TILE = 80;
const GAP = 3;
const COLS = 12;
const ROWS = 9;
const GREENHOUSE_EJECT_EASE = [0.42, 0, 1, 1] as const;
const GREENHOUSE_PANEL_TRANSITIONS = {
  north: { duration: 2.0, ease: GREENHOUSE_EJECT_EASE },
  west: { duration: 2.0, ease: GREENHOUSE_EJECT_EASE, delay: 0.02 },
  roof: { duration: 2.0, ease: GREENHOUSE_EJECT_EASE, delay: 0.02 },
  east: { duration: 2.0, ease: GREENHOUSE_EJECT_EASE, delay: 0.01 },
  south: { duration: 2.0, ease: GREENHOUSE_EJECT_EASE, delay: 0.01 },
} as const;

export type GreenhouseIntroStage = "sealed" | "opening" | "open";

interface CropHoverMeta {
  label: string;
  detail: string;
  summary: string;
}

const CROP_HOVER_META: Record<CropType, CropHoverMeta> = {
  lettuce: {
    label: "Leaf crop",
    detail: "Fast cycle",
    summary: "Compact leafy canopy for quick harvest turnover.",
  },
  tomato: {
    label: "Fruit crop",
    detail: "Warm zone",
    summary: "Dense vine structure with steady flowering and fruit set.",
  },
  potato: {
    label: "Root crop",
    detail: "Dense tuber bed",
    summary: "Low canopy root crop with heavier water demand through growth.",
  },
  soybean: {
    label: "Protein crop",
    detail: "Mid cycle",
    summary: "Dense foliage with compact pods and strong protein yield.",
  },
  spinach: {
    label: "Leaf crop",
    detail: "Cool zone",
    summary: "Short leafy growth with dense, low-profile coverage.",
  },
  wheat: {
    label: "Grain crop",
    detail: "Tall stand",
    summary: "Vertical stalk structure with an even, high-density canopy.",
  },
  radish: {
    label: "Root crop",
    detail: "Rapid cycle",
    summary: "Fast-growing root bed with a small leafy canopy above grade.",
  },
  kale: {
    label: "Leaf crop",
    detail: "Hardy bed",
    summary: "Broad leaf mass with steady, nutrient-dense growth.",
  },
};

const GROWTH_LABEL: Record<number, string> = {
  0: "Seed",
  1: "Germination",
  2: "Vegetative",
  3: "Flowering",
  4: "Fruiting",
  5: "Harvest ready",
};

/** Growth 0-2 shows the seedling sprite, 3-5 the mature plant. */
function cropSpriteStage(growth?: number): "young" | "mature" {
  return growth !== undefined && growth <= 2 ? "young" : "mature";
}

/** Pre-rendered 3D crop sprite (see lib/greenhouse-sprites.ts for how sprites are made). */
const CropPreview = memo(function CropPreview({
  crop,
  className,
  size,
  growth,
}: {
  crop: CropType;
  className?: string;
  size?: number;
  growth?: number;
}) {
  return (
    <img
      src={`/images/greenhouse/crops/${crop}-${cropSpriteStage(growth)}.webp`}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      className={className ? `crop-preview-svg ${className}` : "crop-preview-svg"}
      style={size ? { width: size, height: size } : undefined}
    />
  );
});

const CropTooltip = memo(function CropTooltip({
  data,
  info,
}: {
  data: TileData;
  info: CropInfo;
}) {
  const env = useGreenhouseStore((s) => s.environment);
  const tileCrop = data.tileId ? env.tileCrops?.[data.tileId] : undefined;
  const cropEnv = data.crop ? (tileCrop || env.crops[data.crop]) : null;

  if (!data.crop) return null;

  const healthPct = cropEnv ? Math.round(cropEnv.healthScore * 100) : null;
  const moisturePct = cropEnv ? Math.round(cropEnv.soilMoisture) : data.water;
  const diseasePct = cropEnv ? Math.round(cropEnv.diseaseRisk * 100) : null;

  return (
    <div className="crop-tooltip-card">
      <div className="crop-tooltip-top">
        <div className="crop-tooltip-model">
          <CropPreview crop={data.crop} growth={data.growth} />
        </div>
        <div className="crop-tooltip-copy">
          <div className="crop-tooltip-heading">
            <p className="type-label crop-tooltip-title">{info.name}</p>
            <p className="type-caption crop-tooltip-meta">
              {GROWTH_LABEL[data.growth]}{cropEnv ? ` · ${Math.round(cropEnv.daysSincePlanting)} sols` : ""}
            </p>
          </div>
          {healthPct !== null && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/6 dark:bg-white/8">
                <div
                  className={`h-full rounded-full ${
                    healthPct > 70
                      ? "bg-green-700/50 dark:bg-green-400/55"
                      : healthPct > 40
                        ? "bg-amber-500/60 dark:bg-amber-400/65"
                        : "bg-red-500/60 dark:bg-red-400/65"
                  }`}
                  style={{ width: `${healthPct}%` }}
                />
              </div>
              <span className="type-small font-mono tabular-nums text-black/50 dark:text-white/55">
                {healthPct}%
              </span>
            </div>
          )}
        </div>
      </div>
      <dl className="crop-tooltip-stats">
        <div className="crop-tooltip-stat">
          <dt className="type-caption crop-tooltip-stat-label">Moisture</dt>
          <dd className="type-label crop-tooltip-stat-value">{moisturePct}%</dd>
        </div>
        <div className="crop-tooltip-stat">
          <dt className="type-caption crop-tooltip-stat-label">Yield</dt>
          <dd className="type-label crop-tooltip-stat-value">
            {cropEnv ? `${cropEnv.estimatedYieldKg.toFixed(1)} kg` : "—"}
          </dd>
        </div>
        <div className="crop-tooltip-stat">
          <dt className="type-caption crop-tooltip-stat-label">Disease</dt>
          <dd className="type-label crop-tooltip-stat-value">
            {diseasePct !== null ? (
              <span className={diseasePct > 30 ? "text-red-600 dark:text-red-400" : ""}>
                {diseasePct}%
              </span>
            ) : "—"}
          </dd>
        </div>
        <div className="crop-tooltip-stat">
          <dt className="type-caption crop-tooltip-stat-label">Status</dt>
          <dd className="type-label crop-tooltip-stat-value">
            {cropEnv?.isBolting
              ? "Bolting"
              : data.status === "warn"
                ? "Attention"
                : "Healthy"}
          </dd>
        </div>
      </dl>
    </div>
  );
});

export function MarsBackdrop({ dustStormActive }: { dustStormActive: boolean }) {
  const baseGlow = dustStormActive ? 0.26 : 0.18;
  const accentGlow = dustStormActive ? 0.2 : 0.14;
  const dustSweep = dustStormActive ? 0.12 : 0.08;

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: [
            `radial-gradient(circle at 52% 52%, rgb(var(--mars-glow-main) / ${baseGlow}) 0%, rgb(var(--mars-glow-main) / ${baseGlow * 0.42}) 18%, rgb(var(--mars-glow-main) / 0) 42%)`,
            `radial-gradient(circle at 14% 78%, rgb(var(--mars-accent-a) / ${accentGlow}) 0%, rgb(var(--mars-accent-a) / 0) 30%)`,
            `radial-gradient(circle at 86% 22%, rgb(var(--mars-accent-b) / ${accentGlow}) 0%, rgb(var(--mars-accent-b) / 0) 28%)`,
            `radial-gradient(circle at 76% 84%, rgb(var(--mars-accent-c) / ${accentGlow * 0.95}) 0%, rgb(var(--mars-accent-c) / 0) 26%)`,
            "linear-gradient(180deg, rgb(var(--mars-bg-top)) 0%, rgb(var(--mars-bg-mid)) 42%, rgb(var(--mars-bg-bottom)) 100%)",
          ].join(", "),
        }}
      />

      <div
        className="absolute inset-[-12%] rotate-[-18deg]"
        style={{
          background: `repeating-linear-gradient(90deg, rgb(var(--mars-band) / ${dustSweep}) 0 2px, rgb(var(--mars-band) / 0) 2px 38px)`,
          opacity: 0.95,
          filter: "blur(22px)",
        }}
      />
      <div
        className="absolute inset-[-10%] rotate-[22deg]"
        style={{
          background: "repeating-linear-gradient(90deg, rgb(var(--mars-band-soft) / 0.09) 0 1px, rgb(var(--mars-band-soft) / 0) 1px 48px)",
          filter: "blur(26px)",
        }}
      />
      <div
        className="absolute left-[-6%] top-[10%] h-[34vmin] w-[54vmin] rounded-full blur-[100px]"
        style={{
          background: "radial-gradient(circle, rgb(var(--mars-glow-soft) / 0.38) 0%, rgb(var(--mars-glow-soft) / 0) 74%)",
        }}
      />
      <div
        className="absolute right-[-4%] top-[18%] h-[34vmin] w-[52vmin] rounded-full blur-[100px]"
        style={{
          background: "radial-gradient(circle, rgb(var(--mars-accent-b) / 0.22) 0%, rgb(var(--mars-accent-b) / 0) 72%)",
        }}
      />
      <div
        className="absolute left-[10%] bottom-[-6%] h-[30vmin] w-[58vmin] rounded-full blur-[110px]"
        style={{
          background: "radial-gradient(circle, rgb(var(--mars-accent-c) / 0.22) 0%, rgb(var(--mars-accent-c) / 0) 76%)",
        }}
      />
      <div
        className="absolute left-[26%] top-[16%] h-[22vmin] w-[52vmin] rotate-[8deg] rounded-full blur-[42px]"
        style={{
          background: "linear-gradient(90deg, rgb(var(--mars-band-soft) / 0) 0%, rgb(var(--mars-band-soft) / 0.16) 48%, rgb(var(--mars-band-soft) / 0) 100%)",
        }}
      />
      <div
        className="absolute left-[18%] top-[58%] h-[18vmin] w-[56vmin] rotate-[-7deg] rounded-full blur-[36px]"
        style={{
          background: "linear-gradient(90deg, rgb(var(--mars-band) / 0) 0%, rgb(var(--mars-band) / 0.16) 50%, rgb(var(--mars-band) / 0) 100%)",
        }}
      />
      <div
        className="absolute left-[14%] top-[22%] h-[1px] w-[18px] rotate-[-20deg] rounded-full"
        style={{
          background: "rgb(var(--mars-scratch) / 0.22)",
          boxShadow: "0 0 18px rgb(var(--mars-scratch) / 0.16)",
        }}
      />
      <div
        className="absolute right-[13%] top-[25%] h-[1px] w-[20px] rotate-[-18deg] rounded-full"
        style={{
          background: "rgb(var(--mars-scratch) / 0.2)",
          boxShadow: "0 0 18px rgb(var(--mars-scratch) / 0.14)",
        }}
      />
      <div
        className="absolute right-[16%] bottom-[18%] h-[1px] w-[16px] rotate-[-16deg] rounded-full"
        style={{
          background: "rgb(var(--mars-scratch) / 0.18)",
          boxShadow: "0 0 16px rgb(var(--mars-scratch) / 0.12)",
        }}
      />
    </div>
  );
}

/** Projects a grid-plane offset (CSS px, before the iso transform) into screen space. */
function planeToScreen(x: number, y: number) {
  return { x: 0.7071 * (x + y), y: 0.54 * 0.7071 * (y - x) };
}

function SpriteImg({ sprite, className }: { sprite: SiteSprite; className?: string }) {
  return (
    <img
      src={sprite.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      className={`absolute max-w-none select-none ${className ?? ""}`}
      style={{ left: sprite.left, top: sprite.top, width: sprite.width, height: sprite.height }}
    />
  );
}

/** Mars terrain + base props, anchored to the greenhouse centre beneath the crop grid. */
const MarsSite = memo(function MarsSite({ dustStormActive }: { dustStormActive: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {/* display:none keeps the inactive theme's terrain from being decoded */}
      <div className="dark:hidden">
        <SpriteImg sprite={TERRAIN_SPRITES.light.far} />
        <SpriteImg sprite={TERRAIN_SPRITES.light.near} />
      </div>
      <div className="hidden dark:block">
        <SpriteImg sprite={TERRAIN_SPRITES.dark.far} />
        <SpriteImg sprite={TERRAIN_SPRITES.dark.near} />
      </div>
      {SITE_PROPS.map((sprite) => (
        <SpriteImg key={sprite.src} sprite={sprite} className="dark:brightness-[0.72] dark:saturate-[0.85]" />
      ))}
      {/* Dust storm: a flat tint instead of a CSS filter over the whole (huge) terrain layer */}
      <div
        className="absolute bg-[#b9773f] transition-opacity duration-1000"
        style={{
          left: TERRAIN_SPRITES.light.far.left,
          top: TERRAIN_SPRITES.light.far.top,
          width: TERRAIN_SPRITES.light.far.width,
          height: TERRAIN_SPRITES.light.far.height,
          opacity: dustStormActive ? 0.22 : 0,
        }}
      />
    </div>
  );
});

export function GreenhouseGrid({
  introStage = "open",
  greenhouseVisible = false,
  onGreenhouseVisibleChange,
  showBackdrop = true,
}: {
  introStage?: GreenhouseIntroStage;
  greenhouseVisible?: boolean;
  onGreenhouseVisibleChange?: (next: boolean) => void;
  showBackdrop?: boolean;
}) {
  const grid = useGreenhouseStore((s) => s.grid);
  const dustStormActive = useGreenhouseStore((s) => s.dustStormActive);
  const focusedCrop = useGreenhouseStore((s) => s.focusedCrop);
  const [selected, setSelected] = useState<TileData | null>(null);
  const handleSelect = useCallback((tile: TileData) => setSelected(tile), []);
  const handleClose = useCallback(() => setSelected(null), []);
  const interactive = introStage === "open";

  // ── Pan & Zoom ────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);

  // Crossing this threshold while the greenhouse is off restores the shell
  // and promotes that restored state into the explicit toggle.
  const ZOOM_SHOW_THRESHOLD = 0.98;
  const zoomRef = useRef(1);

  const overlayVisible = introStage === "sealed" || greenhouseVisible;
  const cropInteractionsEnabled = interactive && !overlayVisible;

  useEffect(() => {
    if (overlayVisible && selected !== null) {
      const frameId = window.requestAnimationFrame(() => {
        setSelected(null);
      });
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [overlayVisible, selected]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Touch gesture refs ──────────────────────────────────────────────
  const touchState = useRef<{
    type: "none" | "pan" | "pinch";
    startTouches: { x: number; y: number }[];
    startZoom: number;
    startPan: { x: number; y: number };
    startDist: number;
    startMid: { x: number; y: number };
  }>({
    type: "none",
    startTouches: [],
    startZoom: 1,
    startPan: { x: 0, y: 0 },
    startDist: 0,
    startMid: { x: 0, y: 0 },
  });

  const panRef = useRef({ x: 0, y: 0 });

  // Keep panRef in sync with pan state
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // ── Touch event handlers (native, for passive: false) ──────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }
    function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    function touchPt(t: Touch) {
      return { x: t.clientX, y: t.clientY };
    }

    function onTouchStart(e: TouchEvent) {
      // Don't intercept touches on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button, a, [role="button"]')) return;

      const touches = e.touches;
      if (touches.length === 1) {
        // Single finger → pan
        e.preventDefault();
        touchState.current = {
          type: "pan",
          startTouches: [touchPt(touches[0])],
          startZoom: zoomRef.current,
          startPan: { ...panRef.current },
          startDist: 0,
          startMid: touchPt(touches[0]),
        };
      } else if (touches.length === 2) {
        // Two fingers → pinch-zoom + pan
        e.preventDefault();
        const p0 = touchPt(touches[0]);
        const p1 = touchPt(touches[1]);
        touchState.current = {
          type: "pinch",
          startTouches: [p0, p1],
          startZoom: zoomRef.current,
          startPan: { ...panRef.current },
          startDist: dist(p0, p1),
          startMid: mid(p0, p1),
        };
      }
    }

    function onTouchMove(e: TouchEvent) {
      const ts = touchState.current;
      if (ts.type === "none") return;
      e.preventDefault();

      const touches = e.touches;

      if (ts.type === "pan" && touches.length === 1) {
        const dx = touches[0].clientX - ts.startMid.x;
        const dy = touches[0].clientY - ts.startMid.y;
        setPan({ x: ts.startPan.x + dx, y: ts.startPan.y + dy });
      }

      if (touches.length === 2) {
        // Upgrade from pan to pinch if a second finger was added
        if (ts.type === "pan") {
          const p0 = touchPt(touches[0]);
          const p1 = touchPt(touches[1]);
          touchState.current = {
            type: "pinch",
            startTouches: [p0, p1],
            startZoom: zoomRef.current,
            startPan: { ...panRef.current },
            startDist: dist(p0, p1),
            startMid: mid(p0, p1),
          };
          return;
        }

        const p0 = touchPt(touches[0]);
        const p1 = touchPt(touches[1]);
        const curDist = dist(p0, p1);
        const curMid = mid(p0, p1);

        // Scale
        const scale = curDist / ts.startDist;
        const nextZoom = Math.min(3, Math.max(0.3, ts.startZoom * scale));
        zoomRef.current = nextZoom;
        setZoom(nextZoom);

        // Pan follows midpoint
        const dx = curMid.x - ts.startMid.x;
        const dy = curMid.y - ts.startMid.y;
        setPan({ x: ts.startPan.x + dx, y: ts.startPan.y + dy });
      }
    }

    function onTouchEnd(e: TouchEvent) {
      const remaining = e.touches.length;
      if (remaining === 0) {
        touchState.current.type = "none";
      } else if (remaining === 1) {
        // Downgrade from pinch back to pan with the remaining finger
        const p = touchPt(e.touches[0]);
        touchState.current = {
          type: "pan",
          startTouches: [p],
          startZoom: zoomRef.current,
          startPan: { ...panRef.current },
          startDist: 0,
          startMid: p,
        };
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const nextZoom = Math.min(3, Math.max(0.3, zoomRef.current - e.deltaY * 0.001));
    const crossedRevealThreshold =
      zoomRef.current >= ZOOM_SHOW_THRESHOLD &&
      nextZoom < ZOOM_SHOW_THRESHOLD;
    const crossedHideThreshold =
      zoomRef.current < ZOOM_SHOW_THRESHOLD &&
      nextZoom >= ZOOM_SHOW_THRESHOLD;

    zoomRef.current = nextZoom;
    setZoom(nextZoom);

    if (!greenhouseVisible && crossedRevealThreshold) {
      onGreenhouseVisibleChange?.(true);
    } else if (greenhouseVisible && crossedHideThreshold) {
      onGreenhouseVisibleChange?.(false);
    }
  }, [greenhouseVisible, onGreenhouseVisibleChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Skip for touch — handled by native touch events above
    if (e.pointerType === "touch") return;
    // Don't pan when clicking on interactive elements (buttons, etc.)
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"]')) return;
    // Pan on middle-click or left-click on background
    if (e.button === 1 || (e.button === 0 && target.closest('.greenhouse-pan-area') === e.currentTarget)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Pan/zoom only touch the wrapper transform; keep the heavy scene out of those re-renders.
  const scene = useMemo(
    () => (
      <>
        <MarsSite dustStormActive={dustStormActive} />
        <div
          className={interactive ? "pointer-events-auto relative" : "pointer-events-none relative"}
          style={{ transform: "scaleY(0.54) rotate(-45deg)" }}
        >
          <div
            className="relative rounded-[18px] p-2"
            style={{
              border: "1px solid rgb(var(--mars-module-border) / 0.18)",
              background: "var(--greenhouse-floor)",
              boxShadow: "0 0 0 1px rgb(var(--mars-module-inset) / 0.4) inset",
            }}
          >
            <Corner position="top-left" />
            <Corner position="top-right" />
            <Corner position="bottom-left" />
            <Corner position="bottom-right" />

            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${COLS}, ${TILE}px)`,
                gridTemplateRows: `repeat(${ROWS}, ${TILE}px)`,
                gap: GAP,
              }}
            >
              {grid.map((row, r) =>
                row.map((tile, c) => (
                  <GridTile
                    key={`${r}-${c}`}
                    data={tile}
                    row={r}
                    col={c}
                    focused={tile.kind === "crop" && tile.crop === focusedCrop}
                    interactionsEnabled={cropInteractionsEnabled}
                    onSelect={handleSelect}
                  />
                ))
              )}
            </div>
          </div>
        </div>
        <GreenhouseShell visible={overlayVisible} />
      </>
    ),
    [grid, focusedCrop, cropInteractionsEnabled, handleSelect, interactive, dustStormActive, overlayVisible],
  );

  return (
    <div
      ref={containerRef}
      className="greenhouse-pan-area absolute inset-0 flex flex-col items-center justify-center select-none"
      style={{ cursor: "default", touchAction: "none" }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {showBackdrop && <MarsBackdrop dustStormActive={dustStormActive} />}

      <TooltipProvider delay={120} closeDelay={0}>
        <div
          className="relative"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            willChange: "transform",
          }}
        >
          {scene}
        </div>
      </TooltipProvider>

      {interactive && (zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            zoomRef.current = 1;
            setPan({ x: 0, y: 0 });
          }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: "var(--dial-glass-bg)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--dial-border)",
            color: "var(--dial-text-secondary)",
          }}
        >
          <Crosshair size={13} weight="bold" />
          Reset view
        </button>
      )}

      {cropInteractionsEnabled && <CropDialog data={selected} onClose={handleClose} />}
    </div>
  );
}

const SHELL_ORDER: ShellPanel[] = ["north", "east", "roof", "west", "south"];

/** Where each panel flies to when the shell opens (same plane offsets as before, in screen space). */
const SHELL_EJECT: Record<ShellPanel, { x: number; y: number }> = {
  north: planeToScreen(0, -3600),
  west: planeToScreen(-3600, 0),
  roof: planeToScreen(3520, -3520),
  east: planeToScreen(3600, 0),
  south: planeToScreen(0, 3600),
};

const GreenhouseShell = memo(function GreenhouseShell({ visible }: { visible: boolean }) {
  const anim = useAnimationConfig();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0">
      {SHELL_ORDER.map((panel) => (
        <motion.div
          key={panel}
          className="absolute left-0 top-0"
          initial={false}
          animate={visible ? { x: 0, y: 0 } : SHELL_EJECT[panel]}
          transition={anim.enabled ? GREENHOUSE_PANEL_TRANSITIONS[panel] : anim.instant}
        >
          <SpriteImg sprite={SHELL_SPRITES[panel]} className="dark:brightness-[0.85]" />
        </motion.div>
      ))}
    </div>
  );
});

/**
 * Simple deterministic hash for procedural generation.
 * Returns 0–1 from integer inputs.
 */
function hash(a: number, b: number, c: number): number {
  let h = (a * 2654435761) ^ (b * 2246822519) ^ (c * 3266489917);
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = (h >>> 16) ^ h;
  return (h >>> 0) / 0xffffffff;
}

/**
 * Preset positions per plant count (% of tile).
 * Layouts are balanced around the tile centre.
 * Each entry: [left%, top%, zIndex].
 */
const LAYOUTS: Record<number, [number, number, number][]> = {
  1: [[50, 50, 1]],
  2: [
    [35, 38, 1],
    [65, 62, 2],
  ],
  3: [
    [50, 24, 1],
    [24, 68, 2],
    [76, 68, 3],
  ],
  4: [
    [50, 20, 1],
    [22, 50, 2],
    [78, 50, 3],
    [50, 76, 4],
  ],
  5: [
    [50, 18, 1],
    [20, 44, 2],
    [80, 44, 3],
    [30, 76, 4],
    [70, 76, 5],
  ],
};

/** Growth → how many plants on the tile */
const GROWTH_TO_COUNT: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};

/**
 * Three fixed size tiers per growth stage: [small, medium, large].
 * Each plant in a tile gets a different tier, shuffled procedurally.
 * Scaled down for 80px tiles (from 120px).
 */
const SIZE_TIERS: Record<number, [number, number, number]> = {
  1: [18, 22, 28],
  2: [20, 26, 32],
  3: [22, 30, 36],
  4: [24, 32, 38],
  5: [26, 34, 40],
};

const TIER_PERMS: [number, number, number][] = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2],
  [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

interface PlantInstance {
  left: number;
  top: number;
  size: number;
  z: number;
}

function generatePlants(row: number, col: number, growth: number): PlantInstance[] {
  const count = GROWTH_TO_COUNT[growth] ?? 1;
  const layout = LAYOUTS[count];
  const tiers = SIZE_TIERS[growth] ?? SIZE_TIERS[3];
  const perm = TIER_PERMS[((row * 7 + col * 13) >>> 0) % 6];

  return layout.map(([left, top, z], i) => {
    const size = tiers[perm[i % 3]];
    const jx = (hash(row + 5, col + 3, i + 7) - 0.5) * 6;
    const jy = (hash(row + 11, col + 2, i + 13) - 0.5) * 6;
    return { left: left + jx, top: top + jy, size, z };
  });
}

/** Equipment standing on path tiles, keyed by "row-col". */
const PATH_PROPS: Record<string, InteriorSprite> = {
  "1-3": "astronaut",
  "0-10": "rack",
  "3-0": "bench",
  "6-4": "cart",
  "6-10": "toolbox",
  "8-6": "reel",
};

/** Front-to-back stacking: tiles lower on screen (higher row, lower col) paint last. */
function tileDepth(row: number, col: number) {
  return row - col + COLS;
}

/**
 * A 3D sprite anchored at the tile centre. The wrapper cancels the grid's
 * `scaleY(0.54) rotate(-45deg)` so the pre-rendered image stays screen-aligned.
 */
function TileSprite({ name, className }: { name: InteriorSprite; className?: string }) {
  const s = INTERIOR_SPRITES[name];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
      style={{ transform: "rotate(45deg) scaleY(1.72414)" }}
    >
      <img
        src={s.src}
        alt=""
        draggable={false}
        decoding="async"
        className={`absolute max-w-none select-none ${className ?? ""}`}
        style={{ left: s.left, top: s.top, width: s.width, height: s.height }}
      />
    </div>
  );
}

const GridTile = memo(function GridTile({
  data,
  row,
  col,
  focused,
  interactionsEnabled,
  onSelect,
}: {
  data: TileData;
  row: number;
  col: number;
  focused: boolean;
  interactionsEnabled: boolean;
  onSelect: (tile: TileData) => void;
}) {
  const depth = { "--tile-z": tileDepth(row, col) } as CSSProperties;

  if (data.kind === "path") {
    const prop = PATH_PROPS[`${row}-${col}`];
    return (
      <div className="relative z-(--tile-z) cursor-default" style={depth}>
        <div className="greenhouse-grating absolute inset-0 rounded-[3px] dark:brightness-[0.5]" />
        {data.sensor && <TileSprite name="sensor" className="dark:brightness-[0.8]" />}
        {prop && <TileSprite name={prop} className="dark:brightness-[0.8]" />}
      </div>
    );
  }

  const planted = data.stage !== undefined ? data.stage !== 'harvested' : data.growth > 0;
  const cropInfo = data.crop ? CROP_DB[data.crop] : null;
  const canInteract = interactionsEnabled && planted && !!cropInfo;

  const tile = (
    <button
      type="button"
      onClick={canInteract ? () => onSelect(data) : undefined}
      tabIndex={canInteract ? undefined : -1}
      aria-disabled={!canInteract}
      className={`crop-tile-button group/crop-tile relative z-(--tile-z) h-full w-full rounded border transition-[background-color,border-color] duration-200 ${
        focused && planted
          ? "grid-tile-focused border-yellow-500/60 bg-yellow-400/25 dark:border-yellow-400/45 dark:bg-yellow-400/12"
          : canInteract
            ? "border-transparent hover:border-emerald-600/35 hover:bg-emerald-500/12 dark:hover:border-emerald-300/30 dark:hover:bg-emerald-300/10"
            : "border-transparent"
      } ${canInteract ? "cursor-pointer hover:z-30 focus-visible:z-30" : "cursor-default"}`}
      style={{ ...depth, pointerEvents: interactionsEnabled ? undefined : "none" }}
    >
      <TileSprite
        name={planted ? "pot" : "potEmpty"}
        className="crop-tile-pot dark:brightness-[0.72] dark:saturate-[0.9]"
      />

      {data.status && planted && (
        <div
          className={`absolute right-1.5 top-1.5 z-10 h-[5px] w-[5px] rounded-full ${
            data.status === "ok"
              ? "bg-green-600/70 dark:bg-green-400/60"
              : "bg-amber-500/80 dark:bg-amber-400/70"
          }`}
        />
      )}

      {planted && data.crop && (
        <div className="crop-tile-plants">
          {generatePlants(row, col, data.growth).map((p, i) => (
            <div
              key={i}
              className="crop-tile-plant"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                zIndex: p.z,
              }}
            >
              <CropPreview crop={data.crop!} growth={data.growth} className="crop-preview-svg--tile" size={p.size} />
            </div>
          ))}
        </div>
      )}

      {planted && (
        <div className="absolute bottom-0 left-0 right-0 z-10 h-[2px] overflow-hidden rounded-b-sm bg-black/10 dark:bg-white/10">
          <div
            className="h-full bg-sky-500/60 dark:bg-sky-300/50"
            style={{ width: `${data.water}%` }}
          />
        </div>
      )}
    </button>
  );

  if (!cropInfo || !planted) {
    return tile;
  }

  if (!interactionsEnabled) {
    return tile;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={tile} />
      <TooltipContent
        variant="card"
        side="top"
        sideOffset={12}
        className="crop-tooltip-popup !w-[280px] !max-w-[280px] p-0 sm:!w-[292px] sm:!max-w-[292px]"
      >
        <CropTooltip data={data} info={cropInfo} />
      </TooltipContent>
    </Tooltip>
  );
}, (prev, next) =>
  prev.row === next.row &&
  prev.col === next.col &&
  prev.focused === next.focused &&
  prev.interactionsEnabled === next.interactionsEnabled &&
  prev.onSelect === next.onSelect &&
  prev.data.kind === next.data.kind &&
  prev.data.crop === next.data.crop &&
  prev.data.growth === next.data.growth &&
  prev.data.stage === next.data.stage &&
  prev.data.water === next.data.water &&
  prev.data.status === next.data.status &&
  prev.data.sensor === next.data.sensor
);

const CropDialog = memo(function CropDialog({
  data,
  onClose,
}: {
  data: TileData | null;
  onClose: () => void;
}) {
  const open = data !== null && data.crop !== undefined && (data.stage !== undefined ? data.stage !== 'harvested' : data.growth > 0);
  const info = data?.crop ? CROP_DB[data.crop] : null;
  const hoverMeta = data?.crop ? CROP_HOVER_META[data.crop] : null;
  const env = useGreenhouseStore((s) => s.environment);
  // Prefer per-tile state if tileId is present; fall back to aggregate per-type
  const tileCrop = data?.tileId ? env.tileCrops?.[data.tileId] : undefined;
  const cropEnv = data?.crop
    ? (tileCrop || env.crops[data.crop])
    : null;
  const anim = useAnimationConfig();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal keepMounted>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Backdrop
                render={
                  <motion.div
                    initial={anim.enabled ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    exit={anim.enabled ? { opacity: 0 } : undefined}
                    transition={anim.enabled ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] } : anim.instant}
                    className="fixed inset-0 z-9998 bg-white/60 dark:bg-black/60 backdrop-blur-2xl"
                    style={{ willChange: anim.enabled ? "opacity" : undefined }}
                  />
                }
              />

              <Dialog.Popup
                render={
                  <motion.div
                    initial={anim.enabled ? { opacity: 0, scale: 0.97, y: 8 } : false}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={anim.enabled ? { opacity: 0, scale: 0.97, y: 8 } : undefined}
                    transition={anim.enabled ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] } : anim.instant}
                  />
                }
                className="fixed inset-0 z-9999 flex items-center justify-center p-8 pointer-events-none outline-none"
              >
                <div className="pointer-events-auto relative h-[540px] w-full max-w-[960px] overflow-hidden rounded-2xl border border-black/6 bg-white shadow-[0_32px_80px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[#212121] dark:shadow-[0_32px_80px_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.2)]">
                  <Dialog.Title className="sr-only">
                    {info?.name ?? "Crop"} Details
                  </Dialog.Title>

                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-5 top-5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/4 transition-colors hover:bg-black/8 dark:bg-white/8 dark:hover:bg-white/14"
                    aria-label="Close"
                  >
                    <X size={14} weight="bold" className="text-black/40 dark:text-white/50" />
                  </button>

                  <div className="flex h-full">
                    <div className="relative flex-1 border-r border-black/4 dark:border-white/6 p-3">
                      <CropVideoPreview
                        crop={data.crop!}
                        stage={cropEnv?.stage ?? "seed"}
                        stageProgress={cropEnv?.stageProgress ?? 0}
                      >
                        {hoverMeta ? (
                          <CropPreview crop={data.crop!} growth={data.growth} />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-green-800/12 dark:bg-green-400/15" />
                        )}
                      </CropVideoPreview>
                    </div>

                    <div className="flex flex-1 flex-col overflow-y-auto p-8">
                      {info && data && (
                        <>
                          <div className="mb-8">
                            <h2 className="type-title text-black/90 dark:text-white/95">
                              {info.name}
                            </h2>
                            <p className="mt-0.5 type-small italic text-black/35 dark:text-white/40">
                              {info.scientificName}
                            </p>
                          </div>

                          <section className="mb-7">
                            <SectionLabel>Growth</SectionLabel>
                            <div className="mt-3 flex flex-col gap-3">
                              <DataRow label="Stage" value={GROWTH_LABEL[data.growth]} />
                              {cropEnv && (
                                <DataRow label="Health">
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono text-xs text-black/60 dark:text-white/65">
                                      <AnimatedParameterValue value={`${Math.round(cropEnv.healthScore * 100)}%`} debounceMs={72} />
                                    </span>
                                    <div className="h-[3px] w-20 overflow-hidden rounded-full bg-black/6 dark:bg-white/8">
                                      <div
                                        className={`h-full rounded-full ${
                                          cropEnv.healthScore > 0.7
                                            ? "bg-green-700/40 dark:bg-green-400/45"
                                            : "bg-amber-500/50 dark:bg-amber-400/55"
                                        }`}
                                        style={{ width: `${cropEnv.healthScore * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                </DataRow>
                              )}
                              <DataRow label="Soil Moisture">
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono text-xs text-black/60 dark:text-white/65">
                                    <AnimatedParameterValue value={`${data.water}%`} debounceMs={72} />
                                  </span>
                                  <div className="h-[3px] w-20 overflow-hidden rounded-full bg-black/6 dark:bg-white/8">
                                    <div
                                      className="h-full rounded-full bg-blue-500/40 dark:bg-blue-400/45"
                                      style={{ width: `${data.water}%` }}
                                    />
                                  </div>
                                </div>
                              </DataRow>
                              {cropEnv && (
                                <>
                                  <DataRow
                                    label="Days Planted"
                                    value={`${Math.round(cropEnv.daysSincePlanting)} sols`}
                                  />
                                  <DataRow
                                    label="Est. Yield"
                                    value={`${cropEnv.estimatedYieldKg.toFixed(1)} kg`}
                                  />
                                </>
                              )}
                              <DataRow
                                label="Harvest Cycle"
                                value={`${info.growthCycleDays} days`}
                              />
                            </div>
                          </section>

                          <section className="mb-7">
                            <SectionLabel>Environment</SectionLabel>
                            <div className="mt-3 flex flex-col gap-3">
                              <DataRow
                                label="Temperature"
                                value={`${info.optimalTemp[0]}-${info.optimalTemp[1]}°C`}
                              />
                              <DataRow label="Light" value={info.lightHours} />
                              <DataRow label="Water" value={info.waterPerDay} />
                            </div>
                          </section>

                          <section>
                            <SectionLabel>Nutrition</SectionLabel>
                            <div className="mt-3 flex flex-col gap-3">
                              <DataRow
                                label="Calories"
                                value={`${info.caloriesPer100g} kcal / 100g`}
                              />
                              <DataRow
                                label="Protein"
                                value={`${info.proteinPer100g}g / 100g`}
                              />
                              <DataRow
                                label="Key Nutrients"
                                value={info.keyNutrients.join(", ")}
                              />
                            </div>
                          </section>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Dialog.Popup>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/25 dark:text-white/30">
      {children}
    </h3>
  );
}

function DataRow({
  label,
  value,
  valueClassName,
  children,
}: {
  label: string;
  value?: string;
  valueClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="type-caption text-black/40 dark:text-white/45">{label}</span>
      {children ?? (
        <span className={`font-mono text-xs ${valueClassName ?? "text-black/60 dark:text-white/65"}`}>
          <AnimatedParameterValue value={value ?? ""} debounceMs={72} />
        </span>
      )}
    </div>
  );
}

const Corner = memo(function Corner({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const pos = {
    "top-left": "top-0 left-0",
    "top-right": "top-0 right-0",
    "bottom-left": "bottom-0 left-0",
    "bottom-right": "bottom-0 right-0",
  }[position];

  return (
    <>
      <div className={`absolute ${pos} h-px w-3 bg-black/8 dark:bg-white/10`} />
      <div className={`absolute ${pos} h-3 w-px bg-black/8 dark:bg-white/10`} />
    </>
  );
});
