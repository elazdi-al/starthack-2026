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

const TILE = 120;
const GAP = 3;
const COLS = 8;
const ROWS = 5;

type TileKind = "crop" | "path";
type Status = "ok" | "warn" | null;
type CropType =
  | "lettuce"
  | "tomato"
  | "potato"
  | "soybean"
  | "spinach"
  | "wheat"
  | "radish"
  | "kale";

interface CropInfo {
  name: string;
  scientificName: string;
  growthCycleDays: number;
  optimalTemp: [number, number];
  lightHours: string;
  waterPerDay: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  keyNutrients: string[];
}

const CROP_DB: Record<CropType, CropInfo> = {
  lettuce: {
    name: "Lettuce",
    scientificName: "Lactuca sativa",
    growthCycleDays: 45,
    optimalTemp: [18, 24],
    lightHours: "16–18 h/day",
    waterPerDay: "0.8 L/m²",
    caloriesPer100g: 15,
    proteinPer100g: 1.4,
    keyNutrients: ["Vitamin A", "Vitamin K", "Folate"],
  },
  tomato: {
    name: "Tomato",
    scientificName: "Solanum lycopersicum",
    growthCycleDays: 80,
    optimalTemp: [20, 28],
    lightHours: "14–18 h/day",
    waterPerDay: "1.5 L/m²",
    caloriesPer100g: 18,
    proteinPer100g: 0.9,
    keyNutrients: ["Vitamin C", "Lycopene", "Potassium"],
  },
  potato: {
    name: "Potato",
    scientificName: "Solanum tuberosum",
    growthCycleDays: 90,
    optimalTemp: [15, 22],
    lightHours: "12–16 h/day",
    waterPerDay: "1.2 L/m²",
    caloriesPer100g: 77,
    proteinPer100g: 2.0,
    keyNutrients: ["Vitamin C", "Potassium", "Vitamin B6"],
  },
  soybean: {
    name: "Soybean",
    scientificName: "Glycine max",
    growthCycleDays: 100,
    optimalTemp: [20, 30],
    lightHours: "14–16 h/day",
    waterPerDay: "1.0 L/m²",
    caloriesPer100g: 173,
    proteinPer100g: 16.6,
    keyNutrients: ["Protein", "Iron", "Calcium"],
  },
  spinach: {
    name: "Spinach",
    scientificName: "Spinacia oleracea",
    growthCycleDays: 40,
    optimalTemp: [15, 22],
    lightHours: "14–16 h/day",
    waterPerDay: "0.7 L/m²",
    caloriesPer100g: 23,
    proteinPer100g: 2.9,
    keyNutrients: ["Iron", "Vitamin A", "Vitamin C"],
  },
  wheat: {
    name: "Wheat",
    scientificName: "Triticum aestivum",
    growthCycleDays: 120,
    optimalTemp: [18, 24],
    lightHours: "16–18 h/day",
    waterPerDay: "1.1 L/m²",
    caloriesPer100g: 340,
    proteinPer100g: 13.2,
    keyNutrients: ["Fiber", "Manganese", "Selenium"],
  },
  radish: {
    name: "Radish",
    scientificName: "Raphanus sativus",
    growthCycleDays: 30,
    optimalTemp: [16, 22],
    lightHours: "12–14 h/day",
    waterPerDay: "0.6 L/m²",
    caloriesPer100g: 16,
    proteinPer100g: 0.7,
    keyNutrients: ["Vitamin C", "Folate", "Potassium"],
  },
  kale: {
    name: "Kale",
    scientificName: "Brassica oleracea var. sabellica",
    growthCycleDays: 55,
    optimalTemp: [15, 24],
    lightHours: "14–16 h/day",
    waterPerDay: "0.9 L/m²",
    caloriesPer100g: 49,
    proteinPer100g: 4.3,
    keyNutrients: ["Vitamin K", "Vitamin C", "Calcium"],
  },
};

const GROWTH_LABEL: Record<number, string> = {
  0: "Not Planted",
  1: "Seedling",
  2: "Vegetative",
  3: "Flowering",
  4: "Fruiting",
  5: "Harvest Ready",
};

interface TileData {
  kind: TileKind;
  growth: number;
  water: number;
  status: Status;
  sensor?: boolean;
  crop?: CropType;
}

const grid: TileData[][] = [
  [
    { kind: "crop", growth: 3, water: 78, status: "ok", crop: "lettuce" },
    { kind: "crop", growth: 4, water: 92, status: "ok", crop: "tomato" },
    { kind: "crop", growth: 2, water: 65, status: "ok", crop: "spinach" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null, sensor: true },
    { kind: "crop", growth: 5, water: 88, status: "ok", crop: "soybean" },
    { kind: "crop", growth: 3, water: 72, status: "ok", crop: "wheat" },
    { kind: "crop", growth: 4, water: 95, status: "ok", crop: "kale" },
  ],
  [
    { kind: "crop", growth: 5, water: 95, status: "ok", crop: "potato" },
    { kind: "crop", growth: 3, water: 80, status: "ok", crop: "lettuce" },
    { kind: "crop", growth: 0, water: 0, status: null, crop: "radish" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 2, water: 60, status: "ok", crop: "radish" },
    { kind: "crop", growth: 5, water: 90, status: "ok", crop: "tomato" },
    { kind: "crop", growth: 1, water: 82, status: "ok", crop: "spinach" },
  ],
  [
    { kind: "crop", growth: 2, water: 55, status: "ok", crop: "wheat" },
    { kind: "crop", growth: 5, water: 70, status: "warn", crop: "soybean" },
    { kind: "crop", growth: 1, water: 90, status: "ok", crop: "kale" },
    { kind: "path", growth: 0, water: 0, status: null, sensor: true },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 4, water: 75, status: "ok", crop: "lettuce" },
    { kind: "crop", growth: 0, water: 0, status: null, crop: "potato" },
    { kind: "crop", growth: 5, water: 70, status: "warn", crop: "potato" },
  ],
  [
    { kind: "crop", growth: 4, water: 82, status: "ok", crop: "tomato" },
    { kind: "crop", growth: 1, water: 65, status: "ok", crop: "spinach" },
    { kind: "crop", growth: 3, water: 78, status: "ok", crop: "potato" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 3, water: 80, status: "ok", crop: "wheat" },
    { kind: "crop", growth: 4, water: 55, status: "warn", crop: "radish" },
    { kind: "crop", growth: 1, water: 88, status: "ok", crop: "soybean" },
  ],
  [
    { kind: "crop", growth: 3, water: 90, status: "ok", crop: "kale" },
    { kind: "crop", growth: 5, water: 85, status: "ok", crop: "kale" },
    { kind: "crop", growth: 4, water: 72, status: "ok", crop: "tomato" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null, sensor: true },
    { kind: "crop", growth: 1, water: 92, status: "ok", crop: "spinach" },
    { kind: "crop", growth: 3, water: 78, status: "ok", crop: "soybean" },
    { kind: "crop", growth: 2, water: 65, status: "ok", crop: "wheat" },
  ],
];

const DOT_SIZE: Record<number, string> = {
  1: "w-[3px] h-[3px]",
  2: "w-1 h-1",
  3: "w-[6px] h-[6px]",
  4: "w-2 h-2",
  5: "w-2.5 h-2.5",
};

const DOT_OPACITY: Record<number, string> = {
  1: "opacity-20",
  2: "opacity-35",
  3: "opacity-50",
  4: "opacity-65",
  5: "opacity-80",
};

export function GreenhouseGrid() {
  const [selected, setSelected] = useState<TileData | null>(null);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[13px] font-medium tracking-wide text-black/40">
          Greenhouse Module
        </span>
        <span className="text-sm text-black/15">·</span>
        <span className="font-mono text-xs text-black/25">Sol 1 / 450</span>
      </div>

      <TooltipProvider delay={200} closeDelay={0}>
        <div
          className="pointer-events-auto"
          style={{ transform: "scaleY(0.58) rotate(-45deg)" }}
        >
          <div className="relative p-2 border border-black/4 rounded-lg bg-black/0.5 shadow-[inset_0_0_80px_rgba(82,130,82,0.012)]">
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
                row.map((tile, c) => {
                  const id = `${r}-${c}`;
                  return (
                    <GridTile
                      key={id}
                      data={tile}
                      onSelect={() => setSelected(tile)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>

      <div className="flex items-center gap-4 mt-8">
        <EnvReading label="Temp" value="22°C" />
        <EnvDivider />
        <EnvReading label="Humidity" value="65%" />
        <EnvDivider />
        <EnvReading label="CO₂" value="800 ppm" />
        <EnvDivider />
        <EnvReading label="Light" value="420 µmol" />
        <EnvDivider />
        <EnvReading label="H₂O Reserve" value="94%" />
      </div>

      <CropDialog data={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function GridTile({
  data,
  onSelect,
}: {
  data: TileData;
  onSelect: () => void;
}) {
  if (data.kind === "path") {
    return (
      <div className="relative rounded cursor-default transition-colors duration-150 bg-black/1 border border-black/2.5 hover:bg-black/2">
        {data.sensor && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[7px] h-[7px] rounded-full border border-black/7" />
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
      className={`relative w-full h-full rounded transition-colors duration-150 bg-green-800/4.5 border border-green-800/5.5 hover:bg-green-800/8 ${
        planted && cropInfo ? "cursor-pointer" : "cursor-default"
      }`}
    >
      {data.status && planted && (
        <div
          className={`absolute top-2.5 right-2.5 w-[5px] h-[5px] rounded-full ${
            data.status === "ok" ? "bg-green-700/35" : "bg-amber-500/50"
          }`}
        />
      )}

      {planted && (
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 place-items-center p-8 pointer-events-none">
          {["a", "b", "c", "d"].map((id) => (
            <span
              key={id}
              className={`block rounded-full bg-green-800/40 ${DOT_SIZE[data.growth]} ${DOT_OPACITY[data.growth]}`}
            />
          ))}
        </div>
      )}

      {planted && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-sm overflow-hidden bg-green-800/6">
          <div
            className="h-full bg-green-800/18"
            style={{ width: `${data.water}%` }}
          />
        </div>
      )}
    </button>
  );

  if (!cropInfo) return tile;

  return (
    <Tooltip>
      <TooltipTrigger render={tile} />
      <TooltipContent side="top" sideOffset={12}>
        {cropInfo.name}
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
                    className="fixed inset-0 z-9998 bg-white/60 backdrop-blur-2xl"
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
                <div className="pointer-events-auto relative w-full max-w-[960px] h-[540px] rounded-2xl border border-black/6 bg-white shadow-[0_32px_80px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                  <Dialog.Title className="sr-only">
                    {info?.name ?? "Crop"} Details
                  </Dialog.Title>

                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-5 right-5 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/4 hover:bg-black/8 transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X size={14} weight="bold" className="text-black/40" />
                  </button>

                  <div className="flex h-full">
                    {/* Left — reserved for 3D plant visualization */}
                    <div className="flex-1 flex items-center justify-center border-r border-black/4">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full bg-green-800/4 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-green-800/12" />
                        </div>
                        <span className="text-[11px] font-medium tracking-wide text-black/20 uppercase">
                          3D Preview
                        </span>
                      </div>
                    </div>

                    {/* Right — crop data */}
                    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                      {info && data && (
                        <>
                          {/* Header */}
                          <div className="mb-8">
                            <h2 className="type-title text-black/90">
                              {info.name}
                            </h2>
                            <p className="type-small text-black/35 mt-0.5 italic">
                              {info.scientificName}
                            </p>
                          </div>

                          {/* Growth Status */}
                          <section className="mb-7">
                            <SectionLabel>Growth</SectionLabel>
                            <div className="mt-3 flex flex-col gap-3">
                              <DataRow
                                label="Stage"
                                value={GROWTH_LABEL[data.growth]}
                              />
                              <DataRow label="Water Level">
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono text-xs text-black/60">
                                    {data.water}%
                                  </span>
                                  <div className="w-20 h-[3px] rounded-full bg-black/6 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-green-700/40"
                                      style={{ width: `${data.water}%` }}
                                    />
                                  </div>
                                </div>
                              </DataRow>
                              <DataRow
                                label="Status"
                                value={
                                  data.status === "ok"
                                    ? "Healthy"
                                    : data.status === "warn"
                                      ? "Needs Attention"
                                      : "—"
                                }
                                valueClassName={
                                  data.status === "warn"
                                    ? "text-amber-600/80"
                                    : undefined
                                }
                              />
                              <DataRow
                                label="Harvest Cycle"
                                value={`${info.growthCycleDays} days`}
                              />
                            </div>
                          </section>

                          {/* Environment */}
                          <section className="mb-7">
                            <SectionLabel>Environment</SectionLabel>
                            <div className="mt-3 flex flex-col gap-3">
                              <DataRow
                                label="Temperature"
                                value={`${info.optimalTemp[0]}–${info.optimalTemp[1]}°C`}
                              />
                              <DataRow
                                label="Light"
                                value={info.lightHours}
                              />
                              <DataRow
                                label="Water"
                                value={info.waterPerDay}
                              />
                            </div>
                          </section>

                          {/* Nutrition */}
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
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/25">
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
      <span className="type-caption text-black/40">{label}</span>
      {children ?? (
        <span
          className={`font-mono text-xs ${valueClassName ?? "text-black/60"}`}
        >
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
      <div className={`absolute ${pos} w-3 h-px bg-black/8`} />
      <div className={`absolute ${pos} w-px h-3 bg-black/8`} />
    </>
  );
}

function EnvReading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-black/30">
        {label}
      </span>
      <span className="font-mono text-xs text-black/50">{value}</span>
    </div>
  );
}

function EnvDivider() {
  return <div className="w-px h-3 bg-black/6" />;
}
