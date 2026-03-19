"use client";

import { type ReactNode, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "@phosphor-icons/react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useGreenhouseStore,
  CROP_DB,
  TOTAL_MISSION_SOLS,
  type CropInfo,
  type CropType,
  type TileData,
} from "@/lib/greenhouse-store";

const TILE = 120;
const GAP = 3;
const COLS = 8;
const ROWS = 5;

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

const PREVIEW_COLORS = {
  leaf1: "#5c865c",
  leaf2: "#79a26f",
  leaf3: "#93b686",
  leaf4: "#496f4d",
  stem: "#789160",
  fruit1: "#ca5447",
  fruit2: "#e26b58",
  fruit3: "#b8473e",
  potato1: "#a17a56",
  potato2: "#bb9567",
  potato3: "#896343",
  root1: "#d26a2f",
  root2: "#e18a44",
  root3: "#b65423",
  radish1: "#cf5f7b",
  radish2: "#ea86a1",
  radish3: "#af4c66",
  grain1: "#dcc77d",
  grain2: "#c5ab61",
  pod1: "#759755",
  pod2: "#8db367",
  pod3: "#628149",
  lettuce1: "#8db77a",
  lettuce2: "#769f68",
  kale1: "#62896a",
  kale2: "#547559",
  kale3: "#456048",
} as const;

function DepthPoly({
  points,
  fill,
  shadow,
}: {
  points: string;
  fill: string;
  shadow: string;
}) {
  return (
    <>
      <polygon points={points} fill={shadow} transform="translate(2 4)" />
      <polygon points={points} fill={fill} />
    </>
  );
}

function CropPreview({
  crop,
  className,
  size,
}: {
  crop: CropType;
  className?: string;
  size?: number;
}) {
  const svgClassName = className ? `crop-preview-svg ${className}` : "crop-preview-svg";
  const sizeStyle = size ? { width: size, height: size } as const : undefined;

  if (crop === "radish") {
    return (
      <svg viewBox="0 0 88 88" aria-hidden="true" className={svgClassName} style={sizeStyle}>
        <DepthPoly points="44,10 53,24 35,24" fill={PREVIEW_COLORS.leaf1} shadow="#355339" />
        <DepthPoly points="31,18 40,32 22,32" fill={PREVIEW_COLORS.leaf2} shadow="#4b6849" />
        <DepthPoly points="57,18 66,32 48,32" fill={PREVIEW_COLORS.leaf3} shadow="#627d60" />
        <DepthPoly points="44,28 59,41 29,41" fill={PREVIEW_COLORS.leaf4} shadow="#314a33" />
        <DepthPoly points="44,31 64,39 51,69" fill={PREVIEW_COLORS.radish1} shadow="#8c3f55" />
        <DepthPoly points="44,31 38,73 24,40" fill={PREVIEW_COLORS.radish2} shadow="#b45e7a" />
        <DepthPoly points="39,56 44,76 30,65" fill={PREVIEW_COLORS.radish3} shadow="#763245" />
      </svg>
    );
  }

  if (crop === "potato") {
    return (
      <svg viewBox="0 0 88 88" aria-hidden="true" className={svgClassName} style={sizeStyle}>
        <DepthPoly points="44,14 54,30 34,30" fill={PREVIEW_COLORS.leaf1} shadow="#355339" />
        <DepthPoly points="28,28 44,38 24,46" fill={PREVIEW_COLORS.leaf2} shadow="#4b6849" />
        <DepthPoly points="60,28 64,46 44,38" fill={PREVIEW_COLORS.leaf3} shadow="#627d60" />
        <DepthPoly points="41,28 47,54 37,54" fill={PREVIEW_COLORS.stem} shadow="#556847" />
        <DepthPoly points="28,46 42,42 44,60 31,66 22,58" fill={PREVIEW_COLORS.potato1} shadow="#6e5239" />
        <DepthPoly points="45,43 58,45 62,58 51,66 40,60" fill={PREVIEW_COLORS.potato2} shadow="#826748" />
        <DepthPoly points="38,54 49,56 50,67 40,73 31,67" fill={PREVIEW_COLORS.potato3} shadow="#60452e" />
      </svg>
    );
  }

  if (crop === "wheat") {
    return (
      <svg viewBox="0 0 88 88" aria-hidden="true" className={svgClassName} style={sizeStyle}>
        <DepthPoly points="37,18 43,72 34,72" fill={PREVIEW_COLORS.stem} shadow="#556847" />
        <DepthPoly points="49,14 55,70 46,70" fill={PREVIEW_COLORS.stem} shadow="#556847" />
        <DepthPoly points="43,9 54,17 42,24" fill={PREVIEW_COLORS.grain1} shadow="#a18d57" />
        <DepthPoly points="51,18 63,26 50,34" fill={PREVIEW_COLORS.grain2} shadow="#8f7a45" />
        <DepthPoly points="39,18 29,26 40,34" fill={PREVIEW_COLORS.grain2} shadow="#8f7a45" />
        <DepthPoly points="44,26 55,34 43,42" fill={PREVIEW_COLORS.grain1} shadow="#a18d57" />
        <DepthPoly points="50,34 61,42 49,50" fill={PREVIEW_COLORS.grain2} shadow="#8f7a45" />
        <DepthPoly points="38,35 28,43 39,49" fill={PREVIEW_COLORS.grain1} shadow="#a18d57" />
      </svg>
    );
  }

  if (crop === "tomato") {
    return (
      <svg viewBox="0 0 88 88" aria-hidden="true" className={svgClassName} style={sizeStyle}>
        <DepthPoly points="44,10 53,26 35,26" fill={PREVIEW_COLORS.leaf1} shadow="#355339" />
        <DepthPoly points="28,24 47,39 20,43" fill={PREVIEW_COLORS.leaf2} shadow="#4b6849" />
        <DepthPoly points="60,24 68,43 41,39" fill={PREVIEW_COLORS.leaf3} shadow="#627d60" />
        <DepthPoly points="44,26 50,64 38,64" fill={PREVIEW_COLORS.stem} shadow="#556847" />
        <DepthPoly points="44,39 61,51 48,70" fill={PREVIEW_COLORS.fruit1} shadow="#8f3b33" />
        <DepthPoly points="29,50 44,39 40,68" fill={PREVIEW_COLORS.fruit2} shadow="#a64d40" />
        <DepthPoly points="43,50 58,59 45,77" fill={PREVIEW_COLORS.fruit3} shadow="#80312a" />
      </svg>
    );
  }

  if (crop === "soybean") {
    return (
      <svg viewBox="0 0 88 88" aria-hidden="true" className={svgClassName} style={sizeStyle}>
        <DepthPoly points="44,12 55,29 33,29" fill={PREVIEW_COLORS.leaf1} shadow="#355339" />
        <DepthPoly points="28,24 49,39 24,46" fill={PREVIEW_COLORS.leaf2} shadow="#4b6849" />
        <DepthPoly points="60,24 64,46 40,39" fill={PREVIEW_COLORS.leaf3} shadow="#627d60" />
        <DepthPoly points="44,27 50,63 38,63" fill={PREVIEW_COLORS.stem} shadow="#556847" />
        <DepthPoly points="28,45 41,41 48,49 37,58 25,54" fill={PREVIEW_COLORS.pod1} shadow="#52693d" />
        <DepthPoly points="42,49 55,45 63,53 52,62 40,58" fill={PREVIEW_COLORS.pod2} shadow="#67824e" />
        <DepthPoly points="35,56 45,54 50,61 42,68 33,65" fill={PREVIEW_COLORS.pod3} shadow="#485f35" />
      </svg>
    );
  }

  if (crop === "spinach") {
    return (
      <svg viewBox="0 0 88 88" aria-hidden="true" className={svgClassName} style={sizeStyle}>
        <DepthPoly points="44,14 57,34 31,34" fill={PREVIEW_COLORS.leaf1} shadow="#355339" />
        <DepthPoly points="26,30 46,41 23,56" fill={PREVIEW_COLORS.leaf2} shadow="#4b6849" />
        <DepthPoly points="62,30 65,55 42,41" fill={PREVIEW_COLORS.leaf3} shadow="#627d60" />
        <DepthPoly points="43,29 60,57 29,57" fill={PREVIEW_COLORS.leaf4} shadow="#314a33" />
        <DepthPoly points="44,42 51,71 37,71" fill={PREVIEW_COLORS.stem} shadow="#556847" />
      </svg>
    );
  }

  if (crop === "kale") {
    return (
      <svg viewBox="0 0 88 88" aria-hidden="true" className={svgClassName} style={sizeStyle}>
        <DepthPoly points="44,12 57,28 31,28" fill={PREVIEW_COLORS.leaf1} shadow="#355339" />
        <DepthPoly points="23,30 46,40 22,55" fill={PREVIEW_COLORS.leaf2} shadow="#4b6849" />
        <DepthPoly points="65,30 66,55 42,40" fill={PREVIEW_COLORS.leaf3} shadow="#627d60" />
        <DepthPoly points="44,24 61,54 27,54" fill={PREVIEW_COLORS.leaf4} shadow="#314a33" />
        <DepthPoly points="31,41 45,63 23,66" fill={PREVIEW_COLORS.kale1} shadow="#45614d" />
        <DepthPoly points="57,41 65,67 43,63" fill={PREVIEW_COLORS.kale2} shadow="#3e5541" />
        <DepthPoly points="44,39 54,73 34,73" fill={PREVIEW_COLORS.kale3} shadow="#304338" />
      </svg>
    );
  }

  if (crop === "lettuce") {
    return (
      <svg viewBox="0 0 88 88" aria-hidden="true" className={svgClassName} style={sizeStyle}>
        <DepthPoly points="44,16 56,34 32,34" fill={PREVIEW_COLORS.leaf1} shadow="#355339" />
        <DepthPoly points="23,31 47,44 21,54" fill={PREVIEW_COLORS.leaf2} shadow="#4b6849" />
        <DepthPoly points="65,31 67,54 41,44" fill={PREVIEW_COLORS.leaf3} shadow="#627d60" />
        <DepthPoly points="44,30 58,57 30,57" fill={PREVIEW_COLORS.leaf4} shadow="#314a33" />
        <DepthPoly points="32,42 48,62 24,64" fill={PREVIEW_COLORS.lettuce1} shadow="#658258" />
        <DepthPoly points="56,42 64,63 41,61" fill={PREVIEW_COLORS.lettuce2} shadow="#54714b" />
        <DepthPoly points="44,42 52,71 36,71" fill={PREVIEW_COLORS.stem} shadow="#556847" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 88 88" aria-hidden="true" className={svgClassName} style={sizeStyle}>
      <DepthPoly points="44,10 53,24 35,24" fill={PREVIEW_COLORS.leaf1} shadow="#355339" />
      <DepthPoly points="31,18 40,32 22,32" fill={PREVIEW_COLORS.leaf2} shadow="#4b6849" />
      <DepthPoly points="57,18 66,32 48,32" fill={PREVIEW_COLORS.leaf3} shadow="#627d60" />
      <DepthPoly points="44,28 59,41 29,41" fill={PREVIEW_COLORS.leaf4} shadow="#314a33" />
      <DepthPoly points="44,31 63,39 50,73" fill={PREVIEW_COLORS.root1} shadow="#93481f" />
      <DepthPoly points="44,31 38,75 25,39" fill={PREVIEW_COLORS.root2} shadow="#a96431" />
      <DepthPoly points="37,55 44,75 31,64" fill={PREVIEW_COLORS.root3} shadow="#7e3c18" />
    </svg>
  );
}

function CropTooltip({
  data,
  info,
}: {
  data: TileData;
  info: CropInfo;
}) {
  const meta = data.crop ? CROP_HOVER_META[data.crop] : null;

  if (!meta || !data.crop) return null;

  return (
    <div className="crop-tooltip-card">
      <div className="crop-tooltip-top">
        <div className="crop-tooltip-model">
          <CropPreview crop={data.crop} />
        </div>
        <div className="crop-tooltip-copy">
          <div className="crop-tooltip-heading">
            <p className="type-label crop-tooltip-title">{info.name}</p>
            <p className="type-caption crop-tooltip-meta">
              {meta.label} · {meta.detail}
            </p>
          </div>
          <p className="type-small crop-tooltip-summary">{meta.summary}</p>
        </div>
      </div>
      <dl className="crop-tooltip-stats">
        <div className="crop-tooltip-stat">
          <dt className="type-caption crop-tooltip-stat-label">Water</dt>
          <dd className="type-label crop-tooltip-stat-value">{info.waterPerDay}</dd>
        </div>
        <div className="crop-tooltip-stat">
          <dt className="type-caption crop-tooltip-stat-label">Stage</dt>
          <dd className="type-label crop-tooltip-stat-value">
            {GROWTH_LABEL[data.growth]}
          </dd>
        </div>
        <div className="crop-tooltip-stat">
          <dt className="type-caption crop-tooltip-stat-label">Light</dt>
          <dd className="type-label crop-tooltip-stat-value">{info.lightHours}</dd>
        </div>
        <div className="crop-tooltip-stat">
          <dt className="type-caption crop-tooltip-stat-label">Status</dt>
          <dd className="type-label crop-tooltip-stat-value">
            {data.status === "warn" ? "Attention" : "Healthy"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function GreenhouseGrid() {
  const grid = useGreenhouseStore((s) => s.grid);
  const missionSol = useGreenhouseStore((s) => s.missionSol);
  const dustStormActive = useGreenhouseStore((s) => s.dustStormActive);
  const [selected, setSelected] = useState<TileData | null>(null);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-[13px] font-medium tracking-wide text-black/40">
          Greenhouse Module
        </span>
        <span className="text-sm text-black/15">·</span>
        <span className="font-mono text-xs text-black/25">Sol {missionSol + 1} / {TOTAL_MISSION_SOLS}</span>
        {dustStormActive && (
          <>
            <span className="text-sm text-black/15">·</span>
            <span className="font-mono text-xs text-amber-600/70">Dust Storm</span>
          </>
        )}
      </div>

      <TooltipProvider delay={120} closeDelay={0}>
        <div
          className="pointer-events-auto"
          style={{ transform: "scaleY(0.58) rotate(-45deg)" }}
        >
          <div className="relative rounded-lg border border-black/4 bg-black/0.5 p-2 shadow-[inset_0_0_80px_rgba(82,130,82,0.012)] dark:border-white/4 dark:bg-white/0.5">
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
                    onSelect={() => setSelected(tile)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>

      <LiveEnvReadings />

      <CropDialog data={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

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
 */
const SIZE_TIERS: Record<number, [number, number, number]> = {
  1: [20, 26, 34],
  2: [22, 30, 38],
  3: [24, 32, 42],
  4: [26, 34, 44],
  5: [28, 36, 46],
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

function GridTile({
  data,
  row,
  col,
  onSelect,
}: {
  data: TileData;
  row: number;
  col: number;
  onSelect: () => void;
}) {
  if (data.kind === "path") {
    return (
      <div className="relative cursor-default rounded border border-black/2.5 bg-black/1 transition-colors duration-150 hover:bg-black/2 dark:border-white/4 dark:bg-white/2 dark:hover:bg-white/4">
        {data.sensor && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[7px] w-[7px] rounded-full border border-black/7 dark:border-white/10" />
          </div>
        )}
      </div>
    );
  }

  const planted = data.growth > 0;
  const cropInfo = data.crop ? CROP_DB[data.crop] : null;

  const tile = (
    <button
      type="button"
      onClick={planted && cropInfo ? onSelect : undefined}
      className={`relative h-full w-full rounded border border-green-800/5.5 bg-green-800/4.5 transition-colors duration-150 hover:bg-green-800/8 dark:border-green-400/6 dark:bg-green-400/4.5 dark:hover:bg-green-400/10 ${
        planted && cropInfo ? "cursor-pointer" : "cursor-default"
      }`}
    >
      {data.status && planted && (
        <div
          className={`absolute right-2.5 top-2.5 h-[5px] w-[5px] rounded-full ${
            data.status === "ok"
              ? "bg-green-700/35 dark:bg-green-400/40"
              : "bg-amber-500/50 dark:bg-amber-400/55"
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
              <CropPreview crop={data.crop!} className="crop-preview-svg--tile" size={p.size} />
            </div>
          ))}
        </div>
      )}

      {planted && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-sm bg-green-800/6 dark:bg-green-400/8">
          <div
            className="h-full bg-green-800/18 dark:bg-green-400/25"
            style={{ width: `${data.water}%` }}
          />
        </div>
      )}
    </button>
  );

  if (!cropInfo || !planted) {
    return tile;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={tile} />
      <TooltipContent
        variant="card"
        side="top"
        sideOffset={12}
        className="crop-tooltip-popup !w-[280px] !max-w-[280px] !border-white/10 !bg-[rgb(38,38,35)] !text-[rgb(244,244,240)] p-0 shadow-[0_14px_34px_rgba(0,0,0,0.32),0_1px_3px_rgba(0,0,0,0.22)] sm:!w-[292px] sm:!max-w-[292px]"
      >
        <CropTooltip data={data} info={cropInfo} />
      </TooltipContent>
    </Tooltip>
  );
}

function CropDialog({
  data,
  onClose,
}: {
  data: TileData | null;
  onClose: () => void;
}) {
  const open = data !== null && data.crop !== undefined && data.growth > 0;
  const info = data?.crop ? CROP_DB[data.crop] : null;
  const hoverMeta = data?.crop ? CROP_HOVER_META[data.crop] : null;
  const env = useGreenhouseStore((s) => s.environment);
  const cropEnv = data?.crop ? env.crops[data.crop] : null;

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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed inset-0 z-9998 bg-white/60 dark:bg-black/60 backdrop-blur-2xl"
                    style={{ willChange: "opacity" }}
                  />
                }
              />

              <Dialog.Popup
                render={
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 8 }}
                    transition={{
                      duration: 0.28,
                      ease: [0.22, 1, 0.36, 1],
                    }}
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
                    <div className="flex flex-1 items-center justify-center border-r border-black/4 dark:border-white/6">
                      <div className="flex flex-col items-center gap-4">
                        <div className="crop-dialog-preview">
                          {hoverMeta ? (
                            <CropPreview crop={data.crop!} />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-green-800/12 dark:bg-green-400/15" />
                          )}
                        </div>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-black/20 dark:text-white/20">
                          Plant Preview
                        </span>
                      </div>
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
                                      {Math.round(cropEnv.healthScore * 100)}%
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
                                    {data.water}%
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
}

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
          {value}
        </span>
      )}
    </div>
  );
}

function Corner({
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
}

function LiveEnvReadings() {
  const temperature = useGreenhouseStore((s) => s.temperature);
  const humidity = useGreenhouseStore((s) => s.humidity);
  const co2Level = useGreenhouseStore((s) => s.co2Level);
  const lightLevel = useGreenhouseStore((s) => s.lightLevel);
  const env = useGreenhouseStore((s) => s.environment);

  return (
    <div className="mt-8 flex items-center gap-4">
      <EnvReading label="Temp" value={`${Math.round(temperature * 10) / 10}°C`} />
      <EnvDivider />
      <EnvReading label="Humidity" value={`${Math.round(humidity)}%`} />
      <EnvDivider />
      <EnvReading label="CO₂" value={`${Math.round(co2Level)} ppm`} />
      <EnvDivider />
      <EnvReading label="O₂" value={`${Math.round(env.o2Level * 10) / 10}%`} />
      <EnvDivider />
      <EnvReading label="Light" value={`${Math.round(lightLevel)} lux`} />
    </div>
  );
}

function EnvReading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-black/30 dark:text-white/35">
        {label}
      </span>
      <span className="font-mono text-xs text-black/50 dark:text-white/55">{value}</span>
    </div>
  );
}

function EnvDivider() {
  return <div className="h-3 w-px bg-black/6 dark:bg-white/8" />;
}
