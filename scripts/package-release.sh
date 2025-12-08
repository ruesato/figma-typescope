#!/bin/bash

# Release packaging script for Typescope Figma plugin
# This script creates a distribution package with only necessary files for designers

set -e  # Exit on error

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
PLUGIN_NAME="typescope"
ZIP_NAME="${PLUGIN_NAME}-v${VERSION}.zip"

echo "📦 Packaging Typescope v${VERSION}..."

# Create dist directory
rm -rf dist
mkdir -p dist

# Copy essential files to dist
echo "📋 Copying files..."
cp manifest.json dist/
cp build/main.js dist/

# Copy installation guide
cp INSTALL.md dist/

# Verify required files exist
if [ ! -f "dist/manifest.json" ] || [ ! -f "dist/main.js" ]; then
  echo "❌ Error: Missing required files in dist/"
  exit 1
fi

echo "✅ Files copied successfully"

# Generate release notes
echo "📝 Generating release notes..."
bash scripts/generate-release-notes.sh

# Create ZIP archive
echo "🗜️  Creating ZIP archive..."
cd dist
zip -r "../${ZIP_NAME}" . -q
cd ..

echo "✅ Created ${ZIP_NAME}"

# Verify ZIP was created
if [ ! -f "${ZIP_NAME}" ]; then
  echo "❌ Error: ZIP file was not created"
  exit 1
fi

# Show summary
ZIP_SIZE=$(du -h "${ZIP_NAME}" | cut -f1)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Release package ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 File: ${ZIP_NAME}"
echo "📊 Size: ${ZIP_SIZE}"
echo "📍 Location: $(pwd)/${ZIP_NAME}"
echo ""
echo "Contents:"
echo "  • manifest.json (Figma plugin config)"
echo "  • main.js (plugin code)"
echo "  • INSTALL.md (installation guide)"
echo "  • RELEASE_NOTES.md (changelog)"
echo ""
echo "Next: Push to GitHub for automated release"
echo "      git tag v${VERSION} && git push origin main --tags"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
