"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";

import { Button } from "@/components/ui/button";
import { ControlPanelIcon } from "@/components/icons";
import { Panel } from "@/components/ui/central-control";
import {
  DialStore,
  type PanelConfig,
} from "@/components/ui/central-control/store/DialStore";
import { cn } from "@/lib/utils";

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
  const dragRef = React.useRef<{
    startX: number; startY: number;
    offsetX: number; offsetY: number;
    baseLeft: number; baseTop: number;
    baseWidth: number; baseHeight: number;
  } | null>(null);

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

  const showPanel = open && mounted && panels.length > 0;

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
          width: showPanel ? 280 : 40,
          height: showPanel ? "auto" : 40,
          borderRadius: showPanel ? 14 : 20,
        }}
        transition={MORPH_SPRING}
        style={{ overflow: "hidden" }}
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
            willChange: "opacity",
          }}
          initial={false}
          animate={{ opacity: showPanel ? 1 : 0 }}
          transition={{ duration: 0.25 }}
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
              className="relative cc-morph-content dialkit-root"
              data-embedded=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {panels.map((panel) => (
                <Panel key={panel.id} panel={panel} defaultOpen open inline />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
