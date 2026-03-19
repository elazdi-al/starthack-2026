"use client";

import * as React from "react";
import { Calligraph, type CalligraphProps } from "calligraph";
import { useReducedAnimations } from "@/lib/use-animation-config";

const DEFAULT_DEBOUNCE_MS = 72;
const DIGIT_PATTERN = /\d/;

export function useDebouncedDisplayValue<T>(value: T, delay = DEFAULT_DEBOUNCE_MS) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  const latestValueRef = React.useRef(value);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    if (Object.is(value, debouncedValue)) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    if (delay <= 0) {
      setDebouncedValue(value);
      return;
    }

    if (timeoutRef.current !== null) {
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setDebouncedValue(latestValueRef.current);
    }, delay);
  }, [debouncedValue, delay, value]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedValue;
}

interface AnimatedParameterValueProps
  extends Omit<React.ComponentPropsWithoutRef<"span">, "children"> {
  value: string | number;
  debounceMs?: number;
  variant?: CalligraphProps["variant"];
  animation?: CalligraphProps["animation"];
  autoSize?: boolean;
}

export const AnimatedParameterValue = React.memo(function AnimatedParameterValue({
  value,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  variant,
  animation,
  autoSize = false,
  ...props
}: AnimatedParameterValueProps) {
  const reduced = useReducedAnimations();
  const debouncedValue = useDebouncedDisplayValue(String(value), debounceMs);

  // When animations are reduced, render a plain span instead of the
  // spring-driven Calligraph character transitions.
  if (reduced) {
    return <span {...props}>{debouncedValue}</span>;
  }

  const resolvedVariant = variant ?? (DIGIT_PATTERN.test(debouncedValue) ? "number" : "text");
  const resolvedAnimation = animation ?? (resolvedVariant === "text" ? "smooth" : "snappy");

  return (
    <Calligraph
      {...props}
      initial={false}
      autoSize={autoSize}
      variant={resolvedVariant}
      animation={resolvedAnimation}
    >
      {debouncedValue}
    </Calligraph>
  );
});
