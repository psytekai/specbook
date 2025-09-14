# scripts/bundle-python-mac.sh
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SPEC_DIR="$APP_DIR/../specscraper"
OUT_DIR="$SPEC_DIR/dist/electron_bridge"
BUNDLE_DIR="$APP_DIR/resources/python/electron_bridge"

cd "$SPEC_DIR"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip wheel
[ -f requirements-minimal.txt ] && python -m pip install -r requirements-minimal.txt
python -m pip install pyinstaller
pyinstaller --noconfirm --clean --onedir --noconsole --name electron_bridge electron_bridge.py
deactivate

rm -rf "$BUNDLE_DIR"; mkdir -p "$BUNDLE_DIR"
cp -R "$OUT_DIR"/. "$BUNDLE_DIR"/
echo "✅ mac bundle staged at: $BUNDLE_DIR"
