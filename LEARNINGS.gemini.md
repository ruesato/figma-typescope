# LEARNINGS.gemini.md

## 2025-11-21: Project Initialization
*   **Context**: Reviewed `README.md` and `specs/002-style-governance/spec.md`.
*   **Pivot**: The project is pivoting from a Font Audit tool to a Style Governance tool. This involves replacing the core audit engine to focus on Styles and Tokens rather than raw font properties.
*   **Architecture**: Standard Figma plugin architecture (Main/UI separation).
*   **Next Steps**: Need to analyze the existing `src/main/utils/` to see what can be reused (e.g., traversal logic) vs what needs to be rewritten (audit logic).
