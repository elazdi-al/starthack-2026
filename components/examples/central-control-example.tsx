"use client";

import { useCentralControl } from "@/components/ui/central-control";

export function CentralControlExample() {
  useCentralControl("Central Control", {
    
    content: {
      eyebrow: { type: "text", default: "Central Control" },
      title: { type: "text", default: "Tune the showcase" },
      compact: false,
    },
    metrics: {
      emphasis: {
        type: "select",
        default: "balanced",
        options: [
          { value: "relaxed", label: "Relaxed" },
          { value: "balanced", label: "Balanced" },
          { value: "compact", label: "Compact" },
        ],
      },
      confidence: [86, 60, 99, 1],
    },
  });

  return null;
}
