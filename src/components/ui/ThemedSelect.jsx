import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export function ThemedSelect({
  id: customId,
  name,
  label,
  value,
  onChange,
  options,
  children,
  placeholder = 'Select an option',
  required = false,
  disabled = false,
  className = ''
}) {
  const generatedId = useId();
  const id = customId || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);

  // Parse options from either `options` prop or `children` (<option> tags)
  const resolvedOptions = useMemo(() => {
    if (Array.isArray(options) && options.length > 0) {
      return options.map((opt) =>
        typeof opt === 'object' && opt !== null
          ? { value: String(opt.value), label: String(opt.label ?? opt.value) }
          : { value: String(opt), label: String(opt) }
      );
    }
    if (children) {
      const parsed = [];
      const childrenArray = Array.isArray(children) ? children : [children];
      childrenArray.flat().forEach((child) => {
        if (child && child.props) {
          parsed.push({
            value: String(child.props.value ?? child.props.children ?? ''),
            label: String(child.props.children ?? child.props.value ?? '')
          });
        }
      });
      return parsed;
    }
    return [];
  }, [options, children]);

  const selectedOption = resolvedOptions.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const handleSelectOption = (optValue) => {
    if (disabled) return;
    if (onChange) {
      const syntheticEvent = {
        target: {
          id,
          name: name || id,
          value: optValue
        },
        currentTarget: {
          id,
          name: name || id,
          value: optValue
        },
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      onChange(syntheticEvent);
    }
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Keyboard navigation & ESC key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when modal sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  return (
    <div className={`themed-select-wrapper ${className}`.trim()}>
      {/* Hidden native select for testing framework selectors */}
      <select
        id={`${id}-native`}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="themed-select-native-hidden"
        onFocus={(e) => {
          e.preventDefault();
          triggerRef.current?.focus();
        }}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(true);
        }}
      >
        {resolvedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Modern custom button trigger */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`themed-select-trigger ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span className="themed-select-value">{displayLabel}</span>
        <ChevronDown
          size={18}
          strokeWidth={2.4}
          className={`themed-select-chevron ${isOpen ? 'is-rotated' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Light Theme Bottom Sheet / Popover Modal */}
      {isOpen && (
        <Portal>
          <div
            className="themed-select-backdrop"
            role="presentation"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="themed-select-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={label || 'Select option'}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="themed-select-handle" aria-hidden="true" />

              <header className="themed-select-sheet-header">
                <h3 className="themed-select-sheet-title">{label || 'Select'}</h3>
                <button
                  type="button"
                  className="themed-select-sheet-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2.4} />
                </button>
              </header>

              <div
                className="themed-select-options"
                role="listbox"
                aria-label={label || 'Options'}
              >
                {resolvedOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`themed-select-option-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectOption(opt.value)}
                    >
                      <span className="themed-select-option-label">{opt.label}</span>
                      <div className="themed-radio-outer" aria-hidden="true">
                        {isSelected && <div className="themed-radio-inner" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
