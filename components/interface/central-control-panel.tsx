"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowCounterClockwise, Copy, Check } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { ControlPanelIcon } from "@/components/icons";
import { Panel } from "@/components/ui/central-control";
import {
  DialStore,
  type PanelConfig,
} from "@/components/ui/central-control/store/DialStore";
import { cn } from "@/lib/utils";
import { useGreenhouseStore, type SpeedKey, type ManualOverrides } from "@/lib/greenhouse-store";
import { triggerHaptic } from "@/lib/haptics";
import { SpeedSelector } from "@/components/interface/speed-selector";
import { useAnimationConfig } from "@/lib/use-animation-config";

const MORPH_SPRING = { type: "spring" as const, bounce: 0.05, duration: 0.35 };


interface CentralControlPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CentralControlPanel({
  open,
  onOpenChange,
}: CentralControlPanelProps) {
  const [panels, setPanels] = React.useState<PanelConfig[]>([]);
  const [mounted, setMounted] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [copied, setCopied] = React.useState(false);
  const dragRef = React.useRef<{
    startX: number; startY: number;
    offsetX: number; offsetY: number;
    baseLeft: number; baseTop: number;
    baseWidth: number; baseHeight: number;
  } | null>(null);

  const speed = useGreenhouseStore((s) => s.speed);
  const setSpeed = useGreenhouseStore((s) => s.setSpeed);
  const applyOverrides = useGreenhouseStore((s) => s.applyOverrides);

  React.useEffect(() => {
    setMounted(true);
    setPanels(DialStore.getPanels());

    const unsubscribe = DialStore.subscribeGlobal(() => {
      setPanels(DialStore.getPanels());
    });

    return unsubscribe;
  }, []);

  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const morphRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { startX, startY, offsetX, offsetY, baseLeft, baseTop, baseWidth, baseHeight } = dragRef.current;
      let newX = offsetX + (e.clientX - startX);
      let newY = offsetY + (e.clientY - startY);

      newX = Math.max(-baseLeft, Math.min(window.innerWidth - baseLeft - baseWidth, newX));
      newY = Math.max(-baseTop, Math.min(window.innerHeight - baseTop - baseHeight, newY));

      setDragOffset({ x: newX, y: newY });
    };
    const onMouseUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    const el = morphRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: dragOffset.x,
      offsetY: dragOffset.y,
      baseLeft: rect.left - dragOffset.x,
      baseTop: rect.top - dragOffset.y,
      baseWidth: rect.width,
      baseHeight: rect.height,
    };
    e.preventDefault();
  };

  React.useEffect(() => {
    if (!open) setDragOffset({ x: 0, y: 0 });
  }, [open]);

  const handleReset = () => {
    setSpeed("x1");
    // Reset all manual overrides to disabled (returns to natural sim behavior)
    const resetOverrides: ManualOverrides = {
      externalTempEnabled: false,
      externalTemp: -63,
      solarRadiationEnabled: false,
      solarRadiation: 590,
      dustStormEnabled: false,
      dustStormSeverity: 0,
      atmosphericPressureEnabled: false,
      atmosphericPressure: 600,
      timeOfDayLocked: false,
      timeOfDayFraction: 0.5,
    };
    applyOverrides(resetOverrides);
    triggerHaptic("light");
  };

  const handleCopyJson = () => {
    const snapshot = useGreenhouseStore.getState().getEnvironmentSnapshot();
    const json = JSON.stringify(snapshot, null, 2);
    navigator.clipboard.writeText(json).then(
      () => triggerHaptic("success"),
      () => triggerHaptic("error"),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const showPanel = open && mounted && panels.length > 0;
  const anim = useAnimationConfig();

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex flex-col items-end"
      style={showPanel ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
    >
      <div className="size-10 shrink-0" />

      <motion.div
        ref={morphRef}
        className={cn("absolute right-0 top-0", showPanel && "z-9999")}
        initial={false}
        animate={{
          width: showPanel ? 300 : 40,
          height: showPanel ? "auto" : 40,
          borderRadius: showPanel ? 14 : 20,
        }}
        transition={anim.enabled ? MORPH_SPRING : anim.instant}
        style={{ overflow: "hidden", maxHeight: showPanel ? "calc(100vh - 80px)" : 40 }}
      >
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: "inherit",
            background: "var(--dial-glass-bg)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow:
              "inset 0 0 0 1px var(--dial-border), 0 8px 24px rgb(0 0 0 / 0.04)",
            willChange: anim.enabled ? "opacity" : undefined,
          }}
          initial={false}
          animate={{ opacity: showPanel ? 1 : 0 }}
          transition={anim.enabled ? { duration: 0.25 } : anim.instant}
        />

        <div
          className="relative flex justify-end"
          style={{
            padding: showPanel ? "5px 6px 0" : "0px",
            cursor: showPanel ? "grab" : undefined,
          }}
          onMouseDown={showPanel ? handleDragStart : undefined}
        >
          <Button
            aria-label={open ? "Hide controls" : "Show controls"}
            aria-pressed={open}
            size="icon-lg"
            variant="ghost"
            className={cn(
              "rounded-full border-transparent bg-transparent shadow-none hover:bg-accent",
              showPanel
                ? "text-(--dial-text-primary)"
                : "text-(--dial-text-secondary) hover:text-(--dial-text-primary)"
            )}
            onContextMenu={(e) => e.currentTarget.blur()}
            onClick={() => onOpenChange(!open)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ControlPanelIcon
              className="size-6"
              tone={showPanel ? "strong" : "muted"}
            />
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {showPanel && (
            <motion.div
              key="cc-panel-content"
              className="relative cc-morph-content dialkit-root overflow-y-auto"
              data-embedded=""
              initial={anim.enabled ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={anim.enabled ? { opacity: 0 } : undefined}
              transition={anim.enabled ? { duration: 0.12 } : anim.instant}
              style={{ maxHeight: "calc(100vh - 160px)" }}
            >
              {/* Global toolbar */}
              <div className="cc-toolbar">
                <button
                  type="button"
                  className="cc-toolbar-btn"
                  onClick={handleReset}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Reset simulation"
                >
                  <ArrowCounterClockwise size={14} weight="bold" />
                </button>

                <SpeedSelector className="flex-1" />

                <button
                  type="button"
                  className="cc-toolbar-btn cc-toolbar-copy"
                  onClick={handleCopyJson}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Copy simulation state as JSON"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {copied ? (
                      <motion.span
                        key="check"
                        className="cc-toolbar-icon"
                        initial={anim.enabled ? { scale: 0.5, opacity: 0 } : false}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={anim.enabled ? { scale: 0.5, opacity: 0 } : undefined}
                        transition={anim.enabled ? { type: "spring", visualDuration: 0.2, bounce: 0.2 } : anim.instant}
                      >
                        <Check size={14} weight="bold" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        className="cc-toolbar-icon"
                        initial={anim.enabled ? { scale: 0.5, opacity: 0 } : false}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={anim.enabled ? { scale: 0.5, opacity: 0 } : undefined}
                        transition={anim.enabled ? { type: "spring", visualDuration: 0.2, bounce: 0.2 } : anim.instant}
                      >
                        <Copy size={14} weight="bold" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>

              {panels.map((panel, idx) => {
                const sectionLabel =
                  panel.id === "sim-ext" ? "External" :
                  panel.id === "sim-gh" ? "Greenhouse" :
                  panel.id === "sim-crops" ? "Crop" :
                  panel.name;
                const isCrop = panel.id === "sim-crops";

                return (
                  <React.Fragment key={panel.id}>
                    {idx > 0 && <div className="cc-section-divider" />}
                    <h3 className="cc-section-title">{sectionLabel}</h3>
                    {isCrop ? (
                      <div className="cc-crop-section">
                        <Panel panel={panel} defaultOpen open inline />
                      </div>
                    ) : (
                      <Panel panel={panel} defaultOpen open inline />
                    )}
                  </React.Fragment>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
