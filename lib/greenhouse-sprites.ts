/**
 * Pre-rendered 3D sprites for the greenhouse scene (generated — do not hand-edit offsets).
 *
 * Rendered with an orthographic three.js camera that matches the grid's CSS projection
 * (`scaleY(0.54) rotate(-45deg)` = azimuth 45°, elevation asin(0.54)). Offsets are CSS px
 * relative to the projected greenhouse centre at grid-plane height.
 */
export interface SiteSprite {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Terrain per theme: a low-res `far` fan plus a sharp `near` window feathered on top. */
export const TERRAIN_SPRITES = {
  light: { far: { src: "/images/greenhouse/site/terrain-light-far.webp", left: -3737.64, top: -2019.39, width: 7478.0, height: 4040.0 }, near: { src: "/images/greenhouse/site/terrain-light-near.webp", left: -1999.64, top: -1149.39, width: 4000.0, height: 2300.0 } },
  dark: { far: { src: "/images/greenhouse/site/terrain-dark-far.webp", left: -3737.64, top: -2019.39, width: 7478.0, height: 4040.0 }, near: { src: "/images/greenhouse/site/terrain-dark-near.webp", left: -1999.64, top: -1149.39, width: 4000.0, height: 2300.0 } },
} as const satisfies Record<string, { far: SiteSprite; near: SiteSprite }>;

/** Drawn beneath the crop grid, in this order. */
export const SITE_PROPS: SiteSprite[] = [
  { src: "/images/greenhouse/site/prop-slab.webp", left: -716.51, top: -396.78, width: 1444.5, height: 796.5 },
  { src: "/images/greenhouse/site/prop-habitat.webp", left: -1319.04, top: -694.97, width: 1252.0, height: 778.0 },
  { src: "/images/greenhouse/site/prop-mast.webp", left: -206.92, top: -946.02, width: 436.0, height: 505.0 },
  { src: "/images/greenhouse/site/prop-solar.webp", left: 81.97, top: -721.56, width: 883.5, height: 605.0 },
  { src: "/images/greenhouse/site/prop-tanks.webp", left: 133.15, top: 99.11, width: 666.5, height: 373.5 },
  { src: "/images/greenhouse/site/prop-rover.webp", left: -638.94, top: 224.78, width: 290.0, height: 255.0 }
];

/** Glass shell panels, drawn above the crop grid in this order. */
export const SHELL_SPRITES = {
  north: { src: "/images/greenhouse/site/shell-north.webp", left: -623.9, top: -509.32, width: 717.5, height: 560.0 },
  west: { src: "/images/greenhouse/site/shell-west.webp", left: -628.14, top: -129.98, width: 549.5, height: 470.0 },
  roof: { src: "/images/greenhouse/site/shell-roof.webp", left: -626.99, top: -512.09, width: 1254.0, height: 685.5 },
  east: { src: "/images/greenhouse/site/shell-east.webp", left: 78.96, top: -511.82, width: 549.5, height: 470.0 },
  south: { src: "/images/greenhouse/site/shell-south.webp", left: -93.57, top: -222.94, width: 717.5, height: 560.0 }
} as const satisfies Record<string, SiteSprite>;

export type ShellPanel = keyof typeof SHELL_SPRITES;

/** Interior sprites, offsets relative to the projected tile centre (grid plane). */
export const INTERIOR_SPRITES = {
  pot: { src: "/images/greenhouse/interior/pot.webp", left: -51.46, top: -42.27, width: 102.92, height: 68.33 },
  potEmpty: { src: "/images/greenhouse/interior/potEmpty.webp", left: -51.46, top: -42.27, width: 102.92, height: 68.33 },
  sensor: { src: "/images/greenhouse/interior/sensor.webp", left: -15.48, top: -79.48, width: 70.0, height: 87.92 },
  astronaut: { src: "/images/greenhouse/interior/astronaut.webp", left: -56.12, top: -153.37, width: 168.75, height: 180.42 },
  rack: { src: "/images/greenhouse/interior/rack.webp", left: -35.92, top: -94.17, width: 110.83, height: 114.58 },
  cart: { src: "/images/greenhouse/interior/cart.webp", left: -41.01, top: -94.92, width: 132.08, height: 117.08 },
  reel: { src: "/images/greenhouse/interior/reel.webp", left: -45.29, top: -46.8, width: 87.08, height: 71.25 },
  toolbox: { src: "/images/greenhouse/interior/toolbox.webp", left: -29.62, top: -36.46, width: 67.5, height: 59.17 },
  bench: { src: "/images/greenhouse/interior/bench.webp", left: -41.93, top: -105.66, width: 118.33, height: 127.5 }
} as const satisfies Record<string, SiteSprite>;

export type InteriorSprite = keyof typeof INTERIOR_SPRITES;
