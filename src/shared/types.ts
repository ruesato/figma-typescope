// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Line height can be pixels, percentage, or auto
 */
export type LineHeight =
  | { value: number; unit: 'PIXELS' }
  | { value: number; unit: 'PERCENT' }
  | { unit: 'AUTO' };

/**
 * Standard RGBA color representation
 */
export interface RGBA {
  r: number; // 0-1 range
  g: number; // 0-1 range
  b: number; // 0-1 range
  a: number; // 0-1 range (opacity)
}

/**
 * Component hierarchy and instance metadata
 */
export interface ComponentContext {
  componentType: 'main-component' | 'instance' | 'plain';
  hierarchyPath: string[]; // Breadcrumb path (e.g., ["Page", "Card", "Button", "Label"])
  overrideStatus: 'default' | 'overridden' | 'detached';
}

/**
 * Text style application status and property match details
 */
export interface StyleAssignment {
  assignmentStatus: 'fully-styled' | 'partially-styled' | 'unstyled';
  styleId?: string; // Figma style ID (required if styled)
  styleName?: string; // Full style name (e.g., "Body/Large")
  libraryName?: string; // Library source (e.g., "Core Design System")
  propertyMatches?: PropertyMatchMap; // Which properties match/differ
}

/**
 * Property match map for partially-styled text
 */
export interface PropertyMatchMap {
  fontFamily: boolean;
  fontSize: boolean;
  fontWeight: boolean;
  lineHeight: boolean;
  color: boolean;
}

/**
 * Differing property for style match suggestions
 */
export interface DifferingProperty {
  property: 'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'color';
  textValue: string; // Current text property value
  styleValue: string; // Style property value
}

/**
 * Style match suggestion for unstyled text
 */
export interface StyleMatchSuggestion {
  suggestedStyleId: string; // Figma style ID
  suggestedStyleName: string; // Full style name
  libraryName: string; // Library source
  similarityScore: number; // 0.80-1.00 (80%-100%)
  matchingProperties: string[]; // Properties that match
  differingProperties: DifferingProperty[]; // Properties that differ
}

/**
 * Complete text layer data with font, style, and component metadata
 */
export interface TextLayerData {
  // Identity
  id: string; // Figma node ID (unique identifier)
  content: string; // Text content (first 50 chars for preview)

  // Font Properties
  fontFamily: string; // Font family name (e.g., "Inter")
  fontSize: number; // Font size in pixels
  fontWeight: number; // Font weight (100-900)
  lineHeight: LineHeight; // Line height (pixels, %, or "AUTO")

  // Visual Properties
  color: RGBA; // Text color {r, g, b, a}
  opacity: number; // Layer opacity (0-1)
  visible: boolean; // Visibility state

  // Context
  componentContext: ComponentContext; // Component hierarchy info
  styleAssignment: StyleAssignment; // Text style application details
  matchSuggestions?: StyleMatchSuggestion[]; // Close style matches (only for unstyled text)
}

/**
 * Aggregate metrics calculated from audit results
 */
export interface AuditSummary {
  totalTextLayers: number; // Total text nodes discovered
  uniqueFontFamilies: number; // Distinct font families
  styleCoveragePercent: number; // % of text with styles applied (0-100)
  librariesInUse: string[]; // Library names
  potentialMatchesCount: number; // Unstyled text with ≥80% matches
  hiddenLayersCount: number; // Invisible text layers
}

/**
 * Complete audit output containing all discovered text layers and summary metrics
 */
export interface AuditResult {
  textLayers: TextLayerData[]; // All discovered text nodes
  summary: AuditSummary; // Aggregate metrics
  timestamp: string; // ISO 8601 format
  fileName: string; // Figma file name
}

// ============================================================================
// Message Protocol Types (PostMessage communication)
// ============================================================================

/**
 * Messages sent from UI context to main context (user actions)
 */
export type UIToMainMessage =
  | { type: 'RUN_AUDIT'; scope: 'page' | 'selection' }
  | { type: 'NAVIGATE_TO_LAYER'; layerId: string }
  | { type: 'CANCEL_AUDIT' };

/**
 * Messages sent from main context to UI context (audit status updates and results)
 */
export type MainToUIMessage =
  | { type: 'AUDIT_STARTED' }
  | {
      type: 'AUDIT_PROGRESS';
      progress: number; // 0-100 percentage
      current: number; // Current node index
      total: number; // Total nodes to process
    }
  | { type: 'AUDIT_COMPLETE'; result: AuditResult }
  | {
      type: 'AUDIT_ERROR';
      error: string; // User-friendly error message
      errorType: 'VALIDATION' | 'API' | 'UNKNOWN';
    }
  | { type: 'NAVIGATE_SUCCESS' }
  | { type: 'NAVIGATE_ERROR'; error: string };

// ============================================================================
// Export Format Types
// ============================================================================

/**
 * Font inventory entry for PDF export
 */
export interface FontInventoryEntry {
  fontFamily: string;
  weights: number[];
  sizes: number[];
  layerCount: number;
}

/**
 * Style usage entry for PDF export
 */
export interface StyleUsageEntry {
  libraryName: string;
  styleName: string;
  usageCount: number;
}

/**
 * Component breakdown entry for PDF export
 */
export interface ComponentBreakdownEntry {
  componentType: 'main-component' | 'instance' | 'plain';
  count: number;
  percentage: number;
}

/**
 * Complete data structure for PDF export
 */
export interface PDFExportData {
  summary: AuditSummary;
  fontInventory: FontInventoryEntry[];
  styleUsage: StyleUsageEntry[];
  unstyledText: TextLayerData[];
  partialMatches: TextLayerData[];
  componentBreakdown: ComponentBreakdownEntry[];
  hiddenText: TextLayerData[];
}

/**
 * CSV row format for flat table export
 */
export interface CSVRow {
  'Layer ID': string;
  Content: string;
  'Font Family': string;
  'Font Size': number;
  'Font Weight': number;
  'Line Height': string;
  Color: string;
  Opacity: number;
  Visible: boolean;
  'Component Type': string;
  'Hierarchy Path': string;
  'Override Status': string;
  'Style Assignment': string;
  'Style Name': string;
  'Library Name': string;
  'Close Match': string;
  Similarity: string;
}

// ============================================================================
// Error Handling Types
// ============================================================================

/**
 * Audit error with context for debugging
 */
export interface AuditError {
  nodeId?: string; // Failed node ID (if applicable)
  errorType: 'VALIDATION' | 'API' | 'UNKNOWN';
  message: string;
  retryAttempts?: number; // Number of retries attempted
}
