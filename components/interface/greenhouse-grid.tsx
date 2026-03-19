"use client";

const TILE = 60;
const GAP = 2;
const COLS = 6;
const ROWS = 4;

const isCrop = (col: number) => col <= 1 || col >= 4;

export function GreenhouseGrid() {
  const tiles = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      tiles.push(
        <div
          key={`${r}-${c}`}
          className={`iso-tile${isCrop(c) ? " iso-tile--crop" : ""}`}
        />
      );
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto" style={{ perspective: 800 }}>
        <div
          style={{
            transform: "rotateX(60deg) rotateZ(-45deg)",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, ${TILE}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${TILE}px)`,
              gap: GAP,
              transformStyle: "preserve-3d",
            }}
          >
            {tiles}
          </div>
        </div>
      </div>
    </div>
  );
}
