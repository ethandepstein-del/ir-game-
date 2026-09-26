#!/bin/sh
# Display fonts (SIL OFL / Apache 2.0) from the Google Fonts repository.
set -e
cd "$(dirname "$0")/fonts"
base=https://raw.githubusercontent.com/google/fonts/main
for f in ofl/anton/Anton-Regular.ttf ofl/rubikmonoone/RubikMonoOne-Regular.ttf ofl/caveatbrush/CaveatBrush-Regular.ttf \
         apache/permanentmarker/PermanentMarker-Regular.ttf apache/specialelite/SpecialElite-Regular.ttf; do
  curl -sSfLO "$base/$f"
done
