"use client";

import * as React from "react";

import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
  preClassName?: string;
}

function CodeBlock({
  code,
  className,
  preClassName,
  ...props
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-stone-50 dark:bg-neutral-800",
        className
      )}
      {...props}
    >
      <CopyButton
        value={code}
        idleLabel="Copy code"
        copiedLabel="Code copied"
        className="absolute right-3 top-3"
      />
      <pre
        className={cn(
          "overflow-auto p-4 pr-14 font-mono text-[13px] leading-relaxed text-neutral-700 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] dark:text-neutral-200",
          preClassName
        )}
      >
        <code className="block whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

export { CodeBlock };
export type { CodeBlockProps };
