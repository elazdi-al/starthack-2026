"use client"

import * as React from "react"
import { Dialog } from "@base-ui/react/dialog"
import { AnimatePresence, motion } from "motion/react"
import {
  X,
  Check,
  Copy,
  Plugs,
} from "@phosphor-icons/react"

import { triggerHaptic } from "@/lib/haptics"
import { useAnimationConfig } from "@/lib/use-animation-config"

interface McpSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Returns the MCP endpoint URL. Uses the current browser origin so the
 * config works in dev (localhost:3000) and in production.
 */
function getMcpUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/mcp`
  }
  return "http://localhost:3000/api/mcp"
}

function makeConfig(): string {
  const url = getMcpUrl()
  return JSON.stringify(
    { mcpServers: { "mars-greenhouse": { type: "url", url } } },
    null,
    2
  )
}

/* ─── Main Dialog ─────────────────────────────────────────────────────────────── */

export function McpSetupDialog({ open, onOpenChange }: McpSetupDialogProps) {
  const anim = useAnimationConfig()

  const handleClose = React.useCallback(() => {
    triggerHaptic("soft")
    onOpenChange(false)
  }, [onOpenChange])

  const json = makeConfig()
  const mcpUrl = getMcpUrl()

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
                    transition={
                      anim.enabled
                        ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
                        : anim.instant
                    }
                    className="fixed inset-0 z-9998 bg-white/60 dark:bg-black/60 backdrop-blur-2xl"
                    style={{ willChange: anim.enabled ? "opacity" : undefined }}
                  />
                }
              />

              <Dialog.Popup
                render={
                  <motion.div
                    initial={
                      anim.enabled
                        ? { opacity: 0, scale: 0.97, y: 8 }
                        : false
                    }
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={
                      anim.enabled
                        ? { opacity: 0, scale: 0.97, y: 8 }
                        : undefined
                    }
                    transition={
                      anim.enabled
                        ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
                        : anim.instant
                    }
                  />
                }
                className="fixed inset-0 z-9999 flex items-center justify-center p-8 pointer-events-none outline-none"
              >
                <div className="pointer-events-auto relative w-full max-w-[480px] rounded-2xl border border-black/6 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-[0_32px_80px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.4)] overflow-hidden">
                  <Dialog.Title className="sr-only">
                    Setup MCP Server
                  </Dialog.Title>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-black/4 dark:bg-white/8 hover:bg-black/8 dark:hover:bg-white/14 transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X
                      size={12}
                      weight="bold"
                      className="text-black/40 dark:text-white/40"
                    />
                  </button>

                  <div className="p-6 overflow-y-auto max-h-[80vh]">
                    <div className="flex items-center gap-2 mb-5">
                      <Plugs
                        size={15}
                        weight="fill"
                        className="text-foreground shrink-0"
                      />
                      <h2 className="type-ui text-foreground">
                        Setup MCP
                      </h2>
                    </div>

                    <p className="type-caption text-[var(--dial-text-label)] mb-5">
                      Add this configuration to your MCP client to connect.
                    </p>

                    {/* Steps */}
                    <div className="space-y-4">
                      <StepItem number={1}>
                        <p className="type-label text-foreground">
                          Open your MCP configuration file
                        </p>
                        <p className="type-caption text-[var(--dial-text-tertiary)] mt-0.5">
                          e.g.{" "}
                          <code className="px-1.5 py-0.5 rounded-md bg-black/4 dark:bg-white/8 type-caption font-mono">
                            mcp.json
                          </code>
                        </p>
                      </StepItem>

                      <StepItem number={2}>
                        <p className="type-label text-foreground mb-2">
                          Add the MCP server configuration
                        </p>
                        <ConfigBlock value={json} />
                      </StepItem>

                      <StepItem number={3}>
                        <p className="type-label text-foreground">
                          Restart your application
                        </p>
                        <p className="type-caption text-[var(--dial-text-tertiary)] mt-0.5">
                          The MCP server will be available as{" "}
                          <code className="px-1.5 py-0.5 rounded-md bg-black/4 dark:bg-white/8 type-caption font-mono">
                            mars-greenhouse
                          </code>
                        </p>
                      </StepItem>
                    </div>

                    {/* Endpoint reference */}
                    <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/6">
                      <p className="type-caption text-[var(--dial-text-tertiary)] mb-1.5">
                        MCP Endpoint
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded-lg bg-black/3 dark:bg-white/6 type-caption font-mono text-[var(--dial-text-secondary)]">
                          {mcpUrl}
                        </code>
                        <CopyBtn value={mcpUrl} />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/6">
                      <p className="type-caption text-[var(--dial-text-tertiary)] leading-relaxed">
                        Powered by Amazon Bedrock AgentCore
                      </p>
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

/* ─── Step Item ───────────────────────────────────────────────────────────────── */

function StepItem({
  number,
  children,
}: {
  number: number
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="flex items-center justify-center w-5 h-5 mt-0.5 rounded-full bg-black/5 dark:bg-white/8 shrink-0">
        <span className="type-caption text-[var(--dial-text-label)] font-medium" style={{ fontSize: "10px" }}>
          {number}
        </span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

/* ─── Config Block ────────────────────────────────────────────────────────────── */

function ConfigBlock({ value }: { value: string }) {
  return (
    <div className="relative rounded-lg border border-black/5 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.03] overflow-hidden">
      <div className="absolute top-2 right-2">
        <CopyBtn value={value} />
      </div>
      <pre className="p-3 pr-10 text-[12px] leading-relaxed font-mono text-[var(--dial-text-secondary)] overflow-x-auto scrollbar-none">
        {value}
      </pre>
    </div>
  )
}

/* ─── Copy Button ─────────────────────────────────────────────────────────────── */

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)
  const timeoutRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      triggerHaptic("success")
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      triggerHaptic("error")
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center justify-center w-6 h-6 rounded-md bg-black/4 dark:bg-white/8 hover:bg-black/8 dark:hover:bg-white/14 transition-colors cursor-pointer"
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? (
        <Check
          size={12}
          weight="bold"
          className="text-emerald-500"
        />
      ) : (
        <Copy
          size={12}
          weight="bold"
          className="text-black/40 dark:text-white/40"
        />
      )}
    </button>
  )
}
