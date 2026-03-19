"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface HighlightTabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hiddenOnMobile?: boolean;
}

interface HighlightTabsProps {
  items: HighlightTabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

function HighlightTabs({ items, defaultValue, value, onValueChange, className }: HighlightTabsProps) {
  const firstItem = items[0]?.value;
  const [internalTab, setInternalTab] = useState(defaultValue ?? firstItem);
  const activeTab = value ?? internalTab;
  const [clipPath, setClipPath] = useState("inset(0px 100% 0px 0px round 17px)");
  const listRef = useRef<HTMLDivElement>(null);
  const resolvedActiveTab = items.some((item) => item.value === activeTab)
    ? activeTab
    : defaultValue ?? firstItem;

  const handleValueChange = (next: string) => {
    setInternalTab(next);
    onValueChange?.(next);
  };

  useLayoutEffect(() => {
    const updateClipPath = () => {
      const list = listRef.current;
      if (!list || !resolvedActiveTab) return;

      const escapedValue =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(resolvedActiveTab)
          : resolvedActiveTab;
      const activeButton = list.querySelector(
        `[data-highlight-tab="${escapedValue}"]`
      ) as HTMLElement | null;

      if (!activeButton || activeButton.offsetWidth === 0) return;

      const listRect = list.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      if (!listRect.width || !buttonRect.width) return;

      const left =
        ((buttonRect.left - listRect.left) / listRect.width) * 100;
      const right =
        100 -
        ((buttonRect.right - listRect.left) / listRect.width) * 100;

      setClipPath(
        `inset(0px ${right.toFixed(2)}% 0px ${left.toFixed(2)}% round 17px)`
      );
    };

    updateClipPath();

    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateClipPath);
    observer.observe(list);

    return () => observer.disconnect();
  }, [resolvedActiveTab]);

  if (!items.length || !resolvedActiveTab) {
    return null;
  }

  const triggerDuration = "0.15s";
  const clipPathDuration = "0.25s";
  const triggerClassName =
    "type-label relative flex h-[34px] items-center gap-2 rounded-full border-none px-4 whitespace-nowrap no-underline shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2090FF]/35 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

  return (
    <div
      className={cn(
        "relative flex w-fit items-center justify-center rounded-full bg-[var(--highlight-tabs-bg)] p-1",
        className
      )}
    >
      <Tabs
        value={resolvedActiveTab}
        onValueChange={handleValueChange}
        className="relative items-center gap-0"
      >
        <div ref={listRef} className="relative flex w-fit items-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 rounded-full bg-[var(--highlight-tabs-active)]"
            style={{
              clipPath,
              transitionProperty: "clip-path",
              transitionDuration: clipPathDuration,
              transitionTimingFunction: "ease",
            }}
          />

          <TabsList
            variant="highlight"
            className="relative z-10 flex h-[34px] min-h-[34px] w-full justify-center bg-transparent p-0 text-inherit"
          >
            {items.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                data-highlight-tab={item.value}
                className={cn(
                  triggerClassName,
                  "z-10 text-[var(--highlight-tabs-text)] hover:text-[var(--dial-text-primary)] data-active:text-[var(--highlight-tabs-active-foreground)]",
                  item.hiddenOnMobile && "hidden md:flex"
                )}
                style={{ transitionDuration: triggerDuration }}
              >
                {item.icon}
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
    </div>
  );
}

export { HighlightTabs, HighlightTabs as ClipPathTabs };
export type {
  HighlightTabItem,
  HighlightTabsProps,
  HighlightTabItem as ClipPathTabItem,
  HighlightTabsProps as ClipPathTabsProps,
};
