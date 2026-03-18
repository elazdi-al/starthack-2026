"use client";

import { useCentralControl } from "@/components/ui/central-control";

export function CentralControlExample() {
  useCentralControl("Central Control", {
    surface: {
      accent: { type: "color", default: "#0f7aff" },
      finish: {
        type: "select",
        default: "glass",
        options: [
          { value: "glass", label: "Glass" },
          { value: "tint", label: "Tinted" },
          { value: "outline", label: "Outline" },
        ],
      },
      radius: [28, 16, 40, 1],
      border: [0.12, 0.04, 0.24, 0.01],
      glow: [0.18, 0, 0.48, 0.01],
      grain: [0.18, 0, 0.35, 0.01],
    },
    motion: {
      scale: [1, 0.94, 1.06, 0.01],
      lift: [12, 0, 28, 1],
      rotate: [0, -10, 10, 1],
      transition: { type: "spring", visualDuration: 0.48, bounce: 0.18 },
    },
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
