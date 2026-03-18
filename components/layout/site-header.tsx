"use client";

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

function ThemeSunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>Sun</title>
      <path
        d="M13 2C13 1.44772 12.5523 1 12 1C11.4477 1 11 1.44772 11 2V3C11 3.55228 11.4477 4 12 4C12.5523 4 13 3.55228 13 3V2Z"
        fill="currentColor"
      />
      <path
        d="M13 21C13 20.4477 12.5523 20 12 20C11.4477 20 11 20.4477 11 21V22C11 22.5523 11.4477 23 12 23C12.5523 23 13 22.5523 13 22V21Z"
        fill="currentColor"
      />
      <path
        d="M19.777 4.22295C20.1675 4.61347 20.1675 5.24664 19.777 5.63716L19.0669 6.34716C18.6764 6.73768 18.0433 6.73768 17.6527 6.34716C17.2622 5.95664 17.2622 5.32347 17.6527 4.93295L18.3627 4.22295C18.7533 3.83242 19.3864 3.83242 19.777 4.22295Z"
        fill="currentColor"
      />
      <path
        d="M6.34726 19.0671C6.73779 18.6766 6.73779 18.0434 6.34726 17.6529C5.95674 17.2624 5.32357 17.2624 4.93305 17.6529L4.22305 18.3629C3.83253 18.7534 3.83253 19.3866 4.22305 19.7771C4.61357 20.1676 5.24674 20.1676 5.63726 19.7771L6.34726 19.0671Z"
        fill="currentColor"
      />
      <path
        d="M20 12C20 11.4477 20.4477 11 21 11H22C22.5523 11 23 11.4477 23 12C23 12.5523 22.5523 13 22 13H21C20.4477 13 20 12.5523 20 12Z"
        fill="currentColor"
      />
      <path
        d="M2 11C1.44772 11 1 11.4477 1 12C1 12.5523 1.44772 13 2 13H3C3.55228 13 4 12.5523 4 12C4 11.4477 3.55228 11 3 11H2Z"
        fill="currentColor"
      />
      <path
        d="M17.6527 17.6529C18.0433 17.2624 18.6764 17.2624 19.0669 17.6529L19.777 18.3629C20.1675 18.7534 20.1675 19.3866 19.777 19.7771C19.3864 20.1676 18.7533 20.1676 18.3627 19.7771L17.6527 19.0671C17.2622 18.6766 17.2622 18.0434 17.6527 17.6529Z"
        fill="currentColor"
      />
      <path
        d="M5.63726 4.22295C5.24674 3.83242 4.61357 3.83242 4.22305 4.22295C3.83253 4.61347 3.83253 5.24664 4.22305 5.63716L4.93305 6.34716C5.32357 6.73768 5.95674 6.73768 6.34726 6.34716C6.73779 5.95664 6.73779 5.32347 6.34726 4.93295L5.63726 4.22295Z"
        fill="currentColor"
      />
      <path
        d="M7.75736 7.75736C10.1005 5.41421 13.8995 5.41421 16.2426 7.75736C18.5858 10.1005 18.5858 13.8995 16.2426 16.2426C13.8995 18.5858 10.1005 18.5858 7.75736 16.2426C5.41421 13.8995 5.41421 10.1005 7.75736 7.75736Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ThemeMoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>Moon</title>
      <path
        d="M12.0517 3.59971C12.2712 3.28123 12.2873 2.86472 12.0931 2.53021C11.8989 2.19569 11.5292 2.00315 11.1438 2.03581C6.0214 2.46985 2 6.76372 2 11.9979C2 17.5197 6.47632 21.996 11.9981 21.996C17.2324 21.996 21.5264 17.9745 21.9602 12.8519C21.9929 12.4664 21.8003 12.0968 21.4658 11.9026C21.1313 11.7084 20.7148 11.7246 20.3963 11.9441C19.4302 12.61 18.2602 12.9998 16.9961 12.9998C13.6824 12.9998 10.9961 10.3135 10.9961 6.99976C10.9961 5.73577 11.3858 4.56582 12.0517 3.59971Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
                  {theme === "dark" ? <ThemeMoonIcon /> : <ThemeSunIcon />}
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
