# Installing Typescope Plugin

## Quick Start (2 minutes)

### 1. Download the plugin

- Go to the [latest release](https://github.com/ryanuesato/figma-typescope/releases/latest)
- Download `typescope-vX.X.X.zip` (where X.X.X is the version number)
- Extract the ZIP file to a folder on your computer

### 2. Install in Figma

- Open **Figma Desktop App** (plugin installation only works in the desktop version)
- Open any Figma file
- Right-click in the canvas
- Select: **Plugins → Development → Import plugin from manifest...**
- Navigate to the extracted folder
- Select `manifest.json`
- Click **Open**

### 3. Run the plugin

- Right-click in any Figma file
- Select: **Plugins → Development → Typescope**
- The plugin panel will open on the right side

## Troubleshooting

### Plugin doesn't appear after importing

✅ **Solution**: Make sure you:
- Are using **Figma Desktop App** (not the browser version)
- Both `manifest.json` and `main.js` are in the same folder
- The manifest was imported successfully (no error messages appeared)

### "Import plugin from manifest" option not visible

✅ **Solution**:
- Right-click directly on the canvas, not on a layer
- You must be in Figma Desktop App, not the web version

### Plugin crashes or shows errors

✅ **Solution**:
- Open the browser console (Cmd+Option+I on Mac, Ctrl+Shift+I on Windows)
- Check for error messages
- [Report the issue on GitHub](https://github.com/ryanuesato/figma-typescope/issues/new)

## Documentation & Support

- **GitHub Repository**: https://github.com/ryanuesato/figma-typescope
- **Report Issues**: https://github.com/ryanuesato/figma-typescope/issues
- **Feature Requests**: https://github.com/ryanuesato/figma-typescope/discussions

## What Typescope Does

Typescope is a comprehensive Figma plugin for design system governance that helps you:

- **Audit text styles** across your entire document
- **Detect tokens** and their usage patterns
- **Analyze style adoption** with interactive analytics
- **Migrate styles** between libraries with safety guarantees
- **Replace tokens** across your document
- **Export reports** for stakeholder communication

For detailed feature documentation, visit the [GitHub repository](https://github.com/ryanuesato/figma-typescope).
