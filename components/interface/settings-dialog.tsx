"use client"

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { AnimatePresence, motion } from "motion/react"
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
  useSettingsStore,
  type TempUnit,
  type TimeFormat,
} from "@/lib/settings-store"

type Section = "appearance" | "display"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = React.useState<Section>("appearance")

  const handleClose = () => onOpenChange(false)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal keepMounted>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Backdrop
                render={
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed inset-0 z-9998 bg-white/60 dark:bg-black/60 backdrop-blur-2xl"
                    style={{ willChange: "opacity" }}
                  />
                }
              />

              <Dialog.Popup
                render={
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 8 }}
                    transition={{
                      duration: 0.28,
                      ease: [0.22, 1, 0.36, 1],
                    }}
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
                            onClick={() => setActiveSection("appearance")}
                          />
                          <NavItem
                            icon={Monitor}
                            label="Display"
                            active={activeSection === "display"}
                            onClick={() => setActiveSection("display")}
                          />
                        </nav>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                      <AnimatePresence mode="wait">
                        {activeSection === "appearance" && (
                          <AppearanceSection key="appearance" />
                        )}
                        {activeSection === "display" && (
                          <DisplaySection key="display" />
                        )}
                      </AnimatePresence>
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

function NavItem({
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
  return (
    <button
      type="button"
      onClick={() => {
        onClick()
        triggerHaptic("selection")
      }}
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
}

function SectionShell({
  children,
}: {
  children: React.ReactNode
}) {
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

function SectionHeader({
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
}

function SettingRow({
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
}

function AppearanceSection() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <SectionShell>
      <SectionHeader
        title="Appearance"
        description="Customize the look and feel"
      />

      <div className="space-y-2">
        <p className="type-caption text-[var(--dial-text-label)] mb-3">
          Theme
        </p>

        <div className="grid grid-cols-2 gap-3">
          <ThemeCard
            id="light"
            label="Light"
            active={theme === "light"}
            onClick={() => setTheme("light")}
            preview={
              <div className="w-full h-full rounded-md bg-[#f8f8f8] border border-black/6 flex flex-col items-center justify-center gap-1.5">
                <Sun size={16} weight="fill" className="text-amber-500" />
                <span className="text-[10px] font-medium text-black/40">Aa</span>
              </div>
            }
          />
          <ThemeCard
            id="dark"
            label="Dark"
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            preview={
              <div className="w-full h-full rounded-md bg-[#1a1a1a] border border-white/8 flex flex-col items-center justify-center gap-1.5">
                <Moon size={16} weight="fill" className="text-indigo-300" />
                <span className="text-[10px] font-medium text-white/35">Aa</span>
              </div>
            }
          />
        </div>
      </div>
    </SectionShell>
  )
}

function ThemeCard({
  id,
  label,
  active,
  onClick,
  preview,
}: {
  id: string
  label: string
  active: boolean
  onClick: () => void
  preview: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        onClick()
        triggerHaptic("selection")
      }}
      className={cn(
        "relative rounded-xl border-2 p-3 transition-colors cursor-pointer",
        active
          ? "border-[#6B97FF]"
          : "border-black/6 dark:border-white/8 hover:border-black/12 dark:hover:border-white/16"
      )}
      whileTap={{ scale: 0.98 }}
    >
      <div className="w-full h-20 mb-2.5">
        {preview}
      </div>
      <span className="type-caption text-foreground">{label}</span>
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
    </motion.button>
  )
}

function DisplaySection() {
  const tempUnit = useSettingsStore((s) => s.tempUnit)
  const setTempUnit = useSettingsStore((s) => s.setTempUnit)
  const timeFormat = useSettingsStore((s) => s.timeFormat)
  const setTimeFormat = useSettingsStore((s) => s.setTimeFormat)

  return (
    <SectionShell>
      <SectionHeader
        title="Display"
        description="Configure units and formatting"
      />

      <div className="divide-y divide-black/5 dark:divide-white/6">
        <SettingRow
          label="Temperature"
          description="Unit for temperature readings"
        >
          <TogglePill
            id="temp-unit"
            options={[
              { value: "celsius", label: "°C" },
              { value: "fahrenheit", label: "°F" },
            ]}
            value={tempUnit}
            onChange={(v) => setTempUnit(v as TempUnit)}
          />
        </SettingRow>

        <SettingRow
          label="Time Format"
          description="Clock display format"
        >
          <TogglePill
            id="time-format"
            options={[
              { value: "24h", label: "24h" },
              { value: "12h", label: "12h" },
            ]}
            value={timeFormat}
            onChange={(v) => setTimeFormat(v as TimeFormat)}
          />
        </SettingRow>
      </div>
    </SectionShell>
  )
}

function TogglePill({
  id,
  options,
  value,
  onChange,
}: {
  id: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
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
              <motion.span
                layoutId={`settings-pill-${id}`}
                className="absolute inset-0 rounded-full border border-[var(--dial-border)] bg-[var(--card)] shadow-sm"
                transition={{
                  type: "spring",
                  duration: 0.35,
                  bounce: 0.15,
                }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
