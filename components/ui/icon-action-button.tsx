"use client";

import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { animate } from "motion";
import {
  AnimatePresence,
  motion,
  type HTMLMotionProps,
} from "motion/react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useReducedAnimations } from "@/lib/use-animation-config";

type IconActionButtonBehavior = "toggle" | "confirm" | "delete";

interface IconActionButtonProps
  extends Omit<
    HTMLMotionProps<"button">,
    "onPointerDown" | "onPointerLeave" | "onPointerUp" | "onPointerCancel"
  > {
  label: string;
  color: "orange" | "blue" | "red" | "green" | "purple";
  icon: ReactNode;
  activeIcon?: ReactNode;
  behavior?: IconActionButtonBehavior;
  onAction?: () => void;
}

type InternalIconActionButtonProps = Omit<IconActionButtonProps, "behavior">;

const colorMap = {
  orange: {
    bg: "bg-orange-500/10",
    solid: "bg-orange-500",
    text: "text-orange-500",
  },
  blue: {
    bg: "bg-blue-500/10",
    solid: "bg-blue-500",
    text: "text-blue-500",
  },
  red: {
    bg: "bg-red-500/10",
    solid: "bg-red-500",
    text: "text-red-500",
  },
  green: {
    bg: "bg-green-500/10",
    solid: "bg-green-500",
    text: "text-green-500",
  },
  purple: {
    bg: "bg-purple-500/10",
    solid: "bg-purple-500",
    text: "text-purple-500",
  },
} as const;

const buttonTransition = { type: "spring", duration: 0.35, bounce: 0 } as const;
const whileTap = { scale: 0.97 } as const;

function Spinner({
  className,
  width = 24,
  height = 24,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  const shouldReduceMotion = useReducedAnimations();

  return (
    <motion.svg
      animate={shouldReduceMotion ? {} : { rotate: 1080 }}
      aria-hidden="true"
      className={cn(className, !shouldReduceMotion && "will-change-transform")}
      fill="currentColor"
      height={height}
      role="graphics-symbol"
      transition={
        shouldReduceMotion
          ? {}
          : {
              repeat: Infinity,
              duration: 1,
              ease: [0.1, 0.21, 0.355, 0.68],
              repeatType: "loop",
            }
      }
      viewBox="0 0 24 24"
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
        opacity=".25"
      />
      <path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" />
    </motion.svg>
  );
}

function IconWrapper({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return <span className={cn("inline-flex", className)}>{children}</span>;
}

function ToggleButton({
  className,
  color,
  icon,
  activeIcon,
  label,
  onAction,
  style,
  ...props
}: InternalIconActionButtonProps) {
  const colors = colorMap[color];
  const [toggled, setToggled] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animatedIconRef = useRef<HTMLSpanElement | null>(null);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const clearToggleTimer = () => {
    if (toggleTimerRef.current) {
      clearTimeout(toggleTimerRef.current);
      toggleTimerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    clearHoldTimer();
    clearToggleTimer();
    setPressing(true);
    setCompleted(false);
    setTransitioning(false);

    holdTimerRef.current = setTimeout(() => {
      setCompleted(true);

      if (animatedIconRef.current) {
        animate(
          animatedIconRef.current,
          { rotate: [0, -16, 16, -16, 16, -8, 8, 0] },
          { duration: 0.5, ease: "easeOut" }
        );
      }
    }, 1000);
  };

  const handlePointerUp = () => {
    clearHoldTimer();
    setPressing(false);
    setCompleted(false);

    if (!completed) {
      return;
    }

    setTransitioning(true);
    toggleTimerRef.current = setTimeout(() => {
      setToggled((value) => {
        const nextValue = !value;
        triggerHaptic(nextValue ? "success" : "selection");
        return nextValue;
      });
      setTransitioning(false);
      onAction?.();
    }, 300);
  };

  const handlePointerLeave = () => {
    clearHoldTimer();
    setPressing(false);
    setCompleted(false);
  };

  useEffect(() => {
    return () => {
      clearHoldTimer();
      clearToggleTimer();
    };
  }, []);

  const baseIcon = (transitioning ? !toggled : toggled) ? activeIcon ?? icon : icon;
  const overlayIcon = toggled ? icon : activeIcon ?? icon;
  const buttonLabel = toggled ? "Enable notifications" : label;
  const overlayClassName = cn(
    "absolute flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-full p-3 will-change-[clip-path]",
    colors.solid,
    pressing ? "duration-1000 ease-linear" : "duration-300 ease-out"
  );

  return (
    <motion.button
      aria-label={buttonLabel}
      className={cn(
        "relative flex shrink-0 cursor-pointer touch-manipulation flex-col items-center justify-center gap-1 rounded-full p-3 will-change-transform",
        colors.bg,
        className
      )}
      onPointerCancel={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerUp}
      style={{ WebkitTapHighlightColor: "transparent", ...style }}
      transition={buttonTransition}
      type="button"
      whileTap={whileTap}
      {...props}
    >
      <div
        aria-hidden="true"
        className={overlayClassName}
        style={{
          clipPath: pressing ? "inset(0px 0px 0px 0px)" : "inset(100% 0px 0px 0px)",
          transitionProperty: "clip-path",
        }}
      >
        <IconWrapper
          className="size-10 select-none text-white will-change-transform [&_.ui-icon]:filter-none [&_.ui-icon]:transform-none [&_svg]:size-10"
        >
          <span ref={animatedIconRef} className="inline-flex [&_.ui-icon]:filter-none [&_.ui-icon]:transform-none [&_svg]:size-10">
            {overlayIcon}
          </span>
        </IconWrapper>
      </div>
      <IconWrapper
        className={cn(
          "size-10 select-none [&_.ui-icon]:filter-none [&_.ui-icon]:transform-none [&_svg]:size-10",
          colors.text
        )}
      >
        {baseIcon}
      </IconWrapper>
    </motion.button>
  );
}

function ConfirmButton({
  className,
  color,
  icon,
  activeIcon,
  label,
  onAction,
  style,
  ...props
}: InternalIconActionButtonProps) {
  const colors = colorMap[color];
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = (timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    clearTimer(holdTimerRef);
    clearTimer(loadingTimerRef);
    clearTimer(finishTimerRef);
    setRevealed(true);
    setLoading(false);

    holdTimerRef.current = setTimeout(() => {
      setLoading(true);
      loadingTimerRef.current = setTimeout(() => {
        setLoading(false);
        finishTimerRef.current = setTimeout(() => {
          setRevealed(false);
          triggerHaptic("success");
          onAction?.();
        }, 1000);
      }, 2000);
    }, 1000);
  };

  const handleCancel = () => {
    if (loading) {
      return;
    }

    clearTimer(holdTimerRef);
    clearTimer(finishTimerRef);
    setRevealed(false);
  };

  useEffect(() => {
    return () => {
      clearTimer(holdTimerRef);
      clearTimer(loadingTimerRef);
      clearTimer(finishTimerRef);
    };
  }, []);

  const overlayClassName = cn(
    "absolute flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-full p-3 will-change-[clip-path]",
    colors.solid,
    revealed || loading ? "duration-1000 ease-linear" : "duration-400 ease-out"
  );

  return (
    <motion.button
      aria-label={label}
      className={cn(
        "relative flex shrink-0 cursor-pointer touch-manipulation flex-col items-center justify-center gap-1 rounded-full p-3 will-change-transform",
        colors.bg,
        className
      )}
      onPointerCancel={handleCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={handleCancel}
      onPointerUp={handleCancel}
      style={{ WebkitTapHighlightColor: "transparent", ...style }}
      transition={buttonTransition}
      type="button"
      whileTap={whileTap}
      {...props}
    >
      <div
        aria-hidden="true"
        className={overlayClassName}
        style={{
          clipPath:
            revealed || loading
              ? "inset(0px 0px 0px 0px)"
              : "inset(100% 0px 0px 0px)",
          transitionProperty: "clip-path",
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {loading ? (
            <motion.div
              key="spinner"
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
              initial={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
              transition={buttonTransition}
            >
              <Spinner className="size-10 fill-white" />
            </motion.div>
          ) : (
            <motion.div
              key="confirm-icon"
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
              initial={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
              transition={buttonTransition}
            >
              <IconWrapper className="size-10 select-none text-white [&_.ui-icon]:filter-none [&_.ui-icon]:transform-none [&_svg]:size-10">
                {activeIcon ?? icon}
              </IconWrapper>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <IconWrapper
        className={cn(
          "size-10 select-none [&_.ui-icon]:filter-none [&_.ui-icon]:transform-none [&_svg]:size-10",
          colors.text
        )}
      >
        {icon}
      </IconWrapper>
    </motion.button>
  );
}

function DeleteButton({
  className,
  color,
  icon,
  activeIcon,
  label,
  onAction,
  style,
  ...props
}: InternalIconActionButtonProps) {
  const colors = colorMap[color];
  const [pressing, setPressing] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    clearHoldTimer();
    setPressing(true);
    holdTimerRef.current = setTimeout(() => {
      setPressing(false);
      triggerHaptic("heavy");
      onAction?.();
    }, 1000);
  };

  const handlePointerLeave = () => {
    clearHoldTimer();
    setPressing(false);
  };

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, []);

  const overlayClassName = cn(
    "absolute flex shrink-0 flex-col items-center justify-center gap-1 rounded-full p-3 will-change-[clip-path]",
    colors.solid,
    pressing ? "duration-1000 ease-linear" : "duration-300 ease-out"
  );

  return (
    <motion.button
      aria-label={label}
      className={cn(
        "relative flex shrink-0 cursor-pointer touch-manipulation flex-col items-center justify-center gap-1 rounded-full p-3 will-change-transform",
        colors.bg,
        className
      )}
      onPointerCancel={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerLeave}
      style={{ WebkitTapHighlightColor: "transparent", ...style }}
      transition={buttonTransition}
      type="button"
      whileTap={whileTap}
      {...props}
    >
      <div
        aria-hidden="true"
        className={overlayClassName}
        style={{
          clipPath: pressing ? "inset(0px 0px 0px 0px)" : "inset(100% 0px 0px 0px)",
          transitionProperty: "clip-path",
        }}
      >
        <IconWrapper className="size-10 select-none text-white [&_.ui-icon]:filter-none [&_.ui-icon]:transform-none [&_svg]:size-10">
          {activeIcon ?? icon}
        </IconWrapper>
      </div>
      <IconWrapper
        className={cn(
          "size-10 select-none [&_.ui-icon]:filter-none [&_.ui-icon]:transform-none [&_svg]:size-10",
          colors.text
        )}
      >
        {icon}
      </IconWrapper>
    </motion.button>
  );
}

export function IconActionButton({
  behavior = "delete",
  ...props
}: IconActionButtonProps) {
  if (behavior === "toggle") {
    return <ToggleButton {...props} />;
  }

  if (behavior === "confirm") {
    return <ConfirmButton {...props} />;
  }

  return <DeleteButton {...props} />;
}

export type { IconActionButtonBehavior, IconActionButtonProps };
