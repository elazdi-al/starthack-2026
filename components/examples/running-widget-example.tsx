"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  WidgetShell,
  WidgetAccentPicker,
  WidgetCopyAction,
  WIDGET_ACCENTS,
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

type IconProps = ComponentPropsWithoutRef<"svg"> & {
  color?: string;
  size?: number;
};

function RoutePulseIcon({ color = "currentColor", size = 24, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      {...props}
    >
      <title>Route Pulse</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.75 4C3.67893 4 2 5.67893 2 7.75C2 9.82107 3.67893 11.5 5.75 11.5C7.24628 11.5 8.53801 10.6238 9.14009 9.35735H10.882L12.5767 12.3229C12.8444 12.7914 13.3428 13.0806 13.8823 13.0806H16.7786C17.0648 14.7628 18.5294 16.0452 20.2923 16.0452C22.2603 16.0452 23.8558 14.4497 23.8558 12.4817C23.8558 10.5137 22.2603 8.91821 20.2923 8.91821C18.7982 8.91821 17.5191 9.83703 16.9834 11.1408H14.3672L12.6725 8.17517C12.4048 7.70671 11.9064 7.41748 11.3669 7.41748H9.1041C8.95195 5.51526 7.35996 4 5.75 4ZM5.75 6C4.7835 6 4 6.7835 4 7.75C4 8.7165 4.7835 9.5 5.75 9.5C6.7165 9.5 7.5 8.7165 7.5 7.75C7.5 6.7835 6.7165 6 5.75 6ZM20.2923 10.9182C19.4111 10.9182 18.6969 11.6324 18.6969 12.5136C18.6969 13.3948 19.4111 14.109 20.2923 14.109C21.1735 14.109 21.8877 13.3948 21.8877 12.5136C21.8877 11.6324 21.1735 10.9182 20.2923 10.9182Z"
        fill={color}
      />
      <path
        d="M2.97363 17.8789C5.1893 16.4095 7.75866 15.625 10.3818 15.625H12.1894C14.6277 15.625 17.0082 16.3735 19.0088 17.7683"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DotGrid1X3HorizontalIcon({
  color = "currentColor",
  size = 24,
  ...props
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      {...props}
    >
      <title>Dot Grid 1 X 3 Horizontal</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 12C2 10.8954 2.89543 10 4 10C5.10457 10 6 10.8954 6 12C6 13.1046 5.10457 14 4 14C2.89543 14 2 13.1046 2 12ZM10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12ZM18 12C18 10.8954 18.8954 10 20 10C21.1046 10 22 10.8954 22 12C22 13.1046 21.1046 14 20 14C18.8954 14 18 13.1046 18 12Z"
        fill={color}
      />
    </svg>
  );
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
          <WidgetAccentPicker
            selectedAccent={run.color}
            onSelect={(color) => {
              setRun((currentRun) => ({ ...currentRun, color }));
              triggerHaptic("selection");
            }}
            onDone={() => {
              clearStep();
              triggerHaptic("success");
            }}
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
          <DotGrid1X3HorizontalIcon color="rgba(255,255,255,0.95)" size={24} />
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
