#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SPEC_DIR="$PROJECT_DIR/../specscraper"
OUT_DIR="$SPEC_DIR/dist/electron_bridge"
BUNDLE_DIR="$PROJECT_DIR/resources/python/electron_bridge"

echo "Creating PyInstaller bundle..."

case "$(uname -s | tr '[:upper:]' '[:lower:]')" in
  darwin)
    cd "$SPEC_DIR"
    python3 -m venv .venv
    source .venv/bin/activate
    python -m pip install --upgrade pip wheel
    [ -f requirements-minimal.txt ] && python -m pip install -r requirements-minimal.txt
    python -m pip install pyinstaller
    pyinstaller --noconfirm --clean --onedir --noconsole --name electron_bridge electron_bridge.py
    deactivate

    rm -rf "$BUNDLE_DIR"
    mkdir -p "$(dirname "$BUNDLE_DIR")"
    cp -R "$OUT_DIR" "$BUNDLE_DIR"
    echo "✅ Python bundle created at: $BUNDLE_DIR"
    echo "Bundle size: $(du -sh "$BUNDLE_DIR" | cut -f1)"
    ;;
  *)
    echo "Build this on the target OS (use CI runners)."
    exit 1
    ;;
esac