#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../_lib.sh"

VARIANT="${1:?usage: setup-icons.sh <dev|e2e|preview|production>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ASSETS_DIR="$MOBILE_ROOT/assets"

header "Setup Icons · $VARIANT"

# Map variant to icon filename in assets directory
case "$VARIANT" in
  dev|e2e)
    ICON_NAME="icon.png"
    ;;
  preview)
    ICON_NAME="header-logo.png"
    ;;
  production)
    ICON_NAME="logo.web.png"
    ;;
  *)
    fail "Unknown variant: $VARIANT"
    exit 1
    ;;
esac

SOURCE_ICON="$ASSETS_DIR/$ICON_NAME"
BASE_ICON="$ASSETS_DIR/icon.png"
SOURCE_WAS_BASE=false

if [[ "$SOURCE_ICON" == "$BASE_ICON" ]]; then
  SOURCE_WAS_BASE=true
fi

# Verify source icon exists
if [[ ! -f "$SOURCE_ICON" ]]; then
  fail "Source icon not found: $SOURCE_ICON"
  exit 1
fi

# Use variant-specific icon as base
step "Using $ICON_NAME for $VARIANT variant"
if [[ "$SOURCE_WAS_BASE" == "true" ]]; then
  info "Source icon is already the base icon; keeping existing base icon"
else
  cp "$SOURCE_ICON" "$BASE_ICON"
fi
ok "Base icon set"

# Copy splash screen from existing assets source
SPLASH_SRC="$ASSETS_DIR/splash.png"
if [[ ! -f "$SPLASH_SRC" ]]; then
  warn "Splash screen not found at $SPLASH_SRC (optional)"
fi

# Update adaptive icon for Android
ADAPTIVE_ICON="$ASSETS_DIR/adaptive-icon.png"
step "Updating adaptive icon"
cp "$BASE_ICON" "$ADAPTIVE_ICON"
ok "Adaptive icon updated"

# Generate iOS icon set from base icon
step "Generating iOS icon set"
IOS_ICONS_DIR="$ASSETS_DIR/ios/AppIcon.appiconset"

# Create directory if it doesn't exist
mkdir -p "$IOS_ICONS_DIR"

# Define all required iOS icon sizes
declare -a SIZES=(
  "20x20@1x~ipad"
  "20x20@2x"
  "20x20@2x~ipad"
  "20x20@3x"
  "29x29@1x~ipad"
  "29x29@2x"
  "29x29@2x~ipad"
  "29x29@3x"
  "40x40@1x~ipad"
  "40x40@2x"
  "40x40@2x~ipad"
  "40x40@3x"
  "60x60@2x"
  "60x60@3x"
  "76x76@1x~ipad"
  "76x76@2x~ipad"
  "83.5x83.5@2x~ipad"
  "1024x1024@1x"
)

GENERATED=0

# Convert sizes to actual dimensions and generate
for size_spec in "${SIZES[@]}"; do
  # Extract dimension and scale
  IFS='@' read -r base_size scale <<< "$size_spec"

  # Special handling for non-square sizes
  if [[ "$base_size" == "83.5x83.5" ]]; then
    dimension=167
  else
    IFS='x' read -r width height <<< "$base_size"

    # Apply scale multiplier
    case "$scale" in
      "2x"*) dimension=$((width * 2)) ;;
      "3x"*) dimension=$((width * 3)) ;;
      *) dimension=$width ;;
    esac
  fi

  output_file="$IOS_ICONS_DIR/Icon-App-${base_size}@${scale}.png"

  # Generate if not present or if source icon is newer
  if [[ ! -f "$output_file" ]] || [[ "$BASE_ICON" -nt "$output_file" ]]; then
    tmp_file="${output_file}.tmp"
    magick "$BASE_ICON" -resize "${dimension}x${dimension}!" "$tmp_file"
    mv "$tmp_file" "$output_file"
    GENERATED=$((GENERATED + 1))
  fi
done

ok "iOS icon set generated ($GENERATED icons)"
ok "Icon setup complete for $VARIANT"
