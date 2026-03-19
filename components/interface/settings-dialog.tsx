"use client"

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { AnimatePresence, motion } from "motion/react"
import { useSyncExternalStore } from "react"
import {
  Check,
  Moon,
  Sun,
  X,
  Palette,
  Monitor,
  type IconWeight,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"
import {
  readSystemThemeSnapshot,
  readThemeSnapshot,
  subscribeToTheme,
} from "@/lib/theme"
import {
  useSettingsStore,
  type TempUnit,
  type TimeFormat,
} from "@/lib/settings-store"
import { useAnimationConfig } from "@/lib/use-animation-config"
import { Switch } from "@/components/ui/switch"

type Section = "appearance" | "display"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = React.useState<Section>("appearance")
  const anim = useAnimationConfig()

  const handleClose = React.useCallback(() => {
    triggerHaptic("soft")
    onOpenChange(false)
  }, [onOpenChange])
  const handleSetAppearance = React.useCallback(() => setActiveSection("appearance"), [])
  const handleSetDisplay = React.useCallback(() => setActiveSection("display"), [])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal keepMounted>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Backdrop
                render={
                  <motion.div
                    initial={anim.enabled ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    exit={anim.enabled ? { opacity: 0 } : undefined}
                    transition={anim.enabled ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] } : anim.instant}
                    className="fixed inset-0 z-9998 bg-white/60 dark:bg-black/60 backdrop-blur-2xl"
                    style={{ willChange: anim.enabled ? "opacity" : undefined }}
                  />
                }
              />

              <Dialog.Popup
                render={
                  <motion.div
                    initial={anim.enabled ? { opacity: 0, scale: 0.97, y: 8 } : false}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={anim.enabled ? { opacity: 0, scale: 0.97, y: 8 } : undefined}
                    transition={anim.enabled ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] } : anim.instant}
                  />
                }
                className="fixed inset-0 z-9999 flex items-center justify-center p-8 pointer-events-none outline-none"
              >
                <div className="pointer-events-auto relative w-full max-w-[680px] h-[460px] rounded-2xl border border-black/6 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-[0_32px_80px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.4)] overflow-hidden">
                  <Dialog.Title className="sr-only">Settings</Dialog.Title>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-black/4 dark:bg-white/8 hover:bg-black/8 dark:hover:bg-white/14 transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X size={12} weight="bold" className="text-black/40 dark:text-white/40" />
                  </button>

                  <div className="flex h-full">
                    {/* Sidebar */}
                    <div className="w-[180px] shrink-0 border-r border-black/5 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col">
                      <div className="p-4 pt-5">
                        <h2 className="type-ui text-foreground mb-5">Settings</h2>

                        <nav className="flex flex-col gap-0.5">
                          <NavItem
                            icon={Palette}
                            label="Appearance"
                            active={activeSection === "appearance"}
                            onClick={handleSetAppearance}
                          />
                          <NavItem
                            icon={Monitor}
                            label="Display"
                            active={activeSection === "display"}
                            onClick={handleSetDisplay}
                          />
                        </nav>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                      {anim.enabled ? (
                        <AnimatePresence mode="wait">
                          {activeSection === "appearance" && (
                            <SectionShell key="appearance">
                              <AppearanceSectionContent />
                            </SectionShell>
                          )}
                          {activeSection === "display" && (
                            <SectionShell key="display">
                              <DisplaySectionContent />
                            </SectionShell>
                          )}
                        </AnimatePresence>
                      ) : (
                        <div className="p-6">
                          {activeSection === "appearance" && <AppearanceSectionContent />}
                          {activeSection === "display" && <DisplaySectionContent />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Dialog.Popup>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ─── Nav ─────────────────────────────────────────────────────────────────────── */

const NavItem = React.memo(function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; weight?: IconWeight; className?: string }>
  label: string
  active: boolean
  onClick: () => void
}) {
  const handleClick = React.useCallback(() => {
    onClick()
    triggerHaptic("selection")
  }, [onClick])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg type-label w-full transition-all cursor-pointer",
        active
          ? "bg-black/6 dark:bg-white/10 text-foreground"
          : "text-[var(--dial-text-label)] hover:bg-black/4 dark:hover:bg-white/6 hover:text-foreground"
      )}
    >
      <Icon size={15} weight={active ? "fill" : "regular"} className="shrink-0" />
      <span>{label}</span>
    </button>
  )
})

/* ─── Layout helpers ──────────────────────────────────────────────────────────── */

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="p-6"
    >
      {children}
    </motion.div>
  )
}

const SectionHeader = React.memo(function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-6">
      <h3 className="type-subtitle text-foreground">{title}</h3>
      <p className="type-caption text-[var(--dial-text-label)] mt-0.5">
        {description}
      </p>
    </div>
  )
})

const SettingRow = React.memo(function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <span className="type-label text-foreground">{label}</span>
        {description && (
          <p className="type-caption text-[var(--dial-text-tertiary)] mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
})

/* ─── Appearance Section ──────────────────────────────────────────────────────── */

function AppearanceSectionContent() {
  const themePreference = useSettingsStore((s) => s.themePreference)
  const setThemePreference = useSettingsStore((s) => s.setThemePreference)
  const anim = useAnimationConfig()
  const systemTheme = useSyncExternalStore(
    subscribeToTheme,
    readSystemThemeSnapshot,
    () => "light"
  )
  const effectiveTheme = useSyncExternalStore(
    subscribeToTheme,
    readThemeSnapshot,
    () => "light"
  )

  const handleSelectLight = React.useCallback(() => setThemePreference("light"), [setThemePreference])
  const handleSelectDark = React.useCallback(() => setThemePreference("dark"), [setThemePreference])
  const handleSelectSystem = React.useCallback(() => setThemePreference("system"), [setThemePreference])

  const lightPreview = React.useMemo(() => (
    <div className="w-full h-full rounded-md bg-[#f8f8f8] border border-black/6 flex flex-col items-center justify-center gap-1.5">
      <Sun size={16} weight="fill" className="text-amber-500" />
      <span className="text-[10px] font-medium text-black/40">Aa</span>
    </div>
  ), [])

  const darkPreview = React.useMemo(() => (
    <div className="w-full h-full rounded-md bg-[#1a1a1a] border border-white/8 flex flex-col items-center justify-center gap-1.5">
      <Moon size={16} weight="fill" className="text-indigo-300" />
      <span className="text-[10px] font-medium text-white/35">Aa</span>
    </div>
  ), [])

  const systemPreview = React.useMemo(() => (
    <div className="w-full h-full rounded-md border border-black/6 bg-[linear-gradient(135deg,#f8f8f8_0%,#f8f8f8_50%,#1a1a1a_50%,#1a1a1a_100%)] dark:border-white/8 flex items-center justify-center">
      <Monitor size={18} weight="fill" className="text-white mix-blend-difference" />
    </div>
  ), [])

  return (
    <>
      <SectionHeader
        title="Appearance"
        description="Choose a fixed theme or follow your operating system"
      />

      <div className="space-y-2">
        <p className="type-caption text-[var(--dial-text-label)] mb-3">
          Theme
        </p>

        <div className="grid grid-cols-3 gap-3">
          <ThemeCard
            label="Light"
            active={themePreference === "light"}
            onClick={handleSelectLight}
            preview={lightPreview}
            animEnabled={anim.enabled}
          />
          <ThemeCard
            label="Dark"
            active={themePreference === "dark"}
            onClick={handleSelectDark}
            preview={darkPreview}
            animEnabled={anim.enabled}
          />
          <ThemeCard
            label="System"
            active={themePreference === "system"}
            onClick={handleSelectSystem}
            preview={systemPreview}
            animEnabled={anim.enabled}
          />
        </div>

       
      </div>
    </>
  )
}

const ThemeCard = React.memo(function ThemeCard({
  label,
  active,
  onClick,
  preview,
  animEnabled,
}: {
  label: string
  active: boolean
  onClick: () => void
  preview: React.ReactNode
  animEnabled: boolean
}) {
  const handleClick = React.useCallback(() => {
    onClick()
    triggerHaptic("selection")
  }, [onClick])

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      className={cn(
        "relative rounded-xl border-2 p-3 transition-colors cursor-pointer",
        active
          ? "border-[#6B97FF]"
          : "border-black/6 dark:border-white/8 hover:border-black/12 dark:hover:border-white/16"
      )}
      whileTap={animEnabled ? { scale: 0.98 } : undefined}
    >
      <div className="w-full h-20 mb-2.5">
        {preview}
      </div>
      <span className="type-caption text-foreground">{label}</span>
      {animEnabled ? (
        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-2 right-2 w-5 h-5 bg-[#6B97FF] rounded-full flex items-center justify-center"
            >
              <Check size={11} weight="bold" className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        active && (
          <div className="absolute bottom-2 right-2 w-5 h-5 bg-[#6B97FF] rounded-full flex items-center justify-center">
            <Check size={11} weight="bold" className="text-white" />
          </div>
        )
      )}
    </motion.button>
  )
})

/* ─── Display Section ─────────────────────────────────────────────────────────── */

function DisplaySectionContent() {
  const tempUnit = useSettingsStore((s) => s.tempUnit)
  const setTempUnit = useSettingsStore((s) => s.setTempUnit)
  const timeFormat = useSettingsStore((s) => s.timeFormat)
  const setTimeFormat = useSettingsStore((s) => s.setTimeFormat)
  const reducedAnimations = useSettingsStore((s) => s.reducedAnimations)
  const setReducedAnimations = useSettingsStore((s) => s.setReducedAnimations)

  const handleTempChange = React.useCallback((v: string) => setTempUnit(v as TempUnit), [setTempUnit])
  const handleTimeChange = React.useCallback((v: string) => setTimeFormat(v as TimeFormat), [setTimeFormat])
  const handleAnimToggle = React.useCallback((checked: boolean) => setReducedAnimations(checked), [setReducedAnimations])

  return (
    <>
      <SectionHeader
        title="Display"
        description="Configure units, formatting, and motion"
      />

      <div className="divide-y divide-black/5 dark:divide-white/6">
        <SettingRow
          label="Temperature"
          description="Unit for temperature readings"
        >
          <TogglePill
            id="temp-unit"
            options={TEMP_OPTIONS}
            value={tempUnit}
            onChange={handleTempChange}
          />
        </SettingRow>

        <SettingRow
          label="Time Format"
          description="Clock display format"
        >
          <TogglePill
            id="time-format"
            options={TIME_OPTIONS}
            value={timeFormat}
            onChange={handleTimeChange}
          />
        </SettingRow>

        <SettingRow
          label="Reduced animations"
          description="Disable transitions and motion effects"
        >
          <Switch
            checked={reducedAnimations}
            onToggle={handleAnimToggle}
          />
        </SettingRow>
      </div>
    </>
  )
}

/** Constant option arrays lifted out of render to avoid re-allocations. */
const TEMP_OPTIONS = [
  { value: "celsius", label: "\u00B0C" },
  { value: "fahrenheit", label: "\u00B0F" },
] as const

const TIME_OPTIONS = [
  { value: "24h", label: "24h" },
  { value: "12h", label: "12h" },
] as const

/* ─── Toggle pill ─────────────────────────────────────────────────────────────── */

const TogglePill = React.memo(function TogglePill({
  id,
  options,
  value,
  onChange,
}: {
  id: string
  options: readonly { readonly value: string; readonly label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const anim = useAnimationConfig()

  return (
    <div className="relative flex rounded-full border border-[var(--dial-border)] bg-[var(--dial-surface)] p-0.5">
      {options.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!isActive) {
                onChange(option.value)
                triggerHaptic("selection")
              }
            }}
            className={cn(
              "relative z-10 flex h-7 items-center justify-center rounded-full px-3 type-caption transition-colors cursor-pointer",
              isActive
                ? "text-foreground"
                : "text-[var(--dial-text-label)] hover:text-[var(--dial-text-secondary)]"
            )}
          >
            {isActive && (
              anim.enabled ? (
                <motion.span
                  layoutId={`settings-pill-${id}`}
                  className="absolute inset-0 rounded-full border border-[var(--dial-border)] bg-[var(--card)] shadow-sm"
                  transition={{
                    type: "spring",
                    duration: 0.35,
                    bounce: 0.15,
                  }}
                />
              ) : (
                <span className="absolute inset-0 rounded-full border border-[var(--dial-border)] bg-[var(--card)] shadow-sm" />
              )
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
})
