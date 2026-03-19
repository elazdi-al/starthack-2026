"""
generate-crop-videos.py
=======================
Generates hyper-realistic lifecycle videos for each greenhouse crop using
Google Veo 3.1.  Each 8-second 1080p portrait (9:16) video captures a
single plant on a clean studio white background with a completely static
camera — no movement whatsoever.  The plant progresses from seed →
germination → vegetative → flowering → fruiting → harvest-ready →
senescence/death, always centered and fully in frame.

The videos are saved to  public/videos/crops/<crop>.mp4  so they can be
served statically by Next.js and referenced by the crop-dialog UI.

Usage
-----
    export GOOGLE_API_KEY="your-key"
    python scripts/generate-crop-videos.py            # all crops
    python scripts/generate-crop-videos.py tomato kale # specific crops

Requirements
------------
    pip install google-genai
"""

from __future__ import annotations

import os
import sys
import time
import pathlib

from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MODEL = "veo-3.1-generate-preview"
RESOLUTION = "1080p"
ASPECT_RATIO = "9:16"
DURATION_SECONDS = "8"
POLL_INTERVAL = 10  # seconds between status checks

OUTPUT_DIR = pathlib.Path(__file__).resolve().parent.parent / "public" / "videos" / "crops"

# ---------------------------------------------------------------------------
# Crop definitions – mirrors greenhouse/implementations/multi-crop/profiles.ts
# ---------------------------------------------------------------------------

CROPS: dict[str, dict] = {
    "lettuce": {
        "name": "Lettuce",
        "scientific": "Lactuca sativa",
        "description": "a single lettuce plant with soft green ruffled leaves",
    },
    "tomato": {
        "name": "Tomato",
        "scientific": "Solanum lycopersicum",
        "description": "a single tomato plant with green leaves, yellow flowers, and red fruits",
    },
    "potato": {
        "name": "Potato",
        "scientific": "Solanum tuberosum",
        "description": "a single potato plant with broad dark-green leaves",
    },
    "soybean": {
        "name": "Soybean",
        "scientific": "Glycine max",
        "description": "a single soybean plant with trifoliate leaves and green pods",
    },
    "spinach": {
        "name": "Spinach",
        "scientific": "Spinacia oleracea",
        "description": "a single spinach plant with a rosette of dark-green spade-shaped leaves",
    },
    "wheat": {
        "name": "Wheat",
        "scientific": "Triticum aestivum",
        "description": "a single wheat plant with narrow leaves and a golden grain head",
    },
    "radish": {
        "name": "Radish",
        "scientific": "Raphanus sativus",
        "description": "a single radish plant with lobed green leaves and a red root",
    },
    "kale": {
        "name": "Kale",
        "scientific": "Brassica oleracea var. sabellica",
        "description": "a single kale plant with deeply curled blue-green leaves",
    },
}


def build_prompt(crop_key: str) -> str:
    """Build a detailed, cinematic Veo prompt for one crop lifecycle.

    Every prompt follows the exact same structure to guarantee uniform
    framing, lighting, and composition across all eight crops.
    """
    crop = CROPS[crop_key]
    return (
        # ── Camera & framing ──────────────────────────────────────────
        f"Perfectly static camera. Locked-off tripod. No camera movement "
        f"whatsoever — no pan, no tilt, no zoom, no dolly, no shake. "
        f"The exact same frame from the first frame to the last frame. "
        # ── Composition ───────────────────────────────────────────────
        f"Centered medium shot, portrait orientation (9:16). "
        f"A small round terracotta pot sits in the exact center of the "
        f"frame on a clean matte white surface. The pot contains "
        f"{crop['description']}. "
        f"The plant is always perfectly centered horizontally. "
        f"The pot sits in the lower third of the frame. "
        f"Generous empty space above the plant so it is never cropped "
        f"even at maximum height. "
        # ── Background & lighting ─────────────────────────────────────
        f"Pure solid white background — seamless, no horizon line, "
        f"no gradients, no shadows on the background. "
        f"Soft diffused overhead studio lighting, perfectly even, "
        f"very faint contact shadow directly under the pot only. "
        # ── Action (lifecycle) ────────────────────────────────────────
        f"Smooth continuous time-lapse of the full life cycle of "
        f"{crop['scientific']}: "
        f"Frame opens on a bare seed sitting on dark soil in the pot. "
        f"The seed germinates — a small pale sprout pushes up. "
        f"Cotyledon leaves open, then true leaves grow. "
        f"Vigorous vegetative growth — stems and foliage fill out. "
        f"The plant flowers. Fruit or seed structures develop and ripen. "
        f"Then the plant dies — leaves turn yellow, wilt, dry, curl; "
        f"stems brown and wither until only a dry husk remains in the pot. "
        # ── Style ─────────────────────────────────────────────────────
        f"Hyper-realistic photographic quality. Botanical macro detail. "
        f"Clean, clinical, product-photography aesthetic. "
        f"Silent — no audio, no music, no sound effects."
    )


def generate_video(client: genai.Client, crop_key: str) -> pathlib.Path:
    """Generate a single crop lifecycle video and save it to disk."""
    prompt = build_prompt(crop_key)
    crop = CROPS[crop_key]

    print(f"\n{'='*60}")
    print(f"  Generating: {crop['name']} ({crop['scientific']})")
    print(f"{'='*60}")
    print(f"  Prompt ({len(prompt)} chars):")
    print(f"  {prompt[:120]}...")
    print()

    operation = client.models.generate_videos(
        model=MODEL,
        prompt=prompt,
        config=types.GenerateVideosConfig(
            aspect_ratio=ASPECT_RATIO,
            resolution=RESOLUTION,
        ),
    )

    elapsed = 0
    while not operation.done:
        print(f"  ... waiting ({elapsed}s elapsed)", end="\r")
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
        operation = client.operations.get(operation)

    print(f"  Completed in ~{elapsed}s                       ")

    generated = operation.response.generated_videos[0]
    client.files.download(file=generated.video)

    out_path = OUTPUT_DIR / f"{crop_key}.mp4"
    generated.video.save(str(out_path))
    print(f"  Saved → {out_path}")
    return out_path


def main() -> None:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY environment variable is not set.")
        print("  export GOOGLE_API_KEY='your-key'")
        sys.exit(1)

    # Determine which crops to generate
    requested = sys.argv[1:] if len(sys.argv) > 1 else list(CROPS.keys())
    invalid = [c for c in requested if c not in CROPS]
    if invalid:
        print(f"Error: Unknown crop(s): {', '.join(invalid)}")
        print(f"  Valid crops: {', '.join(CROPS.keys())}")
        sys.exit(1)

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    client = genai.Client(api_key=api_key)

    results: list[tuple[str, pathlib.Path | None, str | None]] = []

    for crop_key in requested:
        try:
            path = generate_video(client, crop_key)
            results.append((crop_key, path, None))
        except Exception as exc:
            print(f"  FAILED: {exc}")
            results.append((crop_key, None, str(exc)))

    # Summary
    print(f"\n{'='*60}")
    print("  Summary")
    print(f"{'='*60}")
    for crop_key, path, err in results:
        status = f"OK → {path}" if path else f"FAILED: {err}"
        print(f"  {crop_key:>10}: {status}")
    print()

    failed = sum(1 for _, _, e in results if e)
    if failed:
        print(f"  {failed}/{len(results)} failed. Re-run with those crop names to retry.")
        sys.exit(1)

    print(f"  All {len(results)} videos generated successfully.")
    print(f"  Output directory: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
