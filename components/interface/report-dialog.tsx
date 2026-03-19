"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { cn } from "@/lib/utils";
import { useAnimationConfig } from "@/lib/use-animation-config";
import type { ReportItem } from "@/lib/reports-store";

// ─── Markdown processor (singleton) ──────────────────────────────────────────

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

function useRenderedMarkdown(markdown: string) {
  const [html, setHtml] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    processor.process(markdown).then((file) => {
      if (!cancelled) setHtml(String(file));
    });
    return () => {
      cancelled = true;
    };
  }, [markdown]);
  return html;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ReportDialogProps {
  report: ReportItem | null;
  open: boolean;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportDialog({ report, open, onClose }: ReportDialogProps) {
  const anim = useAnimationConfig();
  const html = useRenderedMarkdown(report?.markdown ?? "");

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal keepMounted>
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <Dialog.Backdrop
                render={
                  <motion.div
                    initial={anim.enabled ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    exit={anim.enabled ? { opacity: 0 } : undefined}
                    transition={anim.enabled ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] } : anim.instant}
                    className="fixed inset-0 z-9998 bg-white/60 dark:bg-black/60 backdrop-blur-2xl"
                  />
                }
              />

              {/* Popup */}
              <Dialog.Popup
                render={
                  <motion.div
                    initial={anim.enabled ? { opacity: 0, scale: 0.96, y: 12 } : false}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={anim.enabled ? { opacity: 0, scale: 0.96, y: 12 } : undefined}
                    transition={anim.enabled ? { duration: 0.3, ease: [0.22, 1, 0.36, 1] } : anim.instant}
                  />
                }
                className="fixed inset-0 z-9999 flex items-center justify-center p-6 pointer-events-none outline-none"
              >
                <div
                  className={cn(
                    "pointer-events-auto relative flex w-full max-w-[760px] rounded-2xl overflow-hidden",
                    "border border-black/6 dark:border-white/10 bg-white dark:bg-[#1a1a1a]",
                    "shadow-[0_32px_80px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.5)]",
                  )}
                  style={{ height: "min(85vh, 720px)" }}
                >
                  <Dialog.Title className="sr-only">
                    {report?.title ?? "Report"}
                  </Dialog.Title>

                  {/* ── Markdown viewer ─────────────────────────────── */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {/* Toolbar */}
                    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-black/5 dark:border-white/6">
                      <div className="min-w-0">
                        <h2 className="type-ui font-medium text-foreground truncate">
                          {report?.title}
                        </h2>
                        <p className="type-caption text-[var(--dial-text-tertiary)] truncate">
                          {report?.subtitle}
                        </p>
                      </div>

                      {/* Close */}
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex h-[30px] w-[30px] shrink-0 ml-3 items-center justify-center rounded-full bg-black/4 dark:bg-white/6 hover:bg-black/8 dark:hover:bg-white/10 transition-colors"
                        aria-label="Close"
                      >
                        <X size={13} weight="bold" className="text-black/40 dark:text-white/40" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-none">
                      <article
                        className="report-markdown"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    </div>
                  </div>
                </div>
              </Dialog.Popup>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
