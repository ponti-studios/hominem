#!/usr/bin/env bash
set -euo pipefail

# Generates mobile app icons from a source PNG.
# Usage: ./scripts/generate-mobile-icons.sh [source.png]
# Defaults to assets/logo.mobile.png

SRC="${1:-assets/logo.mobile.png}"
ICON_DIR="apps/mobile/assets"
IOS_DIR="${ICON_DIR}/ios/AppIcon.appiconset"

if ! command -v magick &>/dev/null; then
  echo "Error: ImageMagick is required. Install with: brew install imagemagick" >&2
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "Error: Source image not found: $SRC" >&2
  exit 1
fi

echo "Generating icons from $SRC..."

resize() {
  magick "$SRC" \
    -resize "${1}x${1}" \
    -background none \
    -gravity center \
    -extent "${1}x${1}" \
    "$2"
  echo "  ✓ $(basename "$2") (${1}x${1})"
}

# All sizes to generate: "size output_path"
declare -a ICONS=(
  "1024 ${ICON_DIR}/icon.png"
  "1024 ${ICON_DIR}/adaptive-icon.png"
  "20   ${IOS_DIR}/Icon-App-20x20@1x.png"
  "40   ${IOS_DIR}/Icon-App-20x20@2x.png"
  "60   ${IOS_DIR}/Icon-App-20x20@3x.png"
  "29   ${IOS_DIR}/Icon-App-29x29@1x.png"
  "58   ${IOS_DIR}/Icon-App-29x29@2x.png"
  "87   ${IOS_DIR}/Icon-App-29x29@3x.png"
  "40   ${IOS_DIR}/Icon-App-40x40@1x.png"
  "80   ${IOS_DIR}/Icon-App-40x40@2x.png"
  "120  ${IOS_DIR}/Icon-App-40x40@3x.png"
  "120  ${IOS_DIR}/Icon-App-60x60@2x.png"
  "180  ${IOS_DIR}/Icon-App-60x60@3x.png"
  "76   ${IOS_DIR}/Icon-App-76x76@1x.png"
  "152  ${IOS_DIR}/Icon-App-76x76@2x.png"
  "167  ${IOS_DIR}/Icon-App-83.5x83.5@2x.png"
  "1024 ${IOS_DIR}/Icon-App-1024x1024@1x.png"
)

mkdir -p "$ICON_DIR" "$IOS_DIR"

# Run all ImageMagick conversions in parallel
pids=()
for entry in "${ICONS[@]}"; do
  read -r size out <<< "$entry"
  resize "$size" "$out" &
  pids+=($!)
done

# Wait for all and collect failures
failed=0
for pid in "${pids[@]}"; do
  wait "$pid" || failed=$((failed + 1))
done

if [ "$failed" -gt 0 ]; then
  echo "ERROR: $failed icon generation(s) failed." >&2
  exit 1
fi

echo "Done. Generated ${#ICONS[@]} icons."
