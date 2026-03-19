"""
generate-crop-videos.py
=======================
Generates hyper-realistic lifecycle videos for each greenhouse crop using
Google Veo 3.1.  Each 8-second 1080p video captures a single plant on a
clean studio white background progressing from seed → germination →
vegetative → flowering → fruiting → harvest-ready → senescence/death.

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
ASPECT_RATIO = "16:9"
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
        "description": (
            "a head of green butterhead lettuce with delicate ruffled leaves"
        ),
    },
    "tomato": {
        "name": "Tomato",
        "scientific": "Solanum lycopersicum",
        "description": (
            "a tomato plant with a sturdy green stem, yellow star-shaped "
            "flowers, and bright red round tomatoes"
        ),
    },
    "potato": {
        "name": "Potato",
        "scientific": "Solanum tuberosum",
        "description": (
            "a potato plant with broad dark-green compound leaves above "
            "soil, and golden-brown tubers forming underground visible "
            "through a cross-section cutaway"
        ),
    },
    "soybean": {
        "name": "Soybean",
        "scientific": "Glycine max",
        "description": (
            "a soybean plant with trifoliate green leaves and clusters "
            "of fuzzy green soybean pods along the stems"
        ),
    },
    "spinach": {
        "name": "Spinach",
        "scientific": "Spinacia oleracea",
        "description": (
            "a spinach plant with a rosette of thick, dark-green, "
            "slightly crinkled spade-shaped leaves"
        ),
    },
    "wheat": {
        "name": "Wheat",
        "scientific": "Triticum aestivum",
        "description": (
            "a cluster of wheat stalks with long narrow leaves and "
            "golden grain heads with fine awns"
        ),
    },
    "radish": {
        "name": "Radish",
        "scientific": "Raphanus sativus",
        "description": (
            "a radish plant with lobed green leaves above the soil and "
            "a round bright-red radish root bulging from the earth"
        ),
    },
    "kale": {
        "name": "Kale",
        "scientific": "Brassica oleracea var. sabellica",
        "description": (
            "a curly kale plant with deeply ruffled blue-green leaves "
            "on thick pale stems"
        ),
    },
}


def build_prompt(crop_key: str) -> str:
    """Build a detailed, cinematic Veo prompt for one crop lifecycle."""
    crop = CROPS[crop_key]
    return (
        f"A perfectly smooth, continuous time-lapse of {crop['description']} "
        f"({crop['scientific']}) completing its entire life cycle in a single "
        f"unbroken shot. "
        f"The plant sits centered on a matte white studio surface against a "
        f"pure white seamless backdrop with soft, even studio lighting — no "
        f"shadows, no distractions. "
        f"The sequence begins with a single small seed resting on dark, rich "
        f"potting soil. The seed cracks open and a pale sprout emerges, "
        f"pushing upward. Cotyledon leaves unfurl, then true leaves appear "
        f"and multiply as the plant enters vigorous vegetative growth — "
        f"stems thicken, foliage expands. "
        f"The plant transitions into flowering: buds form and blossoms open. "
        f"Fruits or seed structures develop and ripen to full maturity. "
        f"Finally the plant senesces — leaves yellow, curl, and dry; stems "
        f"wither — until only a dried husk remains on the soil. "
        f"Ultra-realistic botanical detail, 4K macro quality, shot at f/2.8 "
        f"with creamy bokeh on the white background. Gentle ambient rustling "
        f"sounds throughout. No camera movement — perfectly locked-off "
        f"tripod, centered composition."
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
