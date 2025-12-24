import { useState } from 'react';
import { useCombobox } from 'downshift';
import { ChevronDown, X } from 'lucide-react';

export interface ComboboxOption {
  label: string;
  value: string;
  description?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string | null) => void;
  placeholder?: string;
  inputType?: 'text' | 'number';
  allowManualInput?: boolean;
  onClear?: () => void;
}

/**
 * Combobox Component (using Downshift)
 *
 * Lightweight autocomplete/combobox component that supports:
 * - Manual text input
 * - Dropdown selection with filtering
 * - Keyboard navigation
 * - Figma design token styling
 * - Clear button
 *
 * Bundle size: ~5-6kb gzipped
 */
export default function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Type or select...',
  inputType = 'text',
  allowManualInput = true,
  onClear,
}: ComboboxProps) {
  const [inputValue, setInputValue] = useState(value || '');

  // Filter options based on input
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    selectedItem,
  } = useCombobox({
    items: filteredOptions,
    inputValue,
    selectedItem: options.find((opt) => opt.value === value) || null,
    itemToString: (item) => (item ? item.label : ''),
    onInputValueChange: ({ inputValue: newInputValue }) => {
      setInputValue(newInputValue || '');
      if (allowManualInput && newInputValue) {
        onChange(newInputValue);
      }
    },
    onSelectedItemChange: ({ selectedItem: newSelectedItem }) => {
      if (newSelectedItem) {
        setInputValue(newSelectedItem.label);
        onChange(newSelectedItem.value);
      }
    },
  });

  const handleClear = () => {
    setInputValue('');
    onChange(null);
    onClear?.();
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Input with dropdown toggle button */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          {...getInputProps()}
          type={inputType}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '6px 60px 6px 8px',
            fontSize: '11px',
            border: `1px solid ${isOpen ? 'var(--figma-color-border-brand-strong)' : 'var(--figma-color-border)'}`,
            borderRadius: '4px',
            backgroundColor: 'var(--figma-color-bg)',
            color: 'var(--figma-color-text)',
            outline: 'none',
            transition: 'border-color 0.15s ease',
          }}
        />

        {/* Clear and toggle buttons */}
        <div
          style={{
            position: 'absolute',
            right: '4px',
            display: 'flex',
            gap: '2px',
            alignItems: 'center',
          }}
        >
          {/* Clear button */}
          {value && (
            <button
              onClick={handleClear}
              type="button"
              style={{
                padding: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--figma-color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--figma-color-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--figma-color-text-secondary)';
              }}
              title="Clear"
            >
              <X size={12} />
            </button>
          )}

          {/* Dropdown toggle button */}
          <button
            {...getToggleButtonProps()}
            type="button"
            aria-label="toggle menu"
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--figma-color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              transition: 'transform 0.15s ease, color 0.15s ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--figma-color-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--figma-color-text-secondary)';
            }}
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Dropdown menu */}
      <ul
        {...getMenuProps()}
        style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          maxHeight: '200px',
          overflowY: 'auto',
          margin: 0,
          padding: '4px',
          backgroundColor: 'var(--figma-color-bg)',
          border: '1px solid var(--figma-color-border)',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          listStyle: 'none',
          display: isOpen && filteredOptions.length > 0 ? 'block' : 'none',
        }}
      >
        {isOpen &&
          filteredOptions.map((option, index) => (
            <li
              key={option.value}
              {...getItemProps({ item: option, index })}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                borderRadius: '3px',
                backgroundColor:
                  highlightedIndex === index
                    ? 'var(--figma-color-bg-hover)'
                    : 'transparent',
                color: 'var(--figma-color-text)',
                transition: 'background-color 0.1s ease',
              }}
            >
              <div>{option.label}</div>
              {option.description && (
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--figma-color-text-tertiary)',
                    marginTop: '2px',
                  }}
                >
                  {option.description}
                </div>
              )}
            </li>
          ))}
      </ul>

      {/* Empty state */}
      {isOpen && filteredOptions.length === 0 && inputValue && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            padding: '12px',
            backgroundColor: 'var(--figma-color-bg)',
            border: '1px solid var(--figma-color-border)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            fontSize: '11px',
            color: 'var(--figma-color-text-secondary)',
            textAlign: 'center',
            zIndex: 1000,
          }}
        >
          No options found
        </div>
      )}
    </div>
  );
}
