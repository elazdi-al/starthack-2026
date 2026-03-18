"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Calligraph } from "calligraph";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type HTMLMotionProps,
} from "motion/react";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { Checkmark1SmallIcon, ClipboardIcon } from "@/components/icons";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const WIDGET_SHELL_TRANSITION = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.9,
  restSpeed: 0.01,
  restDelta: 0.01,
} as const;

export const WIDGET_CONTENT_TRANSITION = {
  duration: 0.18,
  ease: EASE_OUT,
} as const;

export const WIDGET_OVERLAY_TRANSITION = {
  duration: 0.24,
  ease: EASE_OUT,
} as const;

export const WIDGET_EXIT_TRANSITION = {
  duration: 0.14,
  ease: EASE_OUT,
} as const;

export const WIDGET_SLOT_ENTER_DELAY = 0.12;

export const WIDGET_ANIMATED_STYLE = {
  willChange: "transform, opacity",
  contain: "layout paint style" as const,
  backfaceVisibility: "hidden" as const,
  WebkitBackfaceVisibility: "hidden" as const,
} as const;

export const widgetFrameClassName =
  "relative z-0 flex min-h-[384px] w-full items-center justify-center overflow-visible rounded-[12px] border border-[var(--dial-border)] bg-[var(--dial-surface)] shadow-[var(--dial-shadow)]";

export const widgetPopupClassName =
  "fixed inset-0 z-[2147483647] m-auto flex flex-col-reverse items-center justify-center gap-6 p-4 pointer-events-none outline-none sm:p-6";

const widgetTextBaseClassName =
  "type-ui m-0 flex whitespace-nowrap p-0 leading-none";

export const widgetPrimaryTextClassName = cn(widgetTextBaseClassName, "text-white");
export const widgetSecondaryTextClassName = cn(widgetTextBaseClassName, "text-white/78");
export const widgetFieldClassName = cn(
  widgetPrimaryTextClassName,
  "w-fit border-none bg-transparent p-0 outline-none placeholder:text-white/55 disabled:opacity-100 disabled:[-webkit-text-fill-color:currentColor] [field-sizing:content]"
);

type WidgetStep = "idle" | "accent" | "title";

interface UseWidgetInteractionOptions {
  editLabel?: string;
}

interface WidgetShellProps extends ComponentPropsWithoutRef<"div"> {
  accent: string;
  compactWidth?: CSSProperties["width"];
  dialogTitle: string;
  isOpen: boolean;
  layoutId: string;
  onOpenChange: (open: boolean) => void;
  panel?: ReactNode;
  expandedWidth?: CSSProperties["width"];
  compactTopLeft: ReactNode;
  compactBottomLeft: ReactNode;
  compactTopRight?: ReactNode;
  compactBottomRight?: ReactNode;
  expandedTopLeft?: ReactNode;
  expandedBottomLeft?: ReactNode;
  expandedTopRight?: ReactNode;
  expandedBottomRight?: ReactNode;
}

interface WidgetSurfaceProps extends ComponentPropsWithoutRef<typeof motion.div> {
  accent: string;
  topLeftId: string;
  bottomLeftId: string;
  topRightId: string;
  bottomRightId: string;
  width?: CSSProperties["width"];
  topLeft: ReactNode;
  bottomLeft: ReactNode;
  topRight?: ReactNode;
  bottomRight?: ReactNode;
}

interface WidgetCopyActionProps
  extends Omit<HTMLMotionProps<"button">, "children" | "value"> {
  value: string;
  copiedLabel?: string;
  delay?: number;
  idleLabel: string;
  resetDelay?: number;
}

export function useWidgetInteraction({
  editLabel = "Edit Title",
}: UseWidgetInteractionOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<WidgetStep>("idle");

  const isPickingAccent = step === "accent";
  const isEditingTitle = step === "title";
  const actionLabel = !isOpen
    ? ""
    : isEditingTitle
      ? "Done"
      : isPickingAccent
        ? editLabel
        : "Customize";

  function clearStep() {
    setStep("idle");
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      clearStep();
    }

    setIsOpen(open);
  }

  function handleActionClick(onDone?: () => void) {
    if (isEditingTitle) {
      onDone?.();
      clearStep();
      return;
    }

    if (isPickingAccent) {
      setStep("title");
      return;
    }

    setStep("accent");
  }

  return {
    actionLabel,
    clearStep,
    handleActionClick,
    handleOpenChange,
    isEditingTitle,
    isOpen,
    isPickingAccent,
  };
}

export function getWidgetSurfaceStyle(
  accent: string,
  width?: CSSProperties["width"]
): CSSProperties {
  return {
    boxSizing: "border-box",
    background: accent,
    border: "none",
    transition: "background 0.2s ease",
    fontFamily: "var(--font-sans)",
    fontFeatureSettings: '"calt", "ccmp", "kern", "locl"',
    fontSize: 15,
    fontWeight: 500,
    letterSpacing: "0px",
    lineHeight: "24px",
    color: "rgba(255,255,255,0.95)",
    textRendering: "optimizeLegibility",
    WebkitFontSmoothing: "auto",
    colorScheme: "dark",
    boxShadow: "none",
    ...WIDGET_ANIMATED_STYLE,
    ...(width ? { width } : {}),
  };
}

export function getWidgetIconButtonStyle(): CSSProperties {
  return {
    width: 28,
    height: 28,
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    borderRadius: 999,
    color: "rgba(255,255,255,0.95)",
  };
}

export function getWidgetCapsuleStyle(accent?: string): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    height: 32,
    padding: "0 16px",
    color: accent ?? "rgba(255,255,255,0.8)",
    background: accent ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.2)",
    borderRadius: 100,
    boxShadow: accent ? "0 10px 24px rgba(0,0,0,0.08)" : "none",
  };
}

export function WidgetCopyAction({
  value,
  copiedLabel = "Copied",
  delay = 0,
  idleLabel,
  resetDelay = 1800,
  className,
  onClick,
  type = "button",
  ...props
}: WidgetCopyActionProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(event);

    if (event.defaultPrevented || !navigator.clipboard?.writeText) {
      if (!event.defaultPrevented) {
        triggerHaptic("error");
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      triggerHaptic("success");

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, resetDelay);
    } catch {
      triggerHaptic("error");
    }
  }

  return (
    <motion.button
      type={type}
      aria-label={copied ? copiedLabel : idleLabel}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: WIDGET_EXIT_TRANSITION }}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-2 text-white/92",
        className
      )}
      style={WIDGET_ANIMATED_STYLE}
      transition={{
        ...WIDGET_CONTENT_TRANSITION,
        delay,
      }}
      onClick={handleClick}
      {...props}
    >
      <Calligraph
        animation="smooth"
        initial={false}
        className={cn(widgetPrimaryTextClassName, "text-white/92")}
      >
        {copied ? copiedLabel : idleLabel}
      </Calligraph>

      <span className="relative flex size-4 items-center justify-center">
        <motion.span
          className="absolute inset-0 flex items-center justify-center"
          animate={{
            opacity: copied ? 0 : 1,
            scale: copied ? 0.72 : 1,
          }}
          transition={WIDGET_CONTENT_TRANSITION}
        >
          <ClipboardIcon size={16} color="rgba(255,255,255,0.78)" />
        </motion.span>

        <motion.span
          className="absolute inset-0 flex items-center justify-center"
          animate={{
            opacity: copied ? 1 : 0,
            scale: copied ? 1 : 0.72,
          }}
          transition={WIDGET_CONTENT_TRANSITION}
        >
          <Checkmark1SmallIcon size={16} color="rgba(255,255,255,0.92)" />
        </motion.span>
      </span>
    </motion.button>
  );
}

const WidgetSurface = forwardRef<HTMLDivElement, WidgetSurfaceProps>(function WidgetSurface(
  {
    accent,
    topLeftId,
    bottomLeftId,
    topRightId,
    bottomRightId,
    width,
    topLeft,
    bottomLeft,
    topRight,
    bottomRight,
    className,
    style,
    ...props
  },
  ref
) {
  return (
    <motion.div
      layout
      ref={ref}
      className={cn(
        "pointer-events-auto relative z-10 isolate flex aspect-[3/1.8] overflow-hidden rounded-[20px] p-4 select-none",
        className
      )}
      style={{
        ...getWidgetSurfaceStyle(accent, width),
        ...style,
      }}
      transition={WIDGET_SHELL_TRANSITION}
      {...props}
    >
      <motion.div
        layout
        className="relative flex h-full w-full justify-between"
        transition={WIDGET_SHELL_TRANSITION}
      >
        <motion.div
          layout="position"
          className="flex h-full min-w-0 flex-col justify-between"
          transition={WIDGET_SHELL_TRANSITION}
        >
          <motion.div
            layout="position"
            layoutId={topLeftId}
            className="flex min-h-[30px] items-center"
            transition={WIDGET_SHELL_TRANSITION}
          >
            {topLeft}
          </motion.div>

          <motion.div
            layout="position"
            layoutId={bottomLeftId}
            className="flex min-h-0 flex-col gap-0.5"
            transition={WIDGET_SHELL_TRANSITION}
          >
            {bottomLeft}
          </motion.div>
        </motion.div>

        <motion.div
          layout="position"
          className="flex h-full min-w-0 flex-col items-end justify-between"
          transition={WIDGET_SHELL_TRANSITION}
        >
          <motion.div
            layout="position"
            layoutId={topRightId}
            className="flex min-h-[28px] min-w-0 items-center justify-end"
            transition={WIDGET_SHELL_TRANSITION}
          >
            {topRight}
          </motion.div>

          <motion.div
            layout="position"
            layoutId={bottomRightId}
            className="flex min-h-[32px] min-w-0 items-end justify-end"
            transition={WIDGET_SHELL_TRANSITION}
          >
            {bottomRight}
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

export function WidgetShell({
  accent,
  className,
  compactWidth = 280,
  dialogTitle,
  isOpen,
  layoutId,
  onOpenChange,
  panel,
  expandedWidth = "min(400px, calc(100vw - 32px))",
  compactTopLeft,
  compactBottomLeft,
  compactTopRight,
  compactBottomRight,
  expandedTopLeft,
  expandedBottomLeft,
  expandedTopRight,
  expandedBottomRight,
  ...props
}: WidgetShellProps) {
  const shellId = `${layoutId}-shell`;
  const topLeftId = `${layoutId}-top-left`;
  const bottomLeftId = `${layoutId}-bottom-left`;
  const topRightId = `${layoutId}-top-right`;
  const bottomRightId = `${layoutId}-bottom-right`;

  return (
    <div className={cn(widgetFrameClassName, isOpen && "z-50", className)} {...props}>
      <div className="relative z-10 flex h-[384px] w-full items-center justify-center">
        <MotionConfig transition={WIDGET_SHELL_TRANSITION}>
          <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <AnimatePresence initial={false}>
              {!isOpen && (
                <Dialog.Trigger
                  nativeButton={false}
                  render={
                    <WidgetSurface
                      accent={accent}
                      layoutId={shellId}
                      width={compactWidth}
                      topLeftId={topLeftId}
                      bottomLeftId={bottomLeftId}
                      topRightId={topRightId}
                      bottomRightId={bottomRightId}
                      topLeft={compactTopLeft}
                      bottomLeft={compactBottomLeft}
                      topRight={compactTopRight}
                      bottomRight={compactBottomRight}
                      style={{ cursor: "pointer" }}
                    />
                  }
                />
              )}
            </AnimatePresence>

            <Dialog.Portal keepMounted>
              <Dialog.Backdrop
                forceRender
                render={
                  <motion.div
                    initial={false}
                    animate={{ opacity: isOpen ? 1 : 0 }}
                    transition={WIDGET_OVERLAY_TRANSITION}
                    className="fixed inset-0 z-[2147483646] bg-background/20 backdrop-blur-[12px] dark:bg-background/38"
                    style={{
                      pointerEvents: isOpen ? "auto" : "none",
                      willChange: "opacity",
                    }}
                  />
                }
              />

              <Dialog.Title className="sr-only">{dialogTitle}</Dialog.Title>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <Dialog.Popup
                    className={widgetPopupClassName}
                    render={<motion.div layoutRoot />}
                  >
                    <AnimatePresence initial={false}>{panel}</AnimatePresence>

                    <WidgetSurface
                      accent={accent}
                      layoutId={shellId}
                      topLeftId={topLeftId}
                      bottomLeftId={bottomLeftId}
                      topRightId={topRightId}
                      bottomRightId={bottomRightId}
                      width={expandedWidth}
                      topLeft={expandedTopLeft ?? compactTopLeft}
                      bottomLeft={expandedBottomLeft ?? compactBottomLeft}
                      topRight={expandedTopRight ?? compactTopRight}
                      bottomRight={expandedBottomRight ?? compactBottomRight}
                    />
                  </Dialog.Popup>
                )}
              </AnimatePresence>
            </Dialog.Portal>
          </Dialog.Root>
        </MotionConfig>
      </div>
    </div>
  );
}
