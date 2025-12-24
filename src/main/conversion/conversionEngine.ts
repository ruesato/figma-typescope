/**
 * Conversion Engine - Convert Remote Styles to Local Styles
 *
 * Handles the conversion of remote text styles to local styles with optional property overrides.
 * Supports both manual property values and design token bindings.
 */

import type {
  ConversionRequest,
  ConversionResult,
  ConversionMapping,
  PropertyOverrideMap,
  PropertyOverrideValue,
  TextStyle,
  LineHeight,
  LetterSpacing,
  RGBA,
} from '@/shared/types';

/**
 * Convert remote styles to local styles with optional property overrides
 */
export async function convertStylesToLocal(
  request: ConversionRequest
): Promise<ConversionResult> {
  const startTime = Date.now();
  const { sourceStyleIds, propertyOverrides } = request;

  console.log(`[ConversionEngine] Converting ${sourceStyleIds.length} styles with overrides:`, propertyOverrides);

  const newLocalStyles: TextStyle[] = [];
  const stylesMapped: ConversionMapping[] = [];
  const errors: string[] = [];

  // Get existing local style names to avoid conflicts
  const existingNames = new Set(figma.getLocalTextStyles().map(s => s.name));

  for (const styleId of sourceStyleIds) {
    try {
      // Get source style
      const sourceStyle = await figma.getStyleByIdAsync(styleId);
      if (!sourceStyle || sourceStyle.type !== 'TEXT') {
        errors.push(`Style ${styleId} not found or not a text style`);
        continue;
      }

      // Resolve name conflict
      const newStyleName = resolveNameConflict(sourceStyle.name, existingNames);
      existingNames.add(newStyleName); // Track for subsequent iterations

      // Create local style with overrides
      const newFigmaStyle = await createLocalStyleWithOverrides(
        sourceStyle as any,
        newStyleName,
        propertyOverrides
      );

      // Build TextStyle object for return value
      const styleData = buildTextStyleData(newFigmaStyle);

      newLocalStyles.push(styleData);
      stylesMapped.push({
        sourceStyleId: styleId,
        sourceStyleName: sourceStyle.name,
        newStyleId: newFigmaStyle.id,
        newStyleName: newFigmaStyle.name,
      });

      console.log(`[ConversionEngine] Created local style: ${newStyleName} (from ${sourceStyle.name})`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to convert style ${styleId}: ${errorMsg}`);
      console.error(`[ConversionEngine] Error converting style ${styleId}:`, error);
    }
  }

  const duration = Date.now() - startTime;
  const totalConverted = stylesMapped.length;
  const totalFailed = sourceStyleIds.length - totalConverted;

  console.log(
    `[ConversionEngine] Conversion complete: ${totalConverted} succeeded, ${totalFailed} failed in ${duration}ms`
  );

  return {
    newLocalStyles,
    stylesMapped,
    totalConverted,
    totalFailed,
    errors,
    duration,
  };
}

/**
 * Create a local style from a source style with property overrides
 */
async function createLocalStyleWithOverrides(
  sourceStyle: any, // Figma TextStyle
  newStyleName: string,
  overrides: PropertyOverrideMap
): Promise<any> { // Returns Figma TextStyle
  // Load the source font first
  try {
    await figma.loadFontAsync(sourceStyle.fontName);
  } catch (error) {
    console.warn(`[ConversionEngine] Failed to load source font:`, error);
    throw new Error(
      `Cannot load font "${sourceStyle.fontName.family} ${sourceStyle.fontName.style}". ` +
        `The font may be missing from your system.`
    );
  }

  // Create new local text style
  const localStyle = figma.createTextStyle();
  localStyle.name = newStyleName;

  // Copy ALL properties from source style
  localStyle.fontName = sourceStyle.fontName;
  localStyle.fontSize = sourceStyle.fontSize;
  localStyle.letterSpacing = sourceStyle.letterSpacing;
  localStyle.lineHeight = sourceStyle.lineHeight;
  localStyle.paragraphIndent = sourceStyle.paragraphIndent;
  localStyle.paragraphSpacing = sourceStyle.paragraphSpacing;
  localStyle.textCase = sourceStyle.textCase;
  localStyle.textDecoration = sourceStyle.textDecoration;
  localStyle.description = sourceStyle.description || '';

  // Copy fills (colors)
  if (sourceStyle.paints && sourceStyle.paints.length > 0) {
    localStyle.paints = JSON.parse(JSON.stringify(sourceStyle.paints));
  }

  // Copy variable bindings from source style
  if (sourceStyle.boundVariables) {
    for (const [property, bindings] of Object.entries(sourceStyle.boundVariables)) {
      const bindingArray = Array.isArray(bindings) ? bindings : [bindings];

      for (const binding of bindingArray) {
        if (binding && typeof binding === 'object' && 'id' in binding) {
          try {
            const variable = await figma.variables.getVariableByIdAsync(binding.id);
            if (variable) {
              localStyle.setBoundVariable(property as any, variable);
            }
          } catch (error) {
            console.warn(`[ConversionEngine] Failed to copy variable binding for ${property}:`, error);
          }
        }
      }
    }
  }

  // Apply property overrides
  await applyPropertyOverrides(localStyle, overrides);

  return localStyle;
}

/**
 * Build TextStyle data object from Figma TextStyle
 */
function buildTextStyleData(figmaStyle: any): TextStyle {
  // Extract font properties
  const fontFamily = figmaStyle.fontName?.family || 'Unknown';
  const fontSize = figmaStyle.fontSize || 16;
  const fontWeight = figmaStyle.fontName?.style ? parseFontWeight(figmaStyle.fontName.style) : 400;
  const lineHeight = figmaStyle.lineHeight ? extractLineHeight(figmaStyle.lineHeight) : { unit: 'AUTO' as const };
  const letterSpacing = figmaStyle.letterSpacing
    ? extractLetterSpacing(figmaStyle.letterSpacing)
    : { unit: 'PIXELS' as const, value: 0 };

  // Extract fills (text color)
  const fills: RGBA[] = [];
  if (figmaStyle.paints && Array.isArray(figmaStyle.paints)) {
    for (const paint of figmaStyle.paints) {
      if (paint.type === 'SOLID' && paint.visible !== false) {
        fills.push({
          r: paint.color.r,
          g: paint.color.g,
          b: paint.color.b,
          a: paint.opacity ?? 1,
        });
      }
    }
  }

  return {
    id: figmaStyle.id,
    name: figmaStyle.name,
    key: figmaStyle.key,

    hierarchyPath: parseStyleHierarchy(figmaStyle.name),
    parentStyleId: undefined,
    childStyleIds: [],

    sourceType: 'local',
    libraryName: 'Local',
    libraryId: 'local',

    usageCount: 0,
    pageDistribution: [],
    componentUsage: {
      mainComponentCount: 0,
      instanceCount: 0,
      plainLayerCount: 0,
      overrideCount: 0,
    },

    isDeprecated: false,
    lastModified: undefined,

    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    fills,

    tokens: [],
  };
}

/**
 * Parse style hierarchy from name (e.g., "Heading/H1" → ["Heading", "H1"])
 */
function parseStyleHierarchy(name: string): string[] {
  return name.split('/').map((s) => s.trim());
}

/**
 * Parse font weight from font style name
 */
function parseFontWeight(styleName: string): number {
  const lowerStyle = styleName.toLowerCase();
  if (lowerStyle.includes('thin')) return 100;
  if (lowerStyle.includes('extralight') || lowerStyle.includes('ultralight')) return 200;
  if (lowerStyle.includes('light')) return 300;
  if (lowerStyle.includes('medium')) return 500;
  if (lowerStyle.includes('semibold') || lowerStyle.includes('demibold')) return 600;
  if (lowerStyle.includes('bold')) return 700;
  if (lowerStyle.includes('extrabold') || lowerStyle.includes('ultrabold')) return 800;
  if (lowerStyle.includes('black') || lowerStyle.includes('heavy')) return 900;
  return 400; // Regular
}

/**
 * Extract line height value
 */
function extractLineHeight(lineHeight: any): LineHeight {
  if (lineHeight.unit === 'AUTO') {
    return { unit: 'AUTO' };
  } else if (lineHeight.unit === 'PIXELS') {
    return { value: lineHeight.value, unit: 'PIXELS' };
  } else if (lineHeight.unit === 'PERCENT') {
    return { value: lineHeight.value, unit: 'PERCENT' };
  }
  return { unit: 'AUTO' };
}

/**
 * Extract letter spacing value
 */
function extractLetterSpacing(letterSpacing: any): LetterSpacing {
  if (letterSpacing.unit === 'PIXELS') {
    return { value: letterSpacing.value, unit: 'PIXELS' };
  } else if (letterSpacing.unit === 'PERCENT') {
    return { value: letterSpacing.value, unit: 'PERCENT' };
  }
  return { value: 0, unit: 'PIXELS' };
}

/**
 * Apply property overrides to a text style
 */
async function applyPropertyOverrides(
  style: any, // Figma TextStyle
  overrides: PropertyOverrideMap
): Promise<void> {
  // Font Family
  if (overrides.fontFamily) {
    await applyFontFamilyOverride(style, overrides.fontFamily);
  }

  // Font Size
  if (overrides.fontSize) {
    await applyPropertyOverride(style, 'fontSize', overrides.fontSize);
  }

  // Font Weight
  if (overrides.fontWeight) {
    await applyFontWeightOverride(style, overrides.fontWeight);
  }

  // Line Height
  if (overrides.lineHeight) {
    await applyLineHeightOverride(style, overrides.lineHeight);
  }

  // Letter Spacing
  if (overrides.letterSpacing) {
    await applyLetterSpacingOverride(style, overrides.letterSpacing);
  }

  // Color (fills)
  if (overrides.color) {
    await applyColorOverride(style, overrides.color);
  }

  // Paragraph Spacing
  if (overrides.paragraphSpacing) {
    await applyPropertyOverride(style, 'paragraphSpacing', overrides.paragraphSpacing);
  }

  // Text Case
  if (overrides.textCase) {
    await applyTextCaseOverride(style, overrides.textCase);
  }

  // Text Decoration
  if (overrides.textDecoration) {
    await applyTextDecorationOverride(style, overrides.textDecoration);
  }
}

/**
 * Apply font family override
 */
async function applyFontFamilyOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    // Manual font family value - need to load the font
    const family = String(override.value);
    const currentStyle = style.fontName.style;

    try {
      await figma.loadFontAsync({ family, style: currentStyle });
      style.fontName = { family, style: currentStyle };
    } catch (error) {
      // Try with Regular as fallback
      if (currentStyle !== 'Regular') {
        try {
          await figma.loadFontAsync({ family, style: 'Regular' });
          style.fontName = { family, style: 'Regular' };
          console.warn(
            `[ConversionEngine] Font ${family} ${currentStyle} not found, using Regular`
          );
        } catch (fallbackError) {
          console.warn(`[ConversionEngine] Failed to load font ${family}:`, fallbackError);
          throw new Error(
            `Cannot load font "${family} ${currentStyle}" or "${family} Regular". ` +
              `The font may be missing from your system.`
          );
        }
      } else {
        throw new Error(
          `Cannot load font "${family} Regular". The font may be missing from your system.`
        );
      }
    }
  } else {
    // Token binding
    const variable = await figma.variables.getVariableByIdAsync(override.tokenId);
    if (!variable) {
      throw new Error(`Token ${override.tokenName} not found`);
    }

    // Load font from variable value
    const targetValue = variable.valuesByMode[Object.keys(variable.valuesByMode)[0]];
    if (typeof targetValue === 'string') {
      const family = targetValue;
      const currentStyle = style.fontName.style;

      try {
        await figma.loadFontAsync({ family, style: currentStyle });
      } catch (error) {
        // Try with Regular as fallback
        if (currentStyle !== 'Regular') {
          try {
            await figma.loadFontAsync({ family, style: 'Regular' });
          } catch (fallbackError) {
            throw new Error(
              `Cannot load font "${family} ${currentStyle}" or "${family} Regular". ` +
                `The font may be missing from your system.`
            );
          }
        } else {
          throw new Error(
            `Cannot load font "${family} Regular". The font may be missing from your system.`
          );
        }
      }
    }

    style.setBoundVariable('fontFamily', variable);
  }
}

/**
 * Apply font weight override
 */
async function applyFontWeightOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    // Font weight requires changing fontName.style
    const weight = Number(override.value);
    const weightToStyle: Record<number, string> = {
      100: 'Thin',
      200: 'ExtraLight',
      300: 'Light',
      400: 'Regular',
      500: 'Medium',
      600: 'SemiBold',
      700: 'Bold',
      800: 'ExtraBold',
      900: 'Black',
    };

    const newStyle = weightToStyle[weight] || 'Regular';
    const family = style.fontName.family;

    try {
      await figma.loadFontAsync({ family, style: newStyle });
      style.fontName = { family, style: newStyle };
    } catch (error) {
      console.warn(`[ConversionEngine] Failed to load font weight ${weight}:`, error);
      // Keep existing weight on error
    }
  } else {
    // Token binding - Figma doesn't support fontWeight token binding directly
    // We need to apply it as a custom property or skip
    console.warn(
      `[ConversionEngine] Font weight token binding not directly supported, skipping`
    );
  }
}

/**
 * Apply line height override
 */
async function applyLineHeightOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = override.value;
    if (typeof value === 'number') {
      // Assume pixels
      style.lineHeight = { value, unit: 'PIXELS' };
    } else if (typeof value === 'string') {
      // Parse string format like "1.5" or "150%" or "AUTO"
      if (value.toLowerCase() === 'auto') {
        style.lineHeight = { unit: 'AUTO' };
      } else if (value.endsWith('%')) {
        const numValue = parseFloat(value);
        style.lineHeight = { value: numValue, unit: 'PERCENT' };
      } else {
        const numValue = parseFloat(value);
        style.lineHeight = { value: numValue, unit: 'PIXELS' };
      }
    }
  } else {
    // Token binding
    const variable = await figma.variables.getVariableByIdAsync(override.tokenId);
    if (variable) {
      style.setBoundVariable('lineHeight', variable);
    }
  }
}

/**
 * Apply letter spacing override
 */
async function applyLetterSpacingOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = override.value;
    if (typeof value === 'number') {
      // Assume pixels
      style.letterSpacing = { value, unit: 'PIXELS' };
    } else if (typeof value === 'string') {
      // Parse string format like "1.5" or "150%"
      if (value.endsWith('%')) {
        const numValue = parseFloat(value);
        style.letterSpacing = { value: numValue, unit: 'PERCENT' };
      } else {
        const numValue = parseFloat(value);
        style.letterSpacing = { value: numValue, unit: 'PIXELS' };
      }
    }
  } else {
    // Token binding
    const variable = await figma.variables.getVariableByIdAsync(override.tokenId);
    if (variable) {
      style.setBoundVariable('letterSpacing', variable);
    }
  }
}

/**
 * Apply color override
 */
async function applyColorOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    // Parse color string (hex, rgb, etc.)
    const colorValue = String(override.value);
    const color = parseColor(colorValue);
    if (color) {
      style.paints = [{ type: 'SOLID', color, opacity: 1 }];
    }
  } else {
    // Token binding
    const variable = await figma.variables.getVariableByIdAsync(override.tokenId);
    if (variable) {
      style.setBoundVariable('fills', variable);
    }
  }
}

/**
 * Apply text case override
 */
async function applyTextCaseOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = String(override.value).toUpperCase();
    if (['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'].includes(value)) {
      style.textCase = value as TextCase;
    }
  } else {
    console.warn(`[ConversionEngine] Text case token binding not supported, skipping`);
  }
}

/**
 * Apply text decoration override
 */
async function applyTextDecorationOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = String(override.value).toUpperCase();
    if (['NONE', 'UNDERLINE', 'STRIKETHROUGH'].includes(value)) {
      style.textDecoration = value as TextDecoration;
    }
  } else {
    console.warn(`[ConversionEngine] Text decoration token binding not supported, skipping`);
  }
}

/**
 * Apply a simple property override (fontSize, paragraphSpacing)
 */
async function applyPropertyOverride(
  style: any, // Figma TextStyle
  property: 'fontSize' | 'paragraphSpacing',
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = Number(override.value);
    if (!isNaN(value)) {
      (style as any)[property] = value;
    }
  } else {
    // Token binding
    const variable = await figma.variables.getVariableByIdAsync(override.tokenId);
    if (variable) {
      style.setBoundVariable(property, variable);
    }
  }
}

/**
 * Resolve name conflicts by appending " (Copy)" or " (Copy N)"
 */
function resolveNameConflict(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  // Try " (Copy)" first
  let candidateName = `${baseName} (Copy)`;
  if (!existingNames.has(candidateName)) {
    return candidateName;
  }

  // Try " (Copy N)" with incrementing counter
  let counter = 2;
  while (existingNames.has(`${baseName} (Copy ${counter})`)) {
    counter++;
  }

  return `${baseName} (Copy ${counter})`;
}

/**
 * Parse color string to RGB
 * Supports hex (#RRGGBB, #RGB), rgb(r,g,b), and named colors
 */
function parseColor(colorStr: string): RGB | null {
  // Trim whitespace
  const str = colorStr.trim();

  // Hex format #RRGGBB or #RGB
  if (str.startsWith('#')) {
    const hex = str.substring(1);
    let r: number, g: number, b: number;

    if (hex.length === 3) {
      // Short format #RGB
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
    } else if (hex.length === 6) {
      // Full format #RRGGBB
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
    } else {
      return null;
    }

    return { r, g, b };
  }

  // RGB format rgb(r, g, b)
  const rgbMatch = str.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]) / 255,
      g: parseInt(rgbMatch[2]) / 255,
      b: parseInt(rgbMatch[3]) / 255,
    };
  }

  // Named colors (basic set)
  const namedColors: Record<string, RGB> = {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 1, g: 1, b: 1 },
    red: { r: 1, g: 0, b: 0 },
    green: { r: 0, g: 1, b: 0 },
    blue: { r: 0, g: 0, b: 1 },
  };

  return namedColors[str.toLowerCase()] || null;
}
