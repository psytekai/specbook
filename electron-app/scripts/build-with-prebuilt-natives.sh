#!/bin/bash
# Build Windows app using pre-extracted native modules from CI

set -e

echo "🔨 Building Windows app with pre-built native modules"
echo "====================================================="

# Configuration
NATIVE_MODULES_DIR="prebuilt-native-win-x64"
MODULES_TO_REPLACE=("better-sqlite3" "sharp" "@img")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check native modules
    if [ ! -d "$NATIVE_MODULES_DIR" ]; then
        echo -e "${RED}❌ Pre-built native modules not found at $NATIVE_MODULES_DIR${NC}"
        echo "   Please run first:"
        echo "   ./scripts/extract-native-modules.sh --from-unpacked <path-to-win-unpacked>"
        exit 1
    fi
    
    # Check Python bridge
    if [ ! -f "electron_bridge-win-x64/electron_bridge.exe" ]; then
        echo -e "${RED}❌ Prebuilt Python executable not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites found${NC}"
}

# Backup current modules
backup_modules() {
    echo -e "${YELLOW}📦 Backing up current native modules...${NC}"
    
    BACKUP_DIR="node_modules_backup_$(date +%s)"
    
    for MODULE in "${MODULES_TO_REPLACE[@]}"; do
        if [ -d "node_modules/$MODULE" ]; then
            mkdir -p "$BACKUP_DIR"
            echo "   Backing up $MODULE"
            mv "node_modules/$MODULE" "$BACKUP_DIR/$MODULE"
        fi
    done
    
    if [ -d "$BACKUP_DIR" ]; then
        echo -e "${GREEN}   ✓ Modules backed up to $BACKUP_DIR${NC}"
    fi
}

# Install Windows native modules
install_windows_modules() {
    echo -e "${YELLOW}📦 Installing Windows native modules...${NC}"
    
    # Copy better-sqlite3
    if [ -d "$NATIVE_MODULES_DIR/better-sqlite3" ]; then
        echo "   Installing better-sqlite3..."
        cp -r "$NATIVE_MODULES_DIR/better-sqlite3" "node_modules/"
        echo -e "${GREEN}   ✓ better-sqlite3 installed${NC}"
    fi
    
    # Copy sharp and @img structure
    if [ -d "$NATIVE_MODULES_DIR/sharp" ]; then
        echo "   Installing sharp..."
        cp -r "$NATIVE_MODULES_DIR/sharp" "node_modules/"
        echo -e "${GREEN}   ✓ sharp installed${NC}"
    fi
    
    if [ -d "$NATIVE_MODULES_DIR/@img" ]; then
        echo "   Installing @img/sharp-win32-x64..."
        mkdir -p "node_modules/@img"
        cp -r "$NATIVE_MODULES_DIR/@img/sharp-win32-x64" "node_modules/@img/"
        echo -e "${GREEN}   ✓ @img/sharp-win32-x64 installed${NC}"
    fi
}

# Build the application
build_app() {
    echo -e "${YELLOW}🔨 Building application...${NC}"
    
    # Build renderer and main process
    echo "   Building TypeScript..."
    npm run build
    
    echo -e "${GREEN}✅ Build completed${NC}"
}

# Package with electron-builder
package_app() {
    echo -e "${YELLOW}📦 Packaging for Windows...${NC}"
    
    # Run electron-builder with no rebuild flags
    npx electron-builder --win --x64 \
        --config.npmRebuild=false \
        --config.buildDependenciesFromSource=false \
        --config.nodeGypRebuild=false \
        -c.directories.output=dist-win
    
    echo -e "${GREEN}✅ Packaging completed${NC}"
}

# Restore original modules
restore_modules() {
    echo -e "${YELLOW}🔄 Restoring original modules for local development...${NC}"
    
    # Find the most recent backup
    BACKUP_DIR=$(ls -d node_modules_backup_* 2>/dev/null | tail -n 1)
    
    if [ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]; then
        for MODULE in "${MODULES_TO_REPLACE[@]}"; do
            if [ -d "$BACKUP_DIR/$MODULE" ]; then
                echo "   Restoring $MODULE"
                rm -rf "node_modules/$MODULE"
                mv "$BACKUP_DIR/$MODULE" "node_modules/$MODULE"
            fi
        done
        
        # Clean up backup directory
        rmdir "$BACKUP_DIR" 2>/dev/null || true
        
        echo -e "${GREEN}   ✓ Original modules restored${NC}"
    else
        echo -e "${YELLOW}   ⚠ No backup found to restore${NC}"
    fi
}

# Clean up function for errors
cleanup_on_error() {
    echo -e "${RED}❌ Build failed, restoring original modules...${NC}"
    restore_modules
    exit 1
}

# Set up error handler
trap cleanup_on_error ERR

# Main execution
main() {
    echo ""
    check_prerequisites
    echo ""
    backup_modules
    echo ""
    install_windows_modules
    echo ""
    build_app
    echo ""
    package_app
    echo ""
    restore_modules
    echo ""
    echo -e "${GREEN}✨ Windows build complete with CI-built native modules!${NC}"
    echo ""
    echo "📦 Output files:"
    ls -la dist-win/*.exe 2>/dev/null || echo "   No .exe files found"
    echo ""
    echo "Next steps:"
    echo "1. Copy the .exe installer to Windows"
    echo "2. Install and test the application"
    echo "3. Verify sharp and better-sqlite3 functionality"
}

# Run main function
main