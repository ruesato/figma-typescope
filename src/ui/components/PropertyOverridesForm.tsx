import { X } from 'lucide-react';
import Combobox, { ComboboxOption } from './Combobox';
import type { PropertyOverrideMap, PropertyOverrideValue, DesignToken } from '@/shared/types';

export interface PropertyOverridesFormProps {
  /** All available tokens for selection */
  tokens: DesignToken[];
  /** Current override values */
  overrides: PropertyOverrideMap;
  /** Callback when overrides change */
  onOverridesChange: (overrides: PropertyOverrideMap) => void;
}

/**
 * Property Overrides Form Component
 *
 * Allows users to override text style properties with either:
 * - Manual values (text/number input)
 * - Design token bindings (variable selection)
 *
 * Each property uses a Combobox that supports both manual input and token selection.
 */
export default function PropertyOverridesForm({
  tokens,
  overrides,
  onOverridesChange,
}: PropertyOverridesFormProps) {
  // Update a specific property override
  const updateOverride = (property: keyof PropertyOverrideMap, value: PropertyOverrideValue | null) => {
    const newOverrides = { ...overrides };
    if (value === null) {
      delete newOverrides[property];
    } else {
      newOverrides[property] = value;
    }
    onOverridesChange(newOverrides);
  };

  // Clear a property override
  const clearOverride = (property: keyof PropertyOverrideMap) => {
    updateOverride(property, null);
  };

  // Filter tokens by property type
  const getTokensForProperty = (property: string): DesignToken[] => {
    const propertyTypeMap: Record<string, string[]> = {
      fontFamily: ['string'],
      fontSize: ['number'],
      fontWeight: ['number'],
      lineHeight: ['number'],
      letterSpacing: ['number'],
      color: ['color'],
      paragraphSpacing: ['number'],
    };

    const compatibleTypes = propertyTypeMap[property] || [];
    return tokens.filter((token) => compatibleTypes.includes(token.type));
  };

  // Convert tokens to combobox options
  const getComboboxOptions = (tokens: DesignToken[]): ComboboxOption[] => {
    return tokens.map((token) => ({
      label: token.name,
      value: `token:${token.id}`, // Prefix with 'token:' to distinguish from manual input
      description: `${String(token.value)}`,
    }));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div>
        <h3
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--figma-color-text)',
            marginBottom: '8px',
          }}
        >
          Property Overrides
        </h3>
        <p
          style={{
            fontSize: '11px',
            color: 'var(--figma-color-text-secondary)',
            margin: 0,
          }}
        >
          Optional: Override properties for all converted styles
        </p>
      </div>

      {/* Font Family */}
      <ComboboxPropertyField
        label="Font Family"
        value={overrides.fontFamily}
        tokens={getTokensForProperty('fontFamily')}
        options={getComboboxOptions(getTokensForProperty('fontFamily'))}
        onUpdate={(value) => updateOverride('fontFamily', value)}
        onClear={() => clearOverride('fontFamily')}
        inputType="text"
        placeholder="Type or select font family..."
      />

      {/* Font Size */}
      <ComboboxPropertyField
        label="Font Size"
        value={overrides.fontSize}
        tokens={getTokensForProperty('fontSize')}
        options={getComboboxOptions(getTokensForProperty('fontSize'))}
        onUpdate={(value) => updateOverride('fontSize', value)}
        onClear={() => clearOverride('fontSize')}
        inputType="number"
        placeholder="Type or select font size..."
      />

      {/* Font Weight */}
      <ComboboxPropertyField
        label="Font Weight"
        value={overrides.fontWeight}
        tokens={getTokensForProperty('fontWeight')}
        options={getComboboxOptions(getTokensForProperty('fontWeight'))}
        onUpdate={(value) => updateOverride('fontWeight', value)}
        onClear={() => clearOverride('fontWeight')}
        inputType="number"
        placeholder="100-900 or select token..."
      />

      {/* Line Height */}
      <ComboboxPropertyField
        label="Line Height"
        value={overrides.lineHeight}
        tokens={getTokensForProperty('lineHeight')}
        options={getComboboxOptions(getTokensForProperty('lineHeight'))}
        onUpdate={(value) => updateOverride('lineHeight', value)}
        onClear={() => clearOverride('lineHeight')}
        inputType="text"
        placeholder="AUTO, 1.5, 150%, or select token..."
      />

      {/* Letter Spacing */}
      <ComboboxPropertyField
        label="Letter Spacing"
        value={overrides.letterSpacing}
        tokens={getTokensForProperty('letterSpacing')}
        options={getComboboxOptions(getTokensForProperty('letterSpacing'))}
        onUpdate={(value) => updateOverride('letterSpacing', value)}
        onClear={() => clearOverride('letterSpacing')}
        inputType="text"
        placeholder="0, 1.5, 5%, or select token..."
      />

      {/* Color */}
      <ComboboxPropertyField
        label="Color"
        value={overrides.color}
        tokens={getTokensForProperty('color')}
        options={getComboboxOptions(getTokensForProperty('color'))}
        onUpdate={(value) => updateOverride('color', value)}
        onClear={() => clearOverride('color')}
        inputType="text"
        placeholder="#000000, rgb(), or select token..."
      />

      {/* Paragraph Spacing */}
      <ComboboxPropertyField
        label="Paragraph Spacing"
        value={overrides.paragraphSpacing}
        tokens={getTokensForProperty('paragraphSpacing')}
        options={getComboboxOptions(getTokensForProperty('paragraphSpacing'))}
        onUpdate={(value) => updateOverride('paragraphSpacing', value)}
        onClear={() => clearOverride('paragraphSpacing')}
        inputType="number"
        placeholder="Type or select spacing..."
      />

      {/* Text Case (no tokens, use simple select) */}
      <SelectPropertyField
        label="Text Case"
        value={overrides.textCase}
        onUpdate={(value) => updateOverride('textCase', value)}
        onClear={() => clearOverride('textCase')}
        placeholder="Select text case..."
        options={[
          { label: 'Original', value: 'ORIGINAL' },
          { label: 'UPPERCASE', value: 'UPPER' },
          { label: 'lowercase', value: 'LOWER' },
          { label: 'Title Case', value: 'TITLE' },
        ]}
      />

      {/* Text Decoration (no tokens, use simple select) */}
      <SelectPropertyField
        label="Text Decoration"
        value={overrides.textDecoration}
        onUpdate={(value) => updateOverride('textDecoration', value)}
        onClear={() => clearOverride('textDecoration')}
        placeholder="Select decoration..."
        options={[
          { label: 'None', value: 'NONE' },
          { label: 'Underline', value: 'UNDERLINE' },
          { label: 'Strikethrough', value: 'STRIKETHROUGH' },
        ]}
      />
    </div>
  );
}

// ============================================================================
// Combobox Property Field (for fields with token support)
// ============================================================================

interface ComboboxPropertyFieldProps {
  label: string;
  value: PropertyOverrideValue | undefined;
  tokens: DesignToken[];
  options: ComboboxOption[];
  onUpdate: (value: PropertyOverrideValue) => void;
  onClear: () => void;
  inputType: 'text' | 'number';
  placeholder: string;
}

function ComboboxPropertyField({
  label,
  value,
  tokens,
  options,
  onUpdate,
  onClear,
  inputType,
  placeholder,
}: ComboboxPropertyFieldProps) {
  // Get display value for combobox
  const comboboxValue = value
    ? value.type === 'manual'
      ? String(value.value)
      : `token:${value.tokenId}`
    : undefined;

  // Handle combobox change
  const handleChange = (newValue: string | null) => {
    if (!newValue) {
      onClear();
      return;
    }

    // Check if it's a token selection (prefixed with 'token:')
    if (newValue.startsWith('token:')) {
      const tokenId = newValue.substring(6); // Remove 'token:' prefix
      const token = tokens.find((t) => t.id === tokenId);
      if (token) {
        onUpdate({ type: 'token', tokenId: token.id, tokenName: token.name });
      }
    } else {
      // Manual input value
      const parsedValue = inputType === 'number' ? parseFloat(newValue) : newValue;
      if (inputType === 'number' && isNaN(parsedValue as number)) {
        return; // Don't update if invalid number
      }
      onUpdate({ type: 'manual', value: parsedValue });
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <label
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--figma-color-text)',
          }}
        >
          {label}
        </label>
      </div>

      <Combobox
        options={options}
        value={comboboxValue}
        onChange={handleChange}
        placeholder={placeholder}
        inputType={inputType}
        allowManualInput={true}
        onClear={onClear}
      />
    </div>
  );
}

// ============================================================================
// Select Property Field (for fields without token support)
// ============================================================================

interface SelectPropertyFieldProps {
  label: string;
  value: PropertyOverrideValue | undefined;
  onUpdate: (value: PropertyOverrideValue) => void;
  onClear: () => void;
  placeholder: string;
  options: Array<{ label: string; value: string }>;
}

function SelectPropertyField({
  label,
  value,
  onUpdate,
  onClear,
  placeholder,
  options,
}: SelectPropertyFieldProps) {
  const displayValue = value?.type === 'manual' ? String(value.value) : '';

  const handleChange = (newValue: string) => {
    if (newValue) {
      onUpdate({ type: 'manual', value: newValue });
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <label
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--figma-color-text)',
          }}
        >
          {label}
        </label>
        {value && (
          <button
            onClick={onClear}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: 'pointer',
              color: 'var(--figma-color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
            }}
            title="Clear override"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <select
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: '11px',
          border: '1px solid var(--figma-color-border)',
          borderRadius: '4px',
          backgroundColor: 'var(--figma-color-bg)',
          color: 'var(--figma-color-text)',
          outline: 'none',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
