#!/bin/bash

# Version consistency checker for releases
# Ensures package.json version matches the intended git tag

set -e

echo "🔍 Checking release readiness..."
echo ""

# Get version from package.json
PACKAGE_VERSION=$(node -p "require('./package.json').version")

echo "Current version in package.json: v${PACKAGE_VERSION}"
echo ""

# Check if version is already tagged
if git rev-parse "v${PACKAGE_VERSION}" >/dev/null 2>&1; then
  echo "⚠️  Tag v${PACKAGE_VERSION} already exists!"
  echo ""
  echo "If you want to release again, increment the version in package.json first."
  echo ""
  echo "Current tags:"
  git tag -l "v*" | sort -V | tail -5
  exit 1
fi

echo "✅ Version v${PACKAGE_VERSION} is ready to tag"
echo ""
echo "Next steps:"
echo "1. Commit any changes:"
echo "   git add . && git commit -m 'chore: prepare v${PACKAGE_VERSION} release'"
echo ""
echo "2. Create and push the tag:"
echo "   git tag v${PACKAGE_VERSION}"
echo "   git push origin main --tags"
echo ""
echo "3. GitHub Actions will automatically:"
echo "   - Build the plugin"
echo "   - Package the release"
echo "   - Create a GitHub Release with the ZIP file"
echo ""
echo "Monitor progress at:"
echo "https://github.com/ryanuesato/figma-typescope/actions"
