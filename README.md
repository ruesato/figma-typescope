# Figma Font Audit Pro

Comprehensive Figma plugin for analyzing font usage, text styles, and typography consistency across your designs.

## Overview

Figma Font Audit Pro helps design teams maintain typography consistency by providing deep insights into:

- Font usage across pages and components
- Text style application and coverage
- Style assignment status (fully-styled, partially-styled, unstyled)
- Component hierarchy and text overrides
- Library sources for text styles

## Current Status

**Version**: 1.0.0 (MVP)
**Implementation**: Phase 2 In Progress (50% - 44/96 tasks)

### ✅ Implemented Features (Phases 1-2)

#### Phase 1: Font Audit (Complete)

- **Text Layer Discovery**: Recursively scan entire page or selection for all text layers
- **Font Metadata Extraction**: Capture font family, size, weight, line height, and color
- **Style Assignment Detection**: Identify which text has styles applied (fully/partially/unstyled)
- **Property-Level Comparison**: See exactly which properties match or differ from applied styles
- **Component Context Tracking**: Build hierarchy paths showing component structure
- **Override Detection**: Identify text overrides in component instances
- **Library Source Identification**: Track which libraries text styles come from

#### Phase 2: Style Governance Audit (In Progress)

- **7-State Audit Engine**: Robust state machine (idle → validating → scanning → processing → complete/error/cancelled)
- **Document Validator**: Size limits (5k warning, 25k max), accessibility checks
- **Page Scanner**: Multi-page traversal with progress tracking
- **Metadata Processor**: Style extraction, library resolution, hierarchy building
- **Style Tree View**: Hierarchical display of styles grouped by library
- **Progress Reporting**: Real-time updates during validation, scanning, and processing phases

#### User Interface

- **Summary Dashboard**: High-level statistics with visual indicators
  - Total text layers, unique fonts, style coverage %
  - Hidden layers count, libraries in use
- **Filterable Results List**: Filter by assignment status (all/styled/partial/unstyled)
- **Sortable Results**: Sort by font family, size, or status
- **Rich Layer Cards**: Display hierarchy, font info, badges, property matches
- **Real-time Progress**: Animated progress bar during audit (0-100%)
- **Error Handling**: User-friendly error messages with retry/dismiss actions
- **Loading States**: Proper loading indicators throughout
- **Empty States**: Helpful empty state with usage tips
- **Style Tree View**: Library-grouped style hierarchy (new in Phase 2)

### 🚧 Not Yet Implemented (Phases 4-8)

- **Search functionality** (text content, font names, style names)
- **Advanced filters** (by font family, component type, library)
- **Click-to-navigate** (select and zoom to layers in Figma)
- **Style match suggestions** (80%+ similarity recommendations)
- **Export capabilities** (PDF reports, CSV data)
- **Bulk operations** (apply styles to multiple layers)
- **Performance optimizations** (virtualization for large files)
- **Keyboard shortcuts**
- **Plugin settings/preferences**

## Prerequisites

- **Node.js**: v22+ (project uses pnpm)
- **pnpm**: Latest version
- **Figma Desktop App**: [Download here](https://figma.com/downloads/)

## Installation & Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build the Plugin

```bash
# Production build
pnpm build

# Development build with watch mode (recommended)
pnpm dev
```

**Note**: The project uses Vite as the build tool. The `pnpm dev` command enables hot reload for faster development. TypeScript errors shown by `pnpm typecheck` are known issues and can be safely ignored as the build works correctly.

### 3. Load in Figma

1. Open Figma Desktop app
2. Open any Figma file (or create a test file)
3. Run **Plugins** → **Development** → **Import plugin from manifest...**
4. Navigate to this project directory
5. Select `manifest.json`
6. Plugin will appear as "Figma Font Audit Pro" in your development plugins

### 4. Run the Plugin

- Right-click in Figma → **Plugins** → **Development** → **Figma Font Audit Pro**
- Or use Quick Actions (⌘/) and search for "Figma Font Audit Pro"

## Usage

### Running an Audit

1. **Audit Entire Page**: Click "Run Audit on Page" to scan all text on current page
2. **Audit Selection**: Select frames/layers first, then click "Audit Selection"
3. **View Progress**: Watch real-time progress bar as layers are processed
4. **Review Results**: Explore summary statistics and detailed layer list

### Understanding Results

**Style Coverage**: Percentage of text layers with fully-applied text styles

- 🟢 Green (≥80%): Excellent consistency
- 🟡 Yellow (50-79%): Moderate consistency
- 🔴 Red (<50%): Needs improvement

**Assignment Status**:

- **Styled** (green): All properties match the applied text style
- **Partial** (yellow): Some properties differ from applied style (shows which ones)
- **Unstyled** (red): No text style applied

**Component Context**:

- Hierarchy path shows component structure (e.g., "Page → Card → Button → Label")
- Override badges indicate when instance text differs from main component

### Filtering & Sorting

- **Filter by status**: Show only styled, partial, or unstyled text
- **Sort options**: Organize by font family, size, or assignment status
- **Search**: _(Coming in Phase 4)_

## Project Structure

````
figma-fontscope/
├── src/
│   ├── main/                   # Figma sandbox context (plugin main code)
│   │   ├── code.ts            # Main entry point, message handling
│   │   ├── audit/             # Style governance audit (Phase 2)
│   │   │   ├── auditEngine.ts # 7-state audit orchestration
│   │   │   ├── validator.ts   # Document validation & size limits
│   │   │   ├── scanner.ts     # Multi-page text layer discovery
│   │   │   └── processor.ts   # Style metadata extraction
│   │   └── utils/
│   │       ├── traversal.ts   # Text node traversal
│   │       ├── fontMetadata.ts # Font property extraction
│   │       ├── styleDetection.ts # Style assignment detection
│   │       ├── styleLibrary.ts # Style & library management
│   │       ├── summary.ts     # Statistics calculation
│   │       ├── hierarchy.ts   # Component hierarchy building
│   │       └── retry.ts       # Exponential backoff retry
│   │
│   ├── ui/                     # React UI context (plugin interface)
│   │   ├── index.tsx          # UI entry point
│   │   ├── App.tsx            # Root component
│   │   ├── components/
│   │   │   ├── SummaryDashboard.tsx
│   │   │   ├── AuditResults.tsx
│   │   │   ├── LayerItem.tsx
│   │   │   ├── StyleTreeView.tsx    # Style hierarchy tree (Phase 2)
│   │   │   ├── ProgressIndicator.tsx
│   │   │   └── ErrorDisplay.tsx
│   │   ├── hooks/
│   │   │   ├── useMessageHandler.ts # PostMessage communication
│   │   │   ├── useAuditState.ts     # 7-state machine management
│   │   │   ├── useDocumentChange.ts # Document change detection
│   │   │   └── useReplacementState.ts # Style replacement state
│   │   └── styles/
│   │       └── globals.css    # Tailwind + Figma design tokens
│   │
│   └── shared/
│       └── types.ts            # Shared TypeScript types
│
├── specs/                      # Feature specifications
│   ├── 001-font-audit/        # Phase 1: Font audit
│   └── 002-style-governance/  # Phase 2: Style governance
├── manifest.json               # Figma plugin manifest
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── vite.config.ts             # Vite build configuration
├── README.md                  # This file
└── TESTING.md                 # Testing guide (new)

## Tech Stack

### Core

- **TypeScript 5+**: Strict mode enabled
- **React 18**: UI framework
- **Figma Plugin API**: Native Figma integration

### Build & Dev Tools

- **@create-figma-plugin**: Official Figma plugin build tool
- **Vite**: Fast build tool with HMR
- **pnpm**: Fast, disk-efficient package manager

### Styling

- **Tailwind CSS**: Utility-first CSS framework
- **Figma Plugin Design System**: Native Figma design tokens
- **CSS Variables**: Theme support (light/dark mode)

### State & Communication

- **Custom State Management**: Singleton pattern with React hooks (no external dependencies)
- **PostMessage Protocol**: Type-safe cross-context communication

### Utilities

- **jsPDF**: PDF generation _(Phase 7)_
- **PapaParse**: CSV export _(Phase 7)_

## Development Workflow

### Available Scripts

```bash
# Development with hot reload (recommended)
pnpm dev

# Production build
pnpm build

# Type checking (optional - has known errors)
pnpm typecheck

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
````

### Debugging

1. **Main Context (Figma Sandbox)**:
   - Open Figma Developer Console: Quick Actions → "Show/Hide Console"
   - Use `console.log()` statements in `src/main/` files

2. **UI Context (React)**:
   - Right-click plugin UI → "Inspect Element"
   - Opens Chrome DevTools for React debugging

### Making Changes

1. Make code changes in `src/`
2. If `pnpm dev` is running, changes auto-rebuild
3. In Figma: Right-click → **Plugins** → **Development** → **Reload plugin**
4. Or close and reopen the plugin

## Architecture

### Dual-Context Design

Figma plugins run in two separate contexts:

1. **Main Context** (`src/main/code.ts`):
   - Runs in Figma's sandbox
   - Has access to Figma Plugin API
   - No access to browser APIs
   - No direct UI rendering

2. **UI Context** (`src/ui/`):
   - Runs in an iframe
   - React application with full browser APIs
   - No access to Figma Plugin API
   - Renders the plugin interface

### Communication Protocol

- **PostMessage API**: Cross-context messaging
- **Type-Safe Messages**:
  - `UIToMainMessage`: User actions from UI → Main
  - `MainToUIMessage`: Data/updates from Main → UI
- **Message Types**:
  - `RUN_AUDIT`, `CANCEL_AUDIT`, `NAVIGATE_TO_LAYER`
  - `AUDIT_STARTED`, `AUDIT_PROGRESS`, `AUDIT_COMPLETE`, `AUDIT_ERROR`

### State Management

- **Singleton Pattern**: Module-level state with listener subscriptions
- **No External Dependencies**: Custom hooks avoid zustand/redux
- **Reactive Updates**: Automatic re-renders when state changes

## Roadmap

### Phase 4: Search & Filter (T039-T050)

- Text content search
- Font family/style name search
- Advanced filtering options
- Filter persistence

### Phase 5: Click-to-Navigate (T051-T058)

- Click layer cards to select in Figma
- Zoom to layer viewport
- Multi-select support
- Navigation history

### Phase 6: Style Match Suggestions (T059-T068)

- 80%+ similarity scoring
- Weighted property matching (30/30/20/15/5)
- Recommended style suggestions
- Apply suggestions

### Phase 7: Export (T069-T079)

- PDF audit reports
- CSV data export
- Custom report templates
- Scheduled exports

### Phase 8: Polish & Performance (T080-T096)

- Keyboard shortcuts
- Bulk operations
- Virtual scrolling (large files)
- Plugin preferences
- Accessibility improvements
- Performance optimizations

## Contributing

This project follows semantic release conventions for commit messages:

```
feat: new feature
fix: bug fix
docs: documentation changes
style: code style changes (formatting, etc.)
refactor: code refactoring
test: adding or updating tests
chore: maintenance tasks
```

## Known Limitations

1. **Large Files**: No virtualization yet; files with 1000s of text layers may be slow
2. **Mixed Styles**: Text with mixed character styles uses character 0 properties only
3. **Library Names**: Remote library styles show generic IDs (Figma API limitation)
4. **TypeScript Build**: Shows type errors with `--typecheck` flag (safe to ignore)

## Testing

See **[TESTING.md](./TESTING.md)** for comprehensive testing instructions, including:

- Setup instructions for test documents
- Expected behaviors for each audit phase
- State machine transition validation
- Error handling scenarios
- Performance benchmarks

Quick test:

1. Create a Figma file with various text layers
2. Apply text styles to some (not all) layers
3. Run "Run Style Audit" and verify progress updates
4. Review results in Style Tree View

See [Installation & Testing Guide](#installation--development) above for setup.

## Documentation

- **Specification**: `specs/001-font-audit/spec.md`
- **Implementation Plan**: `specs/001-font-audit/plan.md`
- **Task Breakdown**: `specs/001-font-audit/tasks.md`
- **Research Notes**: `specs/001-font-audit/research.md`

## Resources

### Plugin Development

- [Create Figma Plugin Docs](https://yuanqing.github.io/create-figma-plugin/)
- [Figma Plugin API Docs](https://figma.com/plugin-docs/)
- [Figma Plugin Samples](https://github.com/figma/plugin-samples)

### Design System

- [Figma Plugin DS](https://github.com/thomas-lowry/figma-plugin-ds)
- [Tailwind CSS](https://tailwindcss.com/)

## License

MIT

## Credits

Built with [Create Figma Plugin](https://yuanqing.github.io/create-figma-plugin/)

---

**Current Version**: 1.0.0-alpha
**Last Updated**: 2025-11-21
**Status**: Phase 2 In Progress (Style Governance Audit)
