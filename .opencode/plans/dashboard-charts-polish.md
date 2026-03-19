# Dashboard Charts Polish Plan

## Target file
`components/interface/greenhouse-charts.tsx`

## User preferences
- Keep `rounded-xl` on cards (no change to border radius)
- Skip active dot pulse animation
- Implement all other proposed changes

---

## 1. Cleaner Empty States

**Replace** the inline "Collecting..." and "Waiting for data..." text with a `ChartEmptyState` component:

```tsx
function ChartEmptyState({ color, height }: { color: string; height: number }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      {/* Dashed baseline */}
      <div
        className="absolute bottom-2 left-0 right-0"
        style={{
          height: "1px",
          backgroundImage: `repeating-linear-gradient(to right, var(--dial-border) 0px, var(--dial-border) 4px, transparent 4px, transparent 8px)`,
        }}
      />
      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 animate-shimmer"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color}08 40%, ${color}12 50%, ${color}08 60%, transparent 100%)`,
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}
```

**Requires:** Adding `animate-shimmer` keyframe to global CSS or Tailwind config:
```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```
Tailwind config extend:
```js
animation: { shimmer: "shimmer 3s ease-in-out infinite" }
```

**Usage in SparkCard:** Replace lines 140-143 with `<ChartEmptyState color={color.stroke} height={40} />`
**Usage in DetailChart:** Replace lines 232-238 with `<ChartEmptyState color={color.stroke} height={72} />`

---

## 2. Normalize Card Spacing

Changes to SparkCard:
- Padding: `px-2.5 py-2` -> `px-3 py-2.5`
- Gap: `gap-1` -> `gap-1.5`
- Spark height: `h-[36px]` -> `h-[40px]`

Changes to DetailChart:
- Padding: `px-2.5 py-2` -> `px-3 py-2.5`
- Gap: `gap-1` -> `gap-1.5`

Grid gaps:
- Spark grid: `gap-1.5` -> `gap-2`
- Detail grid: `gap-1.5` -> `gap-2`
- Section gap: `gap-2` -> `gap-2.5`

---

## 3. Crop Growth -> Vertical Bar Diagram

**Remove** `CropGrowthBar` component (horizontal bars).

**Add** `CropGrowthColumn` component:

```tsx
const STAGE_LABELS: Record<string, string> = {
  seedling: "S", vegetative: "V", flowering: "F",
  fruiting: "Fr", harvest: "H", mature: "M",
};

function CropGrowthColumn({
  name, growth, health, stage, color, index, maxHeight,
}: {
  name: string; growth: number; health: number; stage: string;
  color: string; index: number; maxHeight: number;
}) {
  const [hovered, setHovered] = React.useState(false);
  const pct = Math.round(growth);
  const barHeight = (pct / 100) * maxHeight;
  const stageLabel = STAGE_LABELS[stage] ?? stage.charAt(0).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-1 flex-1 min-w-0 cursor-default relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Percentage label - visible on hover or when > 0 */}
      <AnimatePresence>
        {(hovered || pct > 0) && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-[9px] tabular-nums font-medium text-[var(--dial-text-tertiary)]">
            {pct}%
          </motion.span>
        )}
      </AnimatePresence>

      {/* Bar container */}
      <div className="w-full flex items-end justify-center relative" style={{ height: maxHeight }}>
        {/* Background track */}
        <div className="absolute inset-x-1 bottom-0 rounded-sm"
          style={{ height: maxHeight, background: "var(--dial-border)", opacity: 0.4 }} />
        {/* Filled bar */}
        <motion.div className="relative rounded-sm z-[1]"
          initial={{ height: 0 }}
          animate={{ height: barHeight, scaleX: hovered ? 1.08 : 1 }}
          transition={{
            height: { duration: 0.6, delay: 0.3 + index * 0.04, ease: [0.22, 1, 0.36, 1] },
            scaleX: { duration: 0.15 },
          }}
          style={{
            background: color, opacity: 0.5 + health * 0.5,
            width: "calc(100% - 8px)", originY: 1,
          }}
        />
        {/* Stage badge */}
        {pct > 10 && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 0.7 }}
            className="absolute z-[2] text-[7px] font-semibold text-white/90 leading-none"
            style={{ bottom: Math.min(barHeight / 2 - 4, maxHeight - 10) }}>
            {stageLabel}
          </motion.span>
        )}
      </div>

      {/* Crop name */}
      <span className="text-[9px] text-[var(--dial-text-tertiary)] capitalize truncate w-full text-center leading-tight">
        {name}
      </span>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 rounded-md px-1.5 py-0.5 shadow-sm backdrop-blur-xl whitespace-nowrap"
            style={{ background: "var(--dial-glass-bg)", border: "1px solid var(--dial-border)" }}>
            <span className="text-[9px] text-[var(--dial-text-secondary)] capitalize">{stage}</span>
            <span className="text-[9px] text-[var(--dial-text-tertiary)] ml-1">{Math.round(health * 100)}% hp</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

**Update crop growth section** in `GreenhouseCharts`:
- Use `CROP_BAR_MAX_HEIGHT = 80`
- Render `<div className="flex gap-1 items-end">` with `CropGrowthColumn` children
- If no crops, show `<ChartEmptyState color="#30D158" height={80} />`
- Card padding: `px-3 py-3`

---

## 4. Small Interactions

### 4a. Card hover lift
Add `whileHover={{ y: -1 }}` to SparkCard and DetailChart `motion.div`.

### 4b. Border color on hover
Add `onMouseEnter/onMouseLeave` handlers to SparkCard and DetailChart:
```tsx
onMouseEnter={(e) => {
  (e.currentTarget as HTMLElement).style.borderColor = `${color.stroke}30`;
}}
onMouseLeave={(e) => {
  (e.currentTarget as HTMLElement).style.borderColor = "var(--dial-border)";
}}
```
Add `transition-[border-color] duration-150` class.

### 4c. Animated number values
Add `AnimatedValue` component:
```tsx
function AnimatedValue({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="text-xs tabular-nums font-medium text-[var(--dial-text-primary)] inline-flex items-baseline">
      <AnimatePresence mode="popLayout">
        <motion.span key={value}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
          {value}
        </motion.span>
      </AnimatePresence>
      <span className="text-[var(--dial-text-tertiary)] ml-0.5 text-[10px] font-normal">{unit}</span>
    </span>
  );
}
```
Replace inline value display in SparkCard with `<AnimatedValue value={value} unit={unit} />`.

### 4d. Cursor line on chart hover
Replace `cursor={false}` with styled cursor:
```tsx
cursor={<ChartCursorLine color={color.stroke} />}
```
Where:
```tsx
function ChartCursorLine({ color }: { color: string }) {
  return <line stroke={color} strokeOpacity={0.15} strokeWidth={1} strokeDasharray="3 3" />;
}
```

### 4e. Section label fade
Wrap "Environment" and "Crop Growth" labels in `motion.span` with matching fade-in:
```tsx
<motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
  className="text-[10px] text-[var(--dial-text-tertiary)] uppercase tracking-wider px-0.5">
  Environment
</motion.span>
```

---

## 5. Import changes
Add `AnimatePresence` to the motion import:
```tsx
import { motion, AnimatePresence } from "motion/react";
```

## 6. CSS/Tailwind config change needed
Add shimmer animation keyframe. Check `tailwind.config.ts` or global CSS for where to add it.

---

## Summary of net changes
- **1 file modified:** `components/interface/greenhouse-charts.tsx`
- **1 config touched:** Tailwind config or global CSS (shimmer keyframe)
- **Components added:** `ChartEmptyState`, `AnimatedValue`, `ChartCursorLine`, `CropGrowthColumn`
- **Components removed:** `CropGrowthBar`
- **Components modified:** `SparkCard`, `DetailChart`, `GreenhouseCharts`
