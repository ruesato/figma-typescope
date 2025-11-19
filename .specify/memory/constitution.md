<!--
Sync Impact Report:
- Version: Initial → 1.0.0
- Rationale: First constitution establishing core principles for Figma Font Audit Pro plugin
- Modified principles: None (initial creation)
- Added sections: All core principles, Technical Standards, Development Workflow, Governance
- Removed sections: None
- Templates requiring updates:
  ✅ plan-template.md - Reviewed, constitution check section compatible
  ✅ spec-template.md - Reviewed, no changes needed
  ✅ tasks-template.md - Reviewed, task structure aligns with principles
- Follow-up TODOs: None
-->

# Figma Font Audit Pro Constitution

## Core Principles

### I. Audit Accuracy & Completeness (NON-NEGOTIABLE)

The plugin MUST discover and analyze 100% of text layers in the target scope without false negatives. This includes:
- All text in component hierarchies (main components → instances → nested instances)
- Text in all visibility states (visible and hidden layers)
- Text across all node types (frames, groups, auto-layout, variants, interactive states)
- Complete metadata capture: font family, weight, size, line height, color, opacity, parent type, component path, override status, and visibility state

**Rationale**: The plugin's value proposition depends entirely on comprehensive coverage. Missing even 1% of text layers undermines trust and defeats the primary use case of design system governance.

### II. Performance & Responsiveness

The plugin MUST maintain responsiveness during audits and complete processing within acceptable timeframes:
- 1000 text layers analyzed in <10 seconds
- Progress indicators displayed for operations >2 seconds
- UI remains interactive during scanning (non-blocking architecture)
- Incremental loading for result sets >500 items

**Rationale**: Design files often contain hundreds or thousands of text layers. Slow or blocking UIs lead to abandonment and frustration, especially for design system maintainers running frequent audits.

### III. Figma API Fidelity

All interactions with the Figma Plugin API MUST:
- Use official, documented API methods exclusively (no undocumented workarounds)
- Handle API edge cases gracefully (corrupted layers, missing properties, permission errors)
- Respect Figma's performance guidelines for node traversal
- Maintain compatibility with current Figma API version (update within 30 days of breaking changes)

**Rationale**: Reliability across diverse files and Figma versions is critical. Undocumented APIs break without warning; proper error handling prevents data loss and user confusion.

### IV. User Experience & Clarity

The plugin interface MUST prioritize clarity and actionability:
- Visual indicators differentiate component types, override states, and visibility states
- Click-to-navigate functionality for all displayed items (focuses layer in Figma)
- Search/filter functionality responsive in <200ms for result sets up to 1000 items
- Clear, jargon-free labels for all UI elements (avoid technical Figma API terminology)
- Empty states and error messages provide actionable next steps

**Rationale**: Users include both technical design system maintainers and general designers. Clear visual language and direct navigation reduce cognitive load and enable rapid issue identification.

### V. Data Integrity & Reproducibility

Audit results MUST be deterministic and preserve data integrity:
- Identical scans of identical selections produce identical results
- Metadata captured exactly matches Figma's source data (no rounding, approximation, or interpretation)
- Exported data (CSV, JSON, PDF) represents a complete, accurate snapshot of the audit
- Timestamps and file metadata included in all exports for audit trail purposes

**Rationale**: Design system compliance and handoff documentation require trustworthy data. Non-deterministic results or data drift erode confidence and create disputes during reviews.

### VI. Extensibility & Maintainability

Codebase structure MUST support future enhancements without major refactoring:
- Clear separation between audit engine (traversal/analysis), UI layer, and export logic
- Plugin state management follows Figma plugin best practices
- Data structures designed to accommodate additional metadata fields (prepared for FR-7 and FR-8 future enhancements)
- Commented rationale for non-obvious Figma API usage patterns

**Rationale**: The PRD explicitly identifies v2.0+ features (compliance checking, bulk actions, web reports). A maintainable architecture prevents technical debt and enables rapid feature addition.

## Technical Standards

### Technology Stack

- **Platform**: Figma Plugin API (manifest version 2+)
- **UI Framework**: React 18+ with TypeScript 5+
- **Styling**: Figma Plugin DS (design system components) + Tailwind CSS for custom styling
- **Build Tool**: Vite (fast HMR for development)
- **Testing**: Vitest for unit tests, manual testing for Figma integration
- **Export Libraries**: jsPDF for PDF generation, Papa Parse for CSV export

### Code Quality

- TypeScript strict mode enabled (`strict: true`)
- ESLint with Figma plugin recommended rules
- Prettier for consistent formatting
- No `any` types except for explicitly documented Figma API edge cases
- Meaningful variable names (avoid abbreviations except standard Figma API terms like `TextNode`)

### File Organization

```
figma-fontscope/
├── src/
│   ├── audit/          # Core audit engine (traversal, analysis)
│   ├── ui/             # React components for plugin UI
│   ├── export/         # PDF, CSV, JSON export logic
│   ├── types/          # TypeScript interfaces and types
│   └── utils/          # Helper functions, formatting
├── tests/              # Vitest unit tests
└── manifest.json       # Figma plugin manifest
```

## Development Workflow

### Quality Gates

Before committing code, developers MUST:
1. Verify TypeScript compiles without errors (`tsc --noEmit`)
2. Run linter and fix all errors (`eslint --fix`)
3. Manually test core audit functionality in a test Figma file
4. Update tests if API contracts changed (test-encouraged, not mandatory before implementation)

### Testing Philosophy

- **Test-encouraged**: Tests are valuable but not mandatory before implementation
- **Focus areas for tests**: Core audit traversal logic, metadata extraction, data structure transformations
- **Manual testing required**: Figma plugin integration, UI interactions, export generation
- **Rationale**: Figma plugin environment makes automated integration testing challenging; pragmatic approach balances quality and velocity

### Commit Standards

- Use semantic release format (see CLAUDE.md project instructions)
- Commit messages reference feature/fix with context (e.g., `feat: add hidden layer detection to audit engine`)
- Separate commits for audit logic, UI changes, and export features (easier review and revert)

### Performance Monitoring

- Log audit completion time to console in development mode
- Alert if processing exceeds performance targets (e.g., >10s for 1000 layers)
- Periodically test against large, complex design files (500+ components, 2000+ text layers)

## Governance

### Amendment Process

This constitution can be amended when:
1. Figma API changes require architectural shifts (e.g., new node types, deprecated methods)
2. User feedback reveals principles that conflict with real-world usage patterns
3. New features (FR-7, FR-8, v2.0 capabilities) require additional principles

Amendments require:
- Documented justification (why current principles insufficient)
- Updated constitution with incremented version number
- Review of all templates (plan, spec, tasks) for consistency
- Git commit with clear amendment rationale

### Versioning Policy

- **MAJOR** (e.g., 1.0.0 → 2.0.0): Removing or fundamentally redefining core principles (rare)
- **MINOR** (e.g., 1.0.0 → 1.1.0): Adding new principle or significantly expanding guidance
- **PATCH** (e.g., 1.0.0 → 1.0.1): Clarifications, wording improvements, typo fixes

### Compliance Verification

All feature specifications, plans, and task lists MUST:
- Include explicit "Constitution Check" section
- Document any principle violations with justification (see plan-template.md Complexity Tracking)
- Reference specific principle sections when making architectural decisions

For runtime development guidance, see `CLAUDE.md` files in project root and user home directory.

**Version**: 1.0.0 | **Ratified**: 2025-11-16 | **Last Amended**: 2025-11-16
