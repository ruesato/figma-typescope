# Figma Font Audit Pro (Style Governance Pivot) - GEMINI.md

## 1. Project Overview
**Purpose**: Originally "Figma Font Audit Pro", this project is pivoting to "Design System Style Governance". The goal is to provide comprehensive design system governance, managing text styles and design tokens across Figma documents.
**Current Version**: 1.0.0 (MVP - Font Audit)
**Target**: Implement `specs/002-style-governance/spec.md`.

## 2. Architecture
*   **Platform**: Figma Plugin (Dual Context: Main & UI)
*   **Main Context**: `src/main/` (TypeScript, Figma Plugin API)
*   **UI Context**: `src/ui/` (React 18, Vite, Tailwind CSS)
*   **Communication**: PostMessage API (Type-safe `UIToMainMessage`, `MainToUIMessage`)
*   **Build System**: `build-figma-plugin`, Vite, pnpm

## 3. Key Files & Directories
*   `src/main/code.ts`: Main entry point (sandbox).
*   `src/ui/App.tsx`: UI entry point.
*   `specs/002-style-governance/spec.md`: The source of truth for the new feature set.
*   `README.md`: Current documentation (needs update after pivot).

## 4. Operational Protocols
*   **Style Governance**: Focus on "Style Governance" over "Font Audit".
*   **Testing**: Manual verification in Figma is primary. Automated tests where possible.
*   **Conventions**:
    *   Commit messages: Semantic release (feat, fix, docs, etc.)
    *   Styling: Tailwind CSS + Figma Plugin DS tokens.

## 5. Local Setup
1.  `pnpm install`
2.  `pnpm dev` (Watch mode)
3.  Load in Figma: Plugins -> Development -> Import plugin from manifest -> Select `manifest.json`.
