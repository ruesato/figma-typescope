import { useState } from 'react';
import { X } from 'lucide-react';
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
 * Each property has a combobox that filters tokens by compatible types.
 */
export default function PropertyOverridesForm({
  tokens,
  overrides,
  onOverridesChange,
}: PropertyOverridesFormProps) {
  const [focusedProperty, setFocusedProperty] = useState<string | null>(null);

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
      <PropertyField
        label="Font Family"
        property="fontFamily"
        value={overrides.fontFamily}
        tokens={getTokensForProperty('fontFamily')}
        onUpdate={(value) => updateOverride('fontFamily', value)}
        onClear={() => clearOverride('fontFamily')}
        inputType="text"
        placeholder="Enter font family..."
        focused={focusedProperty === 'fontFamily'}
        onFocus={() => setFocusedProperty('fontFamily')}
        onBlur={() => setFocusedProperty(null)}
      />

      {/* Font Size */}
      <PropertyField
        label="Font Size"
        property="fontSize"
        value={overrides.fontSize}
        tokens={getTokensForProperty('fontSize')}
        onUpdate={(value) => updateOverride('fontSize', value)}
        onClear={() => clearOverride('fontSize')}
        inputType="number"
        placeholder="Enter size in pixels..."
        focused={focusedProperty === 'fontSize'}
        onFocus={() => setFocusedProperty('fontSize')}
        onBlur={() => setFocusedProperty(null)}
      />

      {/* Font Weight */}
      <PropertyField
        label="Font Weight"
        property="fontWeight"
        value={overrides.fontWeight}
        tokens={getTokensForProperty('fontWeight')}
        onUpdate={(value) => updateOverride('fontWeight', value)}
        onClear={() => clearOverride('fontWeight')}
        inputType="number"
        placeholder="100-900"
        focused={focusedProperty === 'fontWeight'}
        onFocus={() => setFocusedProperty('fontWeight')}
        onBlur={() => setFocusedProperty(null)}
      />

      {/* Line Height */}
      <PropertyField
        label="Line Height"
        property="lineHeight"
        value={overrides.lineHeight}
        tokens={getTokensForProperty('lineHeight')}
        onUpdate={(value) => updateOverride('lineHeight', value)}
        onClear={() => clearOverride('lineHeight')}
        inputType="text"
        placeholder="AUTO, 1.5, or 150%"
        focused={focusedProperty === 'lineHeight'}
        onFocus={() => setFocusedProperty('lineHeight')}
        onBlur={() => setFocusedProperty(null)}
      />

      {/* Letter Spacing */}
      <PropertyField
        label="Letter Spacing"
        property="letterSpacing"
        value={overrides.letterSpacing}
        tokens={getTokensForProperty('letterSpacing')}
        onUpdate={(value) => updateOverride('letterSpacing', value)}
        onClear={() => clearOverride('letterSpacing')}
        inputType="text"
        placeholder="0, 1.5, or 5%"
        focused={focusedProperty === 'letterSpacing'}
        onFocus={() => setFocusedProperty('letterSpacing')}
        onBlur={() => setFocusedProperty(null)}
      />

      {/* Color */}
      <PropertyField
        label="Color"
        property="color"
        value={overrides.color}
        tokens={getTokensForProperty('color')}
        onUpdate={(value) => updateOverride('color', value)}
        onClear={() => clearOverride('color')}
        inputType="text"
        placeholder="#000000 or rgb(0,0,0)"
        focused={focusedProperty === 'color'}
        onFocus={() => setFocusedProperty('color')}
        onBlur={() => setFocusedProperty(null)}
      />

      {/* Paragraph Spacing */}
      <PropertyField
        label="Paragraph Spacing"
        property="paragraphSpacing"
        value={overrides.paragraphSpacing}
        tokens={getTokensForProperty('paragraphSpacing')}
        onUpdate={(value) => updateOverride('paragraphSpacing', value)}
        onClear={() => clearOverride('paragraphSpacing')}
        inputType="number"
        placeholder="Enter spacing in pixels..."
        focused={focusedProperty === 'paragraphSpacing'}
        onFocus={() => setFocusedProperty('paragraphSpacing')}
        onBlur={() => setFocusedProperty(null)}
      />

      {/* Text Case */}
      <PropertyField
        label="Text Case"
        property="textCase"
        value={overrides.textCase}
        tokens={[]}
        onUpdate={(value) => updateOverride('textCase', value)}
        onClear={() => clearOverride('textCase')}
        inputType="select"
        placeholder="Select text case..."
        options={[
          { label: 'Original', value: 'ORIGINAL' },
          { label: 'UPPERCASE', value: 'UPPER' },
          { label: 'lowercase', value: 'LOWER' },
          { label: 'Title Case', value: 'TITLE' },
        ]}
        focused={focusedProperty === 'textCase'}
        onFocus={() => setFocusedProperty('textCase')}
        onBlur={() => setFocusedProperty(null)}
      />

      {/* Text Decoration */}
      <PropertyField
        label="Text Decoration"
        property="textDecoration"
        value={overrides.textDecoration}
        tokens={[]}
        onUpdate={(value) => updateOverride('textDecoration', value)}
        onClear={() => clearOverride('textDecoration')}
        inputType="select"
        placeholder="Select decoration..."
        options={[
          { label: 'None', value: 'NONE' },
          { label: 'Underline', value: 'UNDERLINE' },
          { label: 'Strikethrough', value: 'STRIKETHROUGH' },
        ]}
        focused={focusedProperty === 'textDecoration'}
        onFocus={() => setFocusedProperty('textDecoration')}
        onBlur={() => setFocusedProperty(null)}
      />
    </div>
  );
}

interface PropertyFieldProps {
  label: string;
  property: string;
  value: PropertyOverrideValue | undefined;
  tokens: DesignToken[];
  onUpdate: (value: PropertyOverrideValue) => void;
  onClear: () => void;
  inputType: 'text' | 'number' | 'select';
  placeholder: string;
  options?: Array<{ label: string; value: string }>;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}

function PropertyField({
  label,
  value,
  tokens,
  onUpdate,
  onClear,
  inputType,
  placeholder,
  options,
  focused,
  onFocus,
  onBlur,
}: PropertyFieldProps) {
  const [inputValue, setInputValue] = useState('');
  const [mode, setMode] = useState<'manual' | 'token'>('manual');

  // Get display value
  const displayValue = value
    ? value.type === 'manual'
      ? String(value.value)
      : value.tokenName
    : inputValue;

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    if (newValue.trim()) {
      const parsedValue = inputType === 'number' ? parseFloat(newValue) : newValue;
      if (inputType === 'number' && isNaN(parsedValue as number)) {
        return; // Don't update if invalid number
      }
      onUpdate({ type: 'manual', value: parsedValue });
    }
  };

  const handleTokenSelect = (tokenId: string) => {
    const token = tokens.find((t) => t.id === tokenId);
    if (token) {
      onUpdate({ type: 'token', tokenId: token.id, tokenName: token.name });
      setMode('token');
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

      {/* Input/Select Field */}
      {inputType === 'select' && options ? (
        <select
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '11px',
            border: `1px solid ${
              focused ? 'var(--figma-color-border-brand-strong)' : 'var(--figma-color-border)'
            }`,
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
      ) : (
        <input
          type={inputType}
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '11px',
            border: `1px solid ${
              focused ? 'var(--figma-color-border-brand-strong)' : 'var(--figma-color-border)'
            }`,
            borderRadius: '4px',
            backgroundColor: 'var(--figma-color-bg)',
            color: 'var(--figma-color-text)',
            outline: 'none',
          }}
        />
      )}

      {/* Token Selection */}
      {tokens.length > 0 && mode === 'manual' && (
        <div style={{ marginTop: '6px' }}>
          <button
            onClick={() => setMode('token')}
            style={{
              fontSize: '10px',
              color: 'var(--figma-color-text-brand)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Or select a token
          </button>
        </div>
      )}

      {mode === 'token' && tokens.length > 0 && (
        <div style={{ marginTop: '6px' }}>
          <select
            value={value?.type === 'token' ? value.tokenId : ''}
            onChange={(e) => {
              if (e.target.value) {
                handleTokenSelect(e.target.value);
              } else {
                setMode('manual');
              }
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: '11px',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--figma-color-bg)',
              color: 'var(--figma-color-text)',
            }}
          >
            <option value="">Select a token...</option>
            {tokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.name} ({String(token.value)})
              </option>
            ))}
          </select>
          <button
            onClick={() => setMode('manual')}
            style={{
              fontSize: '10px',
              color: 'var(--figma-color-text-secondary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            Use manual value instead
          </button>
        </div>
      )}
    </div>
  );
}
