"use client";

import { DotGridHorizontalIcon, RoutePulseIcon } from "@/components/icons";
import { ColorSelector, WIDGET_ACCENTS } from "@/components/ui/color-selector";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  WidgetShell,
  WidgetCopyAction,
  WIDGET_ANIMATED_STYLE,
  WIDGET_CONTENT_TRANSITION,
  WIDGET_EXIT_TRANSITION,
  WIDGET_SLOT_ENTER_DELAY,
  getWidgetCapsuleStyle,
  getWidgetIconButtonStyle,
  useWidgetInteraction,
  widgetFieldClassName,
  widgetPrimaryTextClassName,
  widgetSecondaryTextClassName,
} from "@/components/ui/widget-shell";

interface RunningWidgetState {
  color: string;
  distance: number;
  name: string;
  pace: string;
  streak: string;
}

export function RunningWidgetExample({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [run, setRun] = useState<RunningWidgetState>({
    color: WIDGET_ACCENTS[8],
    distance: 8.4,
    name: "Morning Run",
    pace: "4:42 /km",
    streak: "12 day streak",
  });

  const {
    actionLabel,
    clearStep,
    handleActionClick,
    handleOpenChange,
    isEditingTitle,
    isOpen,
    isPickingAccent,
  } = useWidgetInteraction({ editLabel: "Edit Title" });

  function commitTitle() {
    setRun((currentRun) => ({
      ...currentRun,
      name: currentRun.name.trim() || "Evening Run",
    }));
  }

  function finishTitleEdit() {
    commitTitle();
    clearStep();
    triggerHaptic("success");
  }

  function handleCustomizeClick() {
    handleActionClick(commitTitle);
    triggerHaptic(isEditingTitle ? "success" : "selection");
  }

  function handleDialogChange(open: boolean) {
    handleOpenChange(open);
    triggerHaptic(open ? "soft" : "selection");
  }

  useEffect(() => {
    if (!isEditingTitle || !inputRef.current) {
      return;
    }

    const element = inputRef.current;
    const length = element.value.length;
    element.focus();
    element.setSelectionRange(length, length);
  }, [isEditingTitle]);

  return (
    <WidgetShell
      className={className}
      accent={run.color}
      dialogTitle="Running Widget Settings"
      isOpen={isOpen}
      layoutId="running-widget-example"
      onOpenChange={handleDialogChange}
      panel={
        isPickingAccent ? (
          <ColorSelector
            value={run.color}
            onColorSelect={(color) => {
              setRun((currentRun) => ({ ...currentRun, color }));
            }}
            onDone={clearStep}
          />
        ) : null
      }
      compactTopLeft={
        <div className="flex size-[30px] items-center justify-center">
          <RoutePulseIcon color="rgba(255,255,255,0.95)" />
        </div>
      }
      compactBottomLeft={
        <>
          <input
            className={widgetFieldClassName}
            type="text"
            value={run.name}
            disabled
            placeholder="Workout Title"
            aria-label="Workout title"
          />
          <p className={widgetSecondaryTextClassName}>{run.distance.toFixed(1)} km</p>
        </>
      }
      compactTopRight={
        <div
          aria-hidden="true"
          className="pointer-events-none"
          style={{ ...getWidgetIconButtonStyle(), ...WIDGET_ANIMATED_STYLE }}
        >
          <DotGridHorizontalIcon color="rgba(255,255,255,0.95)" />
        </div>
      }
      compactBottomRight={
        <div
          className="pointer-events-none"
          style={{ ...getWidgetCapsuleStyle(), opacity: 0 }}
        >
          <p className={cn(widgetPrimaryTextClassName, "text-white/85")}>Customize</p>
        </div>
      }
      expandedTopLeft={
        <div className="flex size-[30px] items-center justify-center">
          <RoutePulseIcon color="rgba(255,255,255,0.95)" />
        </div>
      }
      expandedBottomLeft={
        <>
          <input
            ref={inputRef}
            className={widgetFieldClassName}
            type="text"
            value={run.name}
            disabled={!isEditingTitle}
            placeholder="Workout Title"
            aria-label="Workout title"
            onChange={(event) =>
              setRun((currentRun) => ({ ...currentRun, name: event.target.value }))
            }
            onBlur={finishTitleEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
          <p className={widgetSecondaryTextClassName}>
            {run.distance.toFixed(1)} km • {run.pace}
          </p>
        </>
      }
      expandedTopRight={
        <WidgetCopyAction
          value={`${run.name} • ${run.distance.toFixed(1)} km • ${run.pace} avg pace • ${run.streak}`}
          idleLabel="Copy Summary"
          delay={isPickingAccent ? 0 : WIDGET_SLOT_ENTER_DELAY}
        />
      }
      expandedBottomRight={
        <motion.div
          aria-label={actionLabel}
          role="button"
          tabIndex={0}
          className="cursor-pointer"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4, transition: WIDGET_EXIT_TRANSITION }}
          style={{
            ...getWidgetCapsuleStyle(isEditingTitle ? run.color : undefined),
            ...WIDGET_ANIMATED_STYLE,
          }}
          transition={{
            ...WIDGET_CONTENT_TRANSITION,
            delay: isPickingAccent ? 0 : WIDGET_SLOT_ENTER_DELAY + 0.03,
          }}
          onClick={handleCustomizeClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              handleCustomizeClick();
            }
          }}
        >
          <p
            className={cn(
              widgetPrimaryTextClassName,
              isEditingTitle ? "text-[color:inherit]" : "text-white/80"
            )}
          >
            {actionLabel}
          </p>
        </motion.div>
      }
      {...props}
    />
  );
}
