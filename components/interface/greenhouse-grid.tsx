"use client";

const TILE = 120;
const GAP = 3;
const COLS = 8;
const ROWS = 5;

type TileKind = "crop" | "path";
type Status = "ok" | "warn" | null;

interface TileData {
  kind: TileKind;
  growth: number;
  water: number;
  status: Status;
  sensor?: boolean;
}

const grid: TileData[][] = [
  [
    { kind: "crop", growth: 3, water: 78, status: "ok" },
    { kind: "crop", growth: 4, water: 92, status: "ok" },
    { kind: "crop", growth: 2, water: 65, status: "ok" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null, sensor: true },
    { kind: "crop", growth: 5, water: 88, status: "ok" },
    { kind: "crop", growth: 3, water: 72, status: "ok" },
    { kind: "crop", growth: 4, water: 95, status: "ok" },
  ],
  [
    { kind: "crop", growth: 5, water: 95, status: "ok" },
    { kind: "crop", growth: 3, water: 80, status: "ok" },
    { kind: "crop", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 2, water: 60, status: "ok" },
    { kind: "crop", growth: 5, water: 90, status: "ok" },
    { kind: "crop", growth: 1, water: 82, status: "ok" },
  ],
  [
    { kind: "crop", growth: 2, water: 55, status: "ok" },
    { kind: "crop", growth: 5, water: 70, status: "warn" },
    { kind: "crop", growth: 1, water: 90, status: "ok" },
    { kind: "path", growth: 0, water: 0, status: null, sensor: true },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 4, water: 75, status: "ok" },
    { kind: "crop", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 5, water: 70, status: "warn" },
  ],
  [
    { kind: "crop", growth: 4, water: 82, status: "ok" },
    { kind: "crop", growth: 1, water: 65, status: "ok" },
    { kind: "crop", growth: 3, water: 78, status: "ok" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 3, water: 80, status: "ok" },
    { kind: "crop", growth: 4, water: 55, status: "warn" },
    { kind: "crop", growth: 1, water: 88, status: "ok" },
  ],
  [
    { kind: "crop", growth: 3, water: 90, status: "ok" },
    { kind: "crop", growth: 5, water: 85, status: "ok" },
    { kind: "crop", growth: 4, water: 72, status: "ok" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null, sensor: true },
    { kind: "crop", growth: 1, water: 92, status: "ok" },
    { kind: "crop", growth: 3, water: 78, status: "ok" },
    { kind: "crop", growth: 2, water: 65, status: "ok" },
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
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[13px] font-medium tracking-wide text-black/40">
          Greenhouse Module
        </span>
        <span className="text-sm text-black/15">·</span>
        <span className="font-mono text-xs text-black/25">Sol 1 / 450</span>
      </div>

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
                return <GridTile key={id} data={tile} />;
              })
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
}

function GridTile({ data }: { data: TileData }) {
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

  return (
    <div className="relative rounded cursor-default transition-colors duration-150 bg-green-800/4.5 border border-green-800/5.5 hover:bg-green-800/8">
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
