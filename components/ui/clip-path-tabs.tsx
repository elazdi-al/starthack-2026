"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClipPathTabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hiddenOnMobile?: boolean;
}

interface ClipPathTabsProps {
  items: ClipPathTabItem[];
  defaultValue?: string;
  className?: string;
}

function ClipPathTabs({ items, defaultValue, className }: ClipPathTabsProps) {
  const firstItem = items[0]?.value;
  const [activeTab, setActiveTab] = useState(defaultValue ?? firstItem);
  const [clipPathEnabled, setClipPathEnabled] = useState(true);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [clipPath, setClipPath] = useState("inset(0px 100% 0px 0px round 17px)");
  const listRef = useRef<HTMLDivElement>(null);
  const resolvedActiveTab = items.some((item) => item.value === activeTab)
    ? activeTab
    : defaultValue ?? firstItem;

  useLayoutEffect(() => {
    const updateClipPath = () => {
      if (!clipPathEnabled) {
        setClipPath("inset(0px 0% 0px 0% round 17px)");
        return;
      }

      const list = listRef.current;
      if (!list || !resolvedActiveTab) return;

      const escapedValue =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(resolvedActiveTab)
          : resolvedActiveTab;
      const activeButton = list.querySelector(
        `[data-clip-tab="${escapedValue}"]`
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
  }, [clipPathEnabled, resolvedActiveTab]);

  if (!items.length || !resolvedActiveTab) {
    return null;
  }

  const speeds = [
    { label: "1x", factor: 1 },
    { label: "2x", factor: 2 },
    { label: "4x", factor: 4 },
  ] as const;
  const speed = speeds[speedIndex];
  const triggerDuration = `${0.15 * speed.factor}s`;
  const clipPathDuration = `${0.25 * speed.factor}s`;
  const triggerClassName =
    "relative flex h-[34px] items-center gap-2 rounded-full border-none px-4 text-sm font-medium whitespace-nowrap no-underline shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2090FF]/35 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

  return (
    <div
      className={cn(
        "relative flex h-64 w-full items-center justify-center overflow-hidden rounded-xl bg-[#f3f5f7] px-4 py-6",
        className
      )}
    >
      <div className="absolute top-4 right-4 flex">
        <button
          type="button"
          aria-label="Toggle clip path"
          onClick={() => setClipPathEnabled((enabled) => !enabled)}
          className="flex w-fit items-center justify-center overflow-hidden rounded-full px-4 text-xs text-[#5e6775] transition-colors hover:bg-[#dfe4ea] hover:text-[#1a2233] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2090FF]/35"
        >
          Toggle clip path
        </button>
        <button
          type="button"
          aria-label="Change animation speed"
          onClick={() => setSpeedIndex((index) => (index + 1) % speeds.length)}
          className="flex h-5 w-7 items-center justify-center overflow-hidden rounded-full text-xs text-[#5e6775] transition-colors hover:bg-[#dfe4ea] hover:text-[#1a2233] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2090FF]/35"
        >
          <span>{speed.label}</span>
        </button>
      </div>

      <Tabs
        value={resolvedActiveTab}
        onValueChange={setActiveTab}
        className="relative items-center gap-0"
      >
        <div ref={listRef} className="relative flex w-fit flex-col items-center">
          <TabsList
            variant="clipPath"
            className="relative flex w-full justify-center bg-transparent p-0 text-inherit"
          >
            {items.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                data-clip-tab={item.value}
                className={cn(
                  triggerClassName,
                  "text-[#1b2431] hover:text-[#111827]",
                  item.hiddenOnMobile && "hidden md:flex"
                )}
                style={{ transitionDuration: triggerDuration }}
              >
                {item.icon}
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 w-full overflow-hidden"
            style={{
              clipPath,
              transitionProperty: "clip-path",
              transitionDuration: clipPathDuration,
              transitionTimingFunction: "ease",
            }}
          >
            <div className="relative flex w-full justify-center bg-[#2090FF]">
              {items.map((item) => (
                <div
                  key={item.value}
                  className={cn(item.hiddenOnMobile && "hidden md:block")}
                >
                  <div
                    className={cn(
                      "relative flex h-[34px] items-center rounded-full px-4 text-sm font-medium text-[#f8fbff] no-underline",
                      item.hiddenOnMobile && "hidden md:flex"
                    )}
                    style={{ transitionDuration: triggerDuration }}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

export { ClipPathTabs };
export type { ClipPathTabItem, ClipPathTabsProps };
