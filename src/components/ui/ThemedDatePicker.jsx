import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDate, getLocalDateString } from '../../lib/finance';

function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function ThemedDatePicker({
  id: customId,
  name,
  label = 'Date',
  value,
  onChange,
  dateFormat = 'DD MMM YYYY',
  required = false,
  disabled = false,
  className = ''
}) {
  const generatedId = useId();
  const id = customId || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);

  // Parse initial selected date
  const parsedDate = useMemo(() => {
    if (!value) return new Date();
    const [y, m, d] = String(value).split('-').map(Number);
    if (y && m && d) {
      return new Date(y, m - 1, d);
    }
    const fallback = new Date(value);
    return isNaN(fallback.getTime()) ? new Date() : fallback;
  }, [value]);

  // Calendar view year and month (month is 0-indexed)
  const [viewYear, setViewYear] = useState(() => parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsedDate.getMonth());

  // Sync calendar view month/year when modal opens
  useEffect(() => {
    if (isOpen) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth());
    }
  }, [isOpen, parsedDate]);

  const pad = (n) => String(n).padStart(2, '0');

  // Display label for the trigger button
  const displayLabel = useMemo(() => {
    if (!value) return 'Select date';
    try {
      const [y, m, d] = String(value).split('-').map(Number);
      if (y && m && d) {
        const dObj = new Date(y, m - 1, d);
        return formatDate(dObj, dateFormat);
      }
      return formatDate(new Date(value), dateFormat);
    } catch {
      return value;
    }
  }, [value, dateFormat]);

  // Today string YYYY-MM-DD
  const todayStr = useMemo(() => getLocalDateString(), []);

  // Quick presets
  const presets = useMemo(() => {
    const now = new Date();
    const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const formatPreset = (date) =>
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    return [
      { label: '2 Days Ago', value: formatPreset(twoDaysAgo) },
      { label: 'Yesterday', value: formatPreset(yest) },
      { label: 'Today', value: formatPreset(now) }
    ];
  }, []);

  const handleSelectDate = (dateStr) => {
    if (disabled) return;
    if (onChange) {
      const syntheticEvent = {
        target: {
          id,
          name: name || id,
          value: dateStr
        },
        currentTarget: {
          id,
          name: name || id,
          value: dateStr
        },
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      onChange(syntheticEvent);
    }
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handlePrevMonth = () => {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  // Calendar days grid calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

    const cells = [];
    // Leading empty padding days
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ empty: true, key: `empty-${i}` });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
      cells.push({
        empty: false,
        day,
        dateStr,
        key: dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value
      });
    }

    return cells;
  }, [viewYear, viewMonth, todayStr, value]);

  // Close on Escape key
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

  // Lock body scroll when modal is open
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
      {/* Hidden native input for tests and standard form data */}
      <input
        id={`${id}-native`}
        name={name}
        type="date"
        value={value || ''}
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
      />

      {/* Styled visible button trigger */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`themed-select-trigger ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span className="themed-select-value">{displayLabel}</span>
        <Calendar
          size={18}
          strokeWidth={2.2}
          className="themed-date-icon"
          aria-hidden="true"
        />
      </button>

      {/* Light Theme Date Picker Bottom Sheet / Modal */}
      {isOpen && (
        <Portal>
          <div
            className="themed-select-backdrop"
            role="presentation"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="themed-select-sheet themed-date-picker-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={label || 'Select Date'}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="themed-select-handle" aria-hidden="true" />

              <header className="themed-select-sheet-header">
                <h3 className="themed-select-sheet-title">{label || 'Select Date'}</h3>
                <button
                  type="button"
                  className="themed-select-sheet-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2.4} />
                </button>
              </header>

              <div className="themed-date-picker-body">
                {/* Quick Date Presets Bar */}
                <div className="themed-date-presets-bar" aria-label="Quick date choices">
                  {presets.map((preset) => {
                    const isSelected = preset.value === value;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`themed-date-preset-pill ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleSelectDate(preset.value)}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Month & Year Navigator */}
                <div className="themed-date-month-nav">
                  <button
                    type="button"
                    className="themed-date-nav-btn"
                    onClick={handlePrevMonth}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={20} strokeWidth={2.4} />
                  </button>

                  <strong className="themed-date-month-title">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </strong>

                  <button
                    type="button"
                    className="themed-date-nav-btn"
                    onClick={handleNextMonth}
                    aria-label="Next month"
                  >
                    <ChevronRight size={20} strokeWidth={2.4} />
                  </button>
                </div>

                {/* Weekday Header */}
                <div className="themed-date-weekdays-row" aria-hidden="true">
                  {WEEKDAY_NAMES.map((name) => (
                    <span key={name} className="themed-date-weekday">
                      {name}
                    </span>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="themed-date-days-grid" role="grid" aria-label="Calendar days">
                  {calendarDays.map((cell) => {
                    if (cell.empty) {
                      return <div key={cell.key} className="themed-date-day-empty" aria-hidden="true" />;
                    }

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        className={`themed-date-day-btn ${cell.isSelected ? 'is-selected' : ''} ${cell.isToday ? 'is-today' : ''}`}
                        onClick={() => handleSelectDate(cell.dateStr)}
                        aria-label={`${cell.day} ${MONTH_NAMES[viewMonth]} ${viewYear}`}
                        aria-pressed={cell.isSelected}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
