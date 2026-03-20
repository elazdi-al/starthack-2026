"use client";

/**
 * Subtle two-note ascending chime for agent decision notifications.
 *
 * Uses the Web Audio API to synthesize a clean sine-wave "da-ding" —
 * ~250 ms total, very low volume, no external audio files required.
 *
 * Designed to match the "elegant, quiet, tactile" design-system intent:
 * short, informative, never attention-grabbing.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return ctx;
}

export function playDecisionChime(): void {
  const ac = getCtx();
  if (!ac) return;

  // Resume after autoplay-policy gate (needs prior user gesture)
  if (ac.state === "suspended") void ac.resume();

  const now = ac.currentTime;
  const vol = 0.07;

  // ── Note 1: soft A5 ping ────────────────────────────────────────────────
  const o1 = ac.createOscillator();
  const g1 = ac.createGain();
  o1.type = "sine";
  o1.frequency.value = 880;
  g1.gain.setValueAtTime(vol, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  o1.connect(g1).connect(ac.destination);
  o1.start(now);
  o1.stop(now + 0.15);

  // ── Note 2: higher E6, slightly delayed ─────────────────────────────────
  const o2 = ac.createOscillator();
  const g2 = ac.createGain();
  o2.type = "sine";
  o2.frequency.value = 1318.5; // E6
  g2.gain.setValueAtTime(0, now + 0.07);
  g2.gain.linearRampToValueAtTime(vol * 0.65, now + 0.09);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
  o2.connect(g2).connect(ac.destination);
  o2.start(now + 0.07);
  o2.stop(now + 0.25);
}
