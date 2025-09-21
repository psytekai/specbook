#!/bin/bash
# Enhanced script to extract native modules from CI builds with proper sharp support

set -e

echo "📦 Native Module Extractor for Cross-Platform Builds"
echo "====================================================="

# Configuration
NATIVE_MODULES_DIR="prebuilt-native-win-x64"
TEMP_EXTRACT_DIR=".temp-extract"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to extract modules from unpacked build
extract_from_unpacked() {
    local UNPACKED_PATH="$1"
    
    if [ ! -d "$UNPACKED_PATH" ]; then
        echo -e "${RED}❌ Unpacked build not found at: $UNPACKED_PATH${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}📂 Analyzing unpacked build structure...${NC}"
    
    # Find node_modules location
    NODE_MODULES_PATH=""
    if [ -d "$UNPACKED_PATH/resources/app.asar.unpacked/node_modules" ]; then
        NODE_MODULES_PATH="$UNPACKED_PATH/resources/app.asar.unpacked/node_modules"
    elif [ -d "$UNPACKED_PATH/resources/app/node_modules" ]; then
        NODE_MODULES_PATH="$UNPACKED_PATH/resources/app/node_modules"
    else
        echo -e "${RED}❌ Could not find node_modules${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Found node_modules at: ${NODE_MODULES_PATH#$UNPACKED_PATH/}${NC}"
    
    # Clean and create output directory
    rm -rf "$NATIVE_MODULES_DIR"
    mkdir -p "$NATIVE_MODULES_DIR"
    
    # Extract better-sqlite3
    extract_better_sqlite3 "$NODE_MODULES_PATH"
    
    # Extract sharp with proper structure
    extract_sharp "$NODE_MODULES_PATH"
    
    # Summary
    echo ""
    echo -e "${GREEN}📦 Extraction Summary:${NC}"
    echo "========================="
    
    if [ -d "$NATIVE_MODULES_DIR/better-sqlite3" ]; then
        echo -e "${GREEN}✅ better-sqlite3${NC}"
        # Verify .node file exists
        if [ -f "$NATIVE_MODULES_DIR/better-sqlite3/build/Release/better_sqlite3.node" ]; then
            echo "   └─ Native binding: better_sqlite3.node ✓"
        fi
    fi
    
    if [ -d "$NATIVE_MODULES_DIR/sharp" ] || [ -d "$NATIVE_MODULES_DIR/@img" ]; then
        echo -e "${GREEN}✅ sharp${NC}"
        if [ -d "$NATIVE_MODULES_DIR/@img/sharp-win32-x64" ]; then
            echo "   └─ Platform binary: @img/sharp-win32-x64 ✓"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}✨ Native modules ready for cross-platform build!${NC}"
}

extract_better_sqlite3() {
    local NODE_MODULES_PATH="$1"
    
    if [ -d "$NODE_MODULES_PATH/better-sqlite3" ]; then
        echo -e "${YELLOW}📦 Extracting better-sqlite3...${NC}"
        cp -r "$NODE_MODULES_PATH/better-sqlite3" "$NATIVE_MODULES_DIR/"
        
        # Verify native binding
        if [ -f "$NATIVE_MODULES_DIR/better-sqlite3/build/Release/better_sqlite3.node" ]; then
            echo -e "${GREEN}   ✓ Native binding found${NC}"
        else
            echo -e "${RED}   ⚠ Warning: Native binding not found${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  better-sqlite3 not found${NC}"
    fi
}

extract_sharp() {
    local NODE_MODULES_PATH="$1"
    local UNPACKED_PATH=$(dirname $(dirname "$NODE_MODULES_PATH"))
    
    echo -e "${YELLOW}📦 Extracting sharp...${NC}"
    
    # Check if we need to extract from app.asar
    if [ -f "$UNPACKED_PATH/app.asar" ]; then
        echo "   Found app.asar - extracting full sharp module"
        
        # Create temp directory for asar extraction
        TEMP_ASAR_DIR=".temp-asar-extract-$$"
        
        # Extract app.asar to get the main sharp module
        echo "   Extracting app.asar..."
        npx @electron/asar extract "$UNPACKED_PATH/app.asar" "$TEMP_ASAR_DIR" 2>/dev/null || {
            echo -e "${RED}   Failed to extract app.asar${NC}"
            echo "   Make sure @electron/asar is installed: npm install -g @electron/asar"
            return 1
        }
        
        # Copy the complete sharp module from app.asar
        if [ -d "$TEMP_ASAR_DIR/node_modules/sharp" ]; then
            echo "   Copying complete sharp module from app.asar"
            cp -r "$TEMP_ASAR_DIR/node_modules/sharp" "$NATIVE_MODULES_DIR/"
            echo -e "${GREEN}   ✓ Main sharp module extracted${NC}"
        else
            echo -e "${YELLOW}   ⚠ Sharp not found in app.asar${NC}"
        fi
        
        # Clean up temp directory
        rm -rf "$TEMP_ASAR_DIR"
    elif [ -d "$NODE_MODULES_PATH/sharp" ]; then
        # Fallback: Traditional sharp location (no app.asar)
        echo "   Found sharp at standard location"
        cp -r "$NODE_MODULES_PATH/sharp" "$NATIVE_MODULES_DIR/"
        
        if [ -d "$NATIVE_MODULES_DIR/sharp/vendor" ] || [ -d "$NATIVE_MODULES_DIR/sharp/build" ]; then
            echo -e "${GREEN}   ✓ Sharp extracted with vendor binaries${NC}"
        else
            echo -e "${YELLOW}   ⚠ Sharp extracted but binaries may be missing${NC}"
        fi
    fi
    
    # Always extract @img/sharp-win32-x64 if it exists
    if [ -d "$NODE_MODULES_PATH/@img/sharp-win32-x64" ]; then
        echo "   Found @img/sharp-win32-x64 in app.asar.unpacked"
        
        # Create @img directory structure
        mkdir -p "$NATIVE_MODULES_DIR/@img"
        cp -r "$NODE_MODULES_PATH/@img/sharp-win32-x64" "$NATIVE_MODULES_DIR/@img/"
        
        echo -e "${GREEN}   ✓ Platform binaries extracted (@img/sharp-win32-x64)${NC}"
    fi
    
    # If we don't have sharp main module yet, create minimal wrapper
    if [ ! -d "$NATIVE_MODULES_DIR/sharp" ] && [ -d "$NATIVE_MODULES_DIR/@img/sharp-win32-x64" ]; then
        echo "   Creating minimal sharp wrapper (fallback)"
        mkdir -p "$NATIVE_MODULES_DIR/sharp/lib"
        
        cat > "$NATIVE_MODULES_DIR/sharp/package.json" << 'EOF'
{
  "name": "sharp",
  "version": "0.33.5",
  "main": "lib/index.js",
  "optionalDependencies": {
    "@img/sharp-win32-x64": "0.33.5"
  }
}
EOF
        
        cat > "$NATIVE_MODULES_DIR/sharp/lib/index.js" << 'SHARPEOL'
// Minimal sharp loader for cross-platform builds
try {
  module.exports = require('@img/sharp-win32-x64');
} catch (error) {
  throw new Error('Failed to load sharp Windows binaries: ' + error.message);
}
SHARPEOL
        echo -e "${YELLOW}   ⚠ Using minimal wrapper (may have limited functionality)${NC}"
    fi
}

# Function to verify extraction
verify_extraction() {
    echo ""
    echo -e "${YELLOW}🔍 Verifying extracted modules...${NC}"
    
    local all_good=true
    
    # Check better-sqlite3
    if [ -f "$NATIVE_MODULES_DIR/better-sqlite3/build/Release/better_sqlite3.node" ]; then
        echo -e "${GREEN}✅ better-sqlite3: Native binding present${NC}"
    else
        echo -e "${RED}❌ better-sqlite3: Native binding missing${NC}"
        all_good=false
    fi
    
    # Check sharp
    if [ -d "$NATIVE_MODULES_DIR/@img/sharp-win32-x64" ] || \
       [ -d "$NATIVE_MODULES_DIR/sharp/vendor" ] || \
       [ -f "$NATIVE_MODULES_DIR/sharp/build/Release/sharp.node" ]; then
        echo -e "${GREEN}✅ sharp: Platform binaries present${NC}"
    else
        echo -e "${RED}❌ sharp: Platform binaries missing${NC}"
        all_good=false
    fi
    
    if [ "$all_good" = true ]; then
        echo ""
        echo -e "${GREEN}🎉 All native modules verified successfully!${NC}"
        return 0
    else
        echo ""
        echo -e "${YELLOW}⚠️  Some modules may not work correctly${NC}"
        return 1
    fi
}

# Main script logic
if [ "$1" == "--from-unpacked" ] && [ -n "$2" ]; then
    extract_from_unpacked "$2"
    verify_extraction || true
elif [ "$1" == "--verify" ]; then
    verify_extraction
else
    echo "Usage:"
    echo "  $0 --from-unpacked <path-to-win-unpacked-folder>"
    echo "  $0 --verify"
    echo ""
    echo "Examples:"
    echo "  $0 --from-unpacked ~/Downloads/electron-windows-dist/win-unpacked"
    echo "  $0 --from-unpacked ./dist/win-unpacked"
    echo ""
    echo "Current directory structure:"
    if [ -d "$NATIVE_MODULES_DIR" ]; then
        echo "  $NATIVE_MODULES_DIR exists with:"
        ls -la "$NATIVE_MODULES_DIR" 2>/dev/null | grep "^d" | awk '{print "    - " $NF}'
    else
        echo "  $NATIVE_MODULES_DIR does not exist yet"
    fi
    exit 1
fi