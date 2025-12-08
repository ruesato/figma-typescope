import { describe, it, expect } from 'vitest';
import type {
  UIToMainMessage,
  MainToUIMessage,
  AuditState,
  ReplacementState,
  TextLayerData,
  AuditResult,
  StyleGovernanceAuditResult,
} from '../shared/types';

describe('Message Protocol Types', () => {
  describe('UIToMainMessage', () => {
    it('should accept RUN_AUDIT message', () => {
      const message: UIToMainMessage = {
        type: 'RUN_AUDIT',
        scope: 'page',
      };
      expect(message.type).toBe('RUN_AUDIT');
      expect(message.scope).toBe('page');
    });

    it('should accept RUN_STYLE_AUDIT message', () => {
      const message: UIToMainMessage = {
        type: 'RUN_STYLE_AUDIT',
        payload: { includeHiddenLayers: true, includeTokens: true },
      };
      expect(message.type).toBe('RUN_STYLE_AUDIT');
      expect(message.payload?.includeHiddenLayers).toBe(true);
    });

    it('should accept CANCEL_AUDIT message', () => {
      const message: UIToMainMessage = {
        type: 'CANCEL_AUDIT',
      };
      expect(message.type).toBe('CANCEL_AUDIT');
    });

    it('should accept NAVIGATE_TO_LAYER message', () => {
      const message: UIToMainMessage = {
        type: 'NAVIGATE_TO_LAYER',
        layerId: '123:456',
      };
      expect(message.type).toBe('NAVIGATE_TO_LAYER');
      expect(message.layerId).toBe('123:456');
    });
  });

  describe('MainToUIMessage', () => {
    it('should accept AUDIT_STARTED message', () => {
      const message: MainToUIMessage = {
        type: 'AUDIT_STARTED',
      };
      expect(message.type).toBe('AUDIT_STARTED');
    });

    it('should accept AUDIT_PROGRESS message', () => {
      const message: MainToUIMessage = {
        type: 'AUDIT_PROGRESS',
        progress: 50,
        current: 10,
        total: 20,
      };
      expect(message.type).toBe('AUDIT_PROGRESS');
      expect(message.progress).toBe(50);
    });

    it('should accept AUDIT_ERROR message', () => {
      const message: MainToUIMessage = {
        type: 'AUDIT_ERROR',
        error: 'Test error',
        errorType: 'VALIDATION',
      };
      expect(message.type).toBe('AUDIT_ERROR');
      expect(message.errorType).toBe('VALIDATION');
    });

    it('should accept STYLE_AUDIT_COMPLETE message', () => {
      const mockResult: StyleGovernanceAuditResult = {
        timestamp: new Date(),
        documentName: 'Test Document',
        documentId: 'doc-123',
        totalPages: 5,
        totalTextLayers: 100,
        styles: [],
        tokens: [],
        layers: [],
        libraries: [],
        styleHierarchy: [],
        styledLayers: [],
        unstyledLayers: [],
        metrics: {
          styleAdoptionRate: 75,
          fullyStyledCount: 60,
          partiallyStyledCount: 15,
          unstyledCount: 25,
          libraryDistribution: {},
          tokenAdoptionRate: 50,
          tokenCoverageRate: 40,
          totalTokenCount: 20,
          uniqueTokensUsed: 8,
          unusedTokenCount: 12,
          totalTokenBindings: 50,
          tokensByCollection: {},
          elementCount: 100,
          elementsWithTokens: 50,
          elementsWithoutTokens: 50,
          fullTokenCoverageCount: 10,
          fullTokenCoverageRate: 10,
          partialTokenCoverageCount: 40,
          partialTokenCoverageRate: 40,
          noTokenCoverageCount: 50,
          noTokenCoverageRate: 50,
          tokenUsageCount: 50,
          mixedUsageCount: 30,
          topStyles: [],
          deprecatedStyleCount: 0,
        },
        isStale: false,
        auditDuration: 1500,
      };

      const message: MainToUIMessage = {
        type: 'STYLE_AUDIT_COMPLETE',
        payload: {
          result: mockResult,
          duration: 1500,
        },
      };
      expect(message.type).toBe('STYLE_AUDIT_COMPLETE');
      expect(message.payload.duration).toBe(1500);
    });
  });

  describe('State Machine Types', () => {
    it('should accept valid AuditState values', () => {
      const states: AuditState[] = [
        'idle',
        'validating',
        'scanning',
        'processing',
        'complete',
        'error',
        'cancelled',
      ];
      states.forEach((state) => {
        expect(state).toBeTruthy();
      });
    });

    it('should accept valid ReplacementState values', () => {
      const states: ReplacementState[] = [
        'idle',
        'validating',
        'creating_checkpoint',
        'processing',
        'complete',
        'error',
      ];
      states.forEach((state) => {
        expect(state).toBeTruthy();
      });
    });
  });
});

describe('Data Structure Types', () => {
  it('should create valid TextLayerData', () => {
    const textLayer: TextLayerData = {
      id: '123:456',
      content: 'Hello World',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      lineHeight: { unit: 'AUTO' },
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true,
      componentContext: {
        componentType: 'plain',
        hierarchyPath: ['Page', 'Frame'],
        overrideStatus: 'default',
      },
      styleAssignment: {
        assignmentStatus: 'unstyled',
      },
    };

    expect(textLayer.id).toBe('123:456');
    expect(textLayer.fontFamily).toBe('Inter');
    expect(textLayer.styleAssignment.assignmentStatus).toBe('unstyled');
  });

  it('should create valid AuditResult', () => {
    const result: AuditResult = {
      textLayers: [],
      summary: {
        totalTextLayers: 10,
        uniqueFontFamilies: 2,
        styleCoveragePercent: 80,
        librariesInUse: ['Local'],
        potentialMatchesCount: 2,
        hiddenLayersCount: 1,
      },
      timestamp: new Date().toISOString(),
      fileName: 'Test File',
      tokenInventory: [],
      tokenUsageCount: 0,
      tokenAdoptionRate: 0,
    };

    expect(result.summary.totalTextLayers).toBe(10);
    expect(result.summary.styleCoveragePercent).toBe(80);
  });
});
