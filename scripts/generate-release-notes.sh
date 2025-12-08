#!/bin/bash

# Release notes generator for Typescope
# Parses semantic commit messages and generates formatted changelog

set -e

OUTPUT_FILE="dist/RELEASE_NOTES.md"

# Create output directory if it doesn't exist
mkdir -p dist

# Get the current version
VERSION=$(node -p "require('./package.json').version")

# Get the last tag (fallback to first commit if no tags exist)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD 2>/dev/null)

# If we're on a tag, get commits since the previous tag
if git describe --exact-match --tags HEAD 2>/dev/null; then
  LAST_TAG=$(git describe --tags --abbrev=0 "HEAD^" 2>/dev/null || git rev-list --max-parents=0 HEAD)
fi

echo "Generating release notes for v${VERSION}..."

# Start building the release notes
{
  echo "# Release v${VERSION}"
  echo ""

  # Get commits since last tag
  if [ -z "$LAST_TAG" ]; then
    COMMITS=$(git log --oneline --decorate)
  else
    COMMITS=$(git log "${LAST_TAG}..HEAD" --oneline --decorate)
  fi

  if [ -z "$COMMITS" ]; then
    echo "## What's New"
    echo ""
    echo "No commits since last release."
    echo ""
    echo "## Full Changelog"
    echo ""
    if [ -n "$LAST_TAG" ]; then
      echo "- Compare: https://github.com/ryanuesato/figma-typescope/compare/${LAST_TAG}...v${VERSION}"
    else
      echo "- View all commits: https://github.com/ryanuesato/figma-typescope/commits/v${VERSION}"
    fi
  else
    # Categorize commits by type
    FEATURES=$(echo "$COMMITS" | grep "^[^ ]* feat" || true)
    BUGFIXES=$(echo "$COMMITS" | grep "^[^ ]* fix" || true)
    REFACTORS=$(echo "$COMMITS" | grep "^[^ ]* refactor" || true)
    DOCS=$(echo "$COMMITS" | grep "^[^ ]* docs" || true)
    TESTS=$(echo "$COMMITS" | grep "^[^ ]* test" || true)
    CHORES=$(echo "$COMMITS" | grep "^[^ ]* chore" || true)

    # Print categories with commits
    if [ -n "$FEATURES" ]; then
      echo "## ✨ New Features"
      echo ""
      echo "$FEATURES" | awk '{$1=""; print "- " $0}' | sed 's/^- */- /'
      echo ""
    fi

    if [ -n "$BUGFIXES" ]; then
      echo "## 🐛 Bug Fixes"
      echo ""
      echo "$BUGFIXES" | awk '{$1=""; print "- " $0}' | sed 's/^- */- /'
      echo ""
    fi

    if [ -n "$REFACTORS" ]; then
      echo "## ♻️ Refactoring"
      echo ""
      echo "$REFACTORS" | awk '{$1=""; print "- " $0}' | sed 's/^- */- /'
      echo ""
    fi

    if [ -n "$TESTS" ]; then
      echo "## 🧪 Testing"
      echo ""
      echo "$TESTS" | awk '{$1=""; print "- " $0}' | sed 's/^- */- /'
      echo ""
    fi

    if [ -n "$DOCS" ]; then
      echo "## 📚 Documentation"
      echo ""
      echo "$DOCS" | awk '{$1=""; print "- " $0}' | sed 's/^- */- /'
      echo ""
    fi

    if [ -n "$CHORES" ]; then
      echo "## 🔧 Maintenance"
      echo ""
      echo "$CHORES" | awk '{$1=""; print "- " $0}' | sed 's/^- */- /'
      echo ""
    fi

    # Add full changelog link
    echo "## Full Changelog"
    echo ""
    if [ -n "$LAST_TAG" ]; then
      echo "- https://github.com/ryanuesato/figma-typescope/compare/${LAST_TAG}...v${VERSION}"
    else
      echo "- https://github.com/ryanuesato/figma-typescope/commits/v${VERSION}"
    fi
  fi

} > "$OUTPUT_FILE"

echo "✅ Release notes generated: $OUTPUT_FILE"
