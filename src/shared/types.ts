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
  // Legacy audit messages
  | { type: 'RUN_AUDIT'; scope: 'page' | 'selection' }
  | { type: 'CANCEL_AUDIT' }
  | { type: 'NAVIGATE_TO_LAYER'; layerId: string }

  // Style governance audit messages
  | { type: 'RUN_STYLE_AUDIT'; payload?: { includeHiddenLayers?: boolean; includeTokens?: boolean } }
  | { type: 'CANCEL_STYLE_AUDIT' }

  // Replacement messages
  | {
      type: 'REPLACE_STYLE';
      payload: {
        sourceStyleId: string;
        targetStyleId: string;
        affectedLayerIds: string[];
        preserveOverrides?: boolean;
        skipComponentInstances?: boolean;
      }
    }
  | {
      type: 'REPLACE_TOKEN';
      payload: {
        sourceTokenId: string;
        targetTokenId: string;
        affectedLayerIds: string[];
        propertyTypes?: string[];
      }
    }

  // Export messages
  | {
      type: 'EXPORT_PDF';
      payload: {
        auditResult: StyleGovernanceAuditResult;
        options?: {
          includeCharts?: boolean;
          includeDetailedTables?: boolean;
          pageOrientation?: 'portrait' | 'landscape';
        }
      }
    }
  | {
      type: 'EXPORT_CSV';
      payload: {
        auditResult: StyleGovernanceAuditResult;
        options?: {
          includeHeaders?: boolean;
          delimiter?: string;
        }
      }
    };

/**
 * Messages sent from main context to UI context (audit status updates and results)
 */
export type MainToUIMessage =
  // Legacy audit messages
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

  // Navigation messages
  | { type: 'NAVIGATE_SUCCESS' }
  | { type: 'NAVIGATE_ERROR'; error: string }

  // Style governance audit messages
  | { type: 'STYLE_AUDIT_STARTED'; payload: { state: 'validating'; totalPages?: number } }
  | {
      type: 'STYLE_AUDIT_PROGRESS';
      payload: {
        state: 'scanning' | 'processing';
        progress: number;
        currentStep: string;
        pagesScanned?: number;
        layersProcessed?: number;
      }
    }
  | { type: 'STYLE_AUDIT_COMPLETE'; payload: { result: StyleGovernanceAuditResult; duration: number } }
  | {
      type: 'STYLE_AUDIT_ERROR';
      payload: {
        error: string;
        errorType: 'validation' | 'scanning' | 'processing' | 'unknown';
        canRetry: boolean;
        details?: string;
      }
    }
  | { type: 'STYLE_AUDIT_CANCELLED'; payload: { partialResults?: Partial<StyleGovernanceAuditResult> } }
  | {
      type: 'STYLE_AUDIT_INVALIDATED';
      payload: {
        reason: 'document_modified' | 'style_changed' | 'token_changed';
        changeDetails?: string;
      }
    }

  // Replacement messages
  | {
      type: 'REPLACEMENT_STARTED';
      payload: {
        operationType: 'style' | 'token';
        state: 'validating';
        sourceId: string;
        targetId: string;
        affectedLayerCount: number;
      }
    }
  | {
      type: 'REPLACEMENT_CHECKPOINT_CREATED';
      payload: {
        checkpointTitle: string;
        timestamp: Date;
      }
    }
  | {
      type: 'REPLACEMENT_PROGRESS';
      payload: {
        state: 'processing';
        progress: number;
        currentBatch: number;
        totalBatches: number;
        currentBatchSize: number;
        layersProcessed: number;
        failedLayers: number;
      }
    }
  | {
      type: 'REPLACEMENT_COMPLETE';
      payload: {
        operationType: 'style' | 'token';
        layersUpdated: number;
        failedLayers?: FailedLayer[];
        duration: number;
        hasWarnings: boolean;
      }
    }
  | {
      type: 'REPLACEMENT_ERROR';
      payload: {
        operationType: 'style' | 'token';
        error: string;
        errorType: 'validation' | 'checkpoint' | 'processing' | 'permission';
        checkpointTitle?: string;
        canRollback: boolean;
        details?: string;
      }
    }

  // Export messages
  | { type: 'EXPORT_PDF_STARTED' }
  | {
      type: 'EXPORT_PDF_COMPLETE';
      payload: {
        blobUrl: string;
        filename: string;
        fileSize: number;
      }
    }
  | { type: 'EXPORT_CSV_STARTED' }
  | {
      type: 'EXPORT_CSV_COMPLETE';
      payload: {
        blobUrl: string;
        filename: string;
        fileSize: number;
        rowCount: number;
      }
    }
  | {
      type: 'EXPORT_ERROR';
      payload: {
        exportType: 'pdf' | 'csv';
        error: string;
        details?: string;
      }
    };

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

// ============================================================================
// Style Governance Types (Feature 002)
// ============================================================================

// ----------------------------------------------------------------------------
// State Machines
// ----------------------------------------------------------------------------

/**
 * Audit operation states
 */
export type AuditState =
  | 'idle'          // No audit running; UI shows "Run Audit"
  | 'validating'    // Checking document accessibility, counting layers
  | 'scanning'      // Traversing pages, discovering text nodes
  | 'processing'    // Extracting metadata, building inventory
  | 'complete'      // Audit finished successfully
  | 'error'         // Audit failed with error
  | 'cancelled';    // User cancelled operation

/**
 * Replacement operation states (no cancelled - operations cannot be cancelled after checkpoint)
 */
export type ReplacementState =
  | 'idle'                 // No replacement running
  | 'validating'           // Checking source/target validity, counting layers
  | 'creating_checkpoint'  // Creating version history savepoint
  | 'processing'           // Applying changes in batches
  | 'complete'             // Replacement finished successfully
  | 'error';               // Replacement failed with error

// ----------------------------------------------------------------------------
// Core Entities (Style Governance)
// ----------------------------------------------------------------------------

/**
 * Text layer with style and token metadata
 */
export interface TextLayer {
  // Identity
  id: string;                    // Figma node ID
  name: string;                  // Layer name from Figma

  // Content
  textContent: string;           // Text content preview (first 50 chars)
  characters: number;            // Total character count

  // Location
  pageId: string;                // Parent page ID
  pageName: string;              // Parent page name
  parentType: 'MAIN_COMPONENT' | 'INSTANCE' | 'FRAME' | 'GROUP';
  componentPath?: string;        // Full component hierarchy if in component

  // Style Assignment
  assignmentStatus: 'fully-styled' | 'partially-styled' | 'unstyled';
  styleId?: string;              // Assigned text style ID (if any)
  styleName?: string;            // Resolved style name
  styleSource?: string;          // Library name or "Local"

  // Token Usage
  tokens: TokenBinding[];        // Design tokens applied to this layer

  // Visual Properties
  visible: boolean;              // Layer visibility state
  opacity: number;               // Layer opacity (0-1)

  // Override Status (for component instances)
  hasOverrides: boolean;         // True if style properties locally overridden
  overriddenProperties?: string[]; // List of overridden property names
}

/**
 * Text style with usage metrics
 */
export interface TextStyle {
  // Identity
  id: string;                    // Figma style ID
  name: string;                  // Style name (e.g., "Heading/H1")
  key: string;                   // Unique key for stable references

  // Hierarchy
  hierarchyPath: string[];       // Path components ["Typography", "Heading", "H1"]
  parentStyleId?: string;        // Parent style in hierarchy (if exists)
  childStyleIds: string[];       // Child styles in hierarchy

  // Source
  sourceType: 'local' | 'team_library' | 'published_component';
  libraryName: string;           // Library name or "Local"
  libraryId?: string;            // Library ID (if from library)

  // Usage Metrics
  usageCount: number;            // Total layers using this style
  pageDistribution: PageUsage[]; // Usage breakdown by page
  componentUsage: ComponentUsage; // Usage in components vs plain layers

  // Status
  isDeprecated: boolean;         // Marked as deprecated
  lastModified?: Date;           // Last modification timestamp (if available)
}

export interface PageUsage {
  pageId: string;
  pageName: string;
  layerCount: number;
}

export interface ComponentUsage {
  mainComponentCount: number;    // Usage in main components
  instanceCount: number;         // Usage in instances
  plainLayerCount: number;       // Usage in plain frames/groups
  overrideCount: number;         // Instances with overridden properties
}

/**
 * Design token (variable) used in text properties
 */
export interface DesignToken {
  // Identity
  id: string;                    // Figma variable ID
  name: string;                  // Token name (e.g., "text.primary")
  key: string;                   // Unique stable key

  // Type & Value
  type: 'COLOR' | 'STRING' | 'FLOAT' | 'BOOLEAN';
  resolvedType: string;          // Human-readable type
  currentValue: any;             // Resolved value in current mode

  // Collection & Mode
  collectionId: string;          // Parent collection ID
  collectionName: string;        // Collection display name
  modeId: string;                // Active mode ID
  modeName: string;              // Mode display name
  valuesByMode: Record<string, any>; // All mode values

  // Token Chain (for aliases)
  isAlias: boolean;              // True if references another token
  aliasedTokenId?: string;       // Source token ID if alias
  aliasChain?: string[];         // Full chain (e.g., ["text.primary", "brand.blue", "#0066CC"])

  // Usage Metrics
  usageCount: number;            // Layers using this token
  layerIds: string[];            // Layer IDs using this token
  propertyTypes: string[];       // Which properties use it (e.g., ["fills", "fontFamily"])
}

/**
 * Token binding on a text layer
 */
export interface TokenBinding {
  property: 'fills' | 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing';
  tokenId: string;               // Variable ID
  tokenName: string;             // Resolved token name
  tokenValue: any;               // Resolved value
}

/**
 * Library source (local or external)
 */
export interface LibrarySource {
  // Identity
  id: string;                    // Library ID or "local"
  name: string;                  // Display name (e.g., "Design System v2" or "Local")
  type: 'local' | 'team_library' | 'published_component';

  // Status
  isEnabled: boolean;            // True if library currently enabled
  isAvailable: boolean;          // True if network-accessible

  // Content
  styleCount: number;            // Total styles from this source
  styleIds: string[];            // Style IDs from this source

  // Usage
  totalUsageCount: number;       // Total layers using styles from this source
  usagePercentage: number;       // % of total styled layers (0-100)
}

/**
 * Style hierarchy node for tree rendering
 */
export interface StyleHierarchyNode {
  styleName: string;             // Full style name
  styleId?: string;              // Style ID (if real style, not intermediate node)
  parentName?: string;           // Parent node name
  children: StyleHierarchyNode[]; // Child nodes
  usageCount: number;            // Total usage (including children)
}

/**
 * Audit metrics for analytics dashboard
 */
export interface AuditMetrics {
  // Style Adoption
  styleAdoptionRate: number;     // % of layers with style (0-100)
  fullyStyledCount: number;      // Layers matching style exactly
  partiallyStyledCount: number;  // Layers with overrides
  unstyledCount: number;         // Layers without style

  // Library Distribution
  libraryDistribution: Record<string, number>; // Library name → layer count

  // Token Adoption
  tokenCoverageRate: number;     // % of layers using tokens (0-100)
  tokenUsageCount: number;       // Layers with at least one token
  mixedUsageCount: number;       // Layers with both style and tokens

  // Top Styles
  topStyles: Array<{ styleId: string; styleName: string; usageCount: number }>;
  deprecatedStyleCount: number;  // Count of deprecated style instances
}

/**
 * Complete audit result with styles and tokens
 */
export interface StyleGovernanceAuditResult {
  // Metadata
  timestamp: Date;               // When audit was performed
  documentName: string;          // Figma file name
  documentId: string;            // Figma file ID

  // Scope
  totalPages: number;            // Pages scanned
  totalTextLayers: number;       // Text layers found

  // Inventories
  styles: TextStyle[];           // All detected styles
  tokens: DesignToken[];         // All detected tokens
  layers: TextLayer[];           // All text layers
  libraries: LibrarySource[];    // All library sources

  // Hierarchy
  styleHierarchy: StyleHierarchyNode[]; // Computed hierarchy tree

  // Categorization
  styledLayers: TextLayer[];     // Layers with style assigned
  unstyledLayers: TextLayer[];   // Layers without style

  // Analytics
  metrics: AuditMetrics;         // Computed metrics

  // Status
  isStale: boolean;              // True if document modified since audit
  auditDuration: number;         // Time taken in milliseconds
}

// ----------------------------------------------------------------------------
// Replacement Types
// ----------------------------------------------------------------------------

/**
 * Failed layer during replacement operation
 */
export interface FailedLayer {
  layerId: string;
  layerName: string;
  reason: string;
  retryCount: number;
}

/**
 * Replacement operation result
 */
export interface ReplacementResult {
  success: boolean;
  layersUpdated: number;         // Successfully updated
  layersFailed: number;          // Failed to update
  failedLayers: FailedLayer[];   // Details of failures
  checkpointTitle: string;       // Version history checkpoint
  duration: number;              // Time taken in ms
  hasWarnings: boolean;          // True if partial failures
}

/**
 * Batch processor state for adaptive sizing
 */
export interface BatchProcessorState {
  currentBatchSize: number;      // Current batch size (25-100)
  consecutiveSuccesses: number;  // Count of successful batches since last resize
  totalLayersProcessed: number;  // Total layers updated so far
  totalLayersToProcess: number;  // Total layers in operation
  failedLayers: FailedLayer[];   // Layers that failed to update
}

// ----------------------------------------------------------------------------
// Export Types
// ----------------------------------------------------------------------------

/**
 * Export result with blob URL
 */
export interface ExportResult {
  success: boolean;
  blobUrl: string;                 // Blob URL for download
  filename: string;                // Suggested filename
  fileSize: number;                // Size in bytes
  mimeType: string;                // 'application/pdf' or 'text/csv'
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  documentName: string;
  auditTimestamp: Date;
  totalTextLayers: number;
  totalStyles: number;
  totalTokens: number;
  exportTimestamp: Date;
  pluginVersion: string;
}
