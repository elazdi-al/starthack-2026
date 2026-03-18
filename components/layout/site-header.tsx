"use client";

import { ThemeMoonIcon, ThemeSunIcon } from "@/components/icons";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { readThemeSnapshot, setTheme, subscribeToTheme } from "@/lib/theme";

type SiteHeaderLink = {
  href: string;
  label: string;
};

type SiteHeaderProps = {
  links?: SiteHeaderLink[];
  className?: string;
  homeHref?: string;
  homeLabel?: string;
};

function SiteHeader({
  className,
  homeHref = "/",
  homeLabel = "Hackathon",
}: SiteHeaderProps) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readThemeSnapshot,
    () => "dark"
  );
  const nextTheme = theme === "dark" ? "light" : "dark";

  function handleNavigationPress() {
    triggerHaptic("selection");
  }

  function handleThemeToggle() {
    setTheme(nextTheme);
    triggerHaptic("soft");
  }

  return (
    <header className={cn("w-full", className)}>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-8 py-6">
        <Link
          aria-label={homeLabel}
          href={homeHref}
          onClick={handleNavigationPress}
          className="type-subtitle tracking-[-0.02em] text-foreground transition-opacity hover:opacity-70"
        >
          Hackathon
        </Link>

        <nav aria-label="Primary">
          <ul className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
            <li>
              <a
                href="https://github.com/elazdi-al"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub profile for @elazdi-al"
                title="@elazdi-al on GitHub"
                className="type-label text-[var(--dial-text-secondary)] transition-colors hover:text-foreground"
                onClick={handleNavigationPress}
              >
                GitHub
              </a>
            </li>
            <li>
              <button
                type="button"
                aria-label={`Switch to ${nextTheme} theme`}
                title={`Switch to ${nextTheme} theme`}
                onClick={handleThemeToggle}
                className="inline-flex h-8 w-8 appearance-none items-center justify-center rounded-[8px] bg-transparent p-0 text-[var(--dial-text-label)] transition-[color,background-color] duration-200 ease-in-out select-none hover:bg-accent/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <div className="flex items-center justify-center opacity-100 transition-[opacity,filter,transform] duration-200 [filter:blur(0px)] [transform:none]">
                  {theme === "dark" ? (
                    <ThemeMoonIcon size={16} tone="strong" />
                  ) : (
                    <ThemeSunIcon size={16} tone="strong" />
                  )}
                </div>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export { SiteHeader };
export type { SiteHeaderLink };
