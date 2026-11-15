import { useState } from 'react';
import { BackHeader, StatusMessage, ThemedSelect } from '../../components/ui';
import { dateFormatOptions, formatDate } from '../../lib/finance';

export function DateFormatScreen({ currentDateFormat = 'DD MMM YYYY', onSaveDateFormat, onBack }) {
  const [selectedFormat, setSelectedFormat] = useState(currentDateFormat);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const sampleDate = new Date(2026, 9, 3); // 03 Oct 2026 matches example

  const handleSelect = async (format) => {
    setSelectedFormat(format);
    if (onSaveDateFormat) {
      const result = await onSaveDateFormat(format);
      if (result && result.error) {
        setStatus({ type: 'error', message: result.error });
      } else {
        setStatus({ type: 'success', message: `Date format updated to ${format}.` });
      }
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    await handleSelect(selectedFormat);
  };

  return (
    <main className="account-shell">
      <BackHeader title="Date Format" onBack={onBack} backLabel="Back to More" />

      <form className="preferences-content" onSubmit={handleSave}>
        <div className="preferences-date-field">
          <label htmlFor="date-format">Date Format</label>
          <ThemedSelect
            id="date-format"
            name="dateFormat"
            label="Date Format"
            value={selectedFormat}
            onChange={(event) => handleSelect(event.target.value)}
            options={dateFormatOptions}
          />
          <span className="preferences-date-example">
            Example: {formatDate(sampleDate, selectedFormat)}
          </span>
        </div>

        <button type="submit" className="primary-action full preferences-save-button">
          Save Changes
        </button>

        <StatusMessage type={status.type} message={status.message} />
      </form>
    </main>
  );
}
