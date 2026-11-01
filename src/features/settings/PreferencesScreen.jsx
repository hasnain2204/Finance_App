import { dateFormatOptions, formatDate } from '../../lib/finance';
import { BackHeader, StatusMessage } from '../../components/ui';

export function PreferencesScreen({
  preferenceDateFormatDraft,
  setPreferenceDateFormatDraft,
  preferenceNotificationsDraft,
  setPreferenceNotificationsDraft,
  preferenceSaveStatus,
  setPreferenceSaveStatus,
  onSave,
  onBack
}) {
  return (
    <main className="account-shell">
      <BackHeader title="Preferences" onBack={onBack} backLabel="Back to More" />

      <form className="preferences-content" onSubmit={onSave}>
        <section className="preferences-currency-card">
          <h2>Currency</h2>
          <div className="preferences-currency-row">
            <span>Pakistani Rupees</span>
            <span>PKR · Fixed</span>
          </div>
          <p>All amounts use Rs. PWS V1 supports PKR only.</p>
        </section>

        <div className="preferences-date-field">
          <label htmlFor="date-format">Date Format</label>
          <select
            id="date-format"
            value={preferenceDateFormatDraft}
            onChange={(event) => {
              setPreferenceDateFormatDraft(event.target.value);
              setPreferenceSaveStatus({ type: 'idle', message: '' });
            }}
          >
            {dateFormatOptions.map((dateFormat) => (
              <option key={dateFormat} value={dateFormat}>{dateFormat}</option>
            ))}
          </select>
          <span className="preferences-date-example">
            Example: {formatDate(new Date(2026, 9, 3), preferenceDateFormatDraft)}
          </span>
        </div>

        <section className="preferences-notification-card">
          <h2>Notifications</h2>
          <div className="preferences-notification-row">
            <span>Basic notifications · {preferenceNotificationsDraft ? 'On' : 'Off'}</span>
            <button
              type="button"
              className="preferences-toggle"
              role="switch"
              aria-checked={preferenceNotificationsDraft}
              aria-label="Basic notifications"
              onClick={() => {
                setPreferenceNotificationsDraft((current) => !current);
                setPreferenceSaveStatus({ type: 'idle', message: '' });
              }}
            >
              <span />
            </button>
          </div>
          <p>Basic notifications only. No advanced alerts or predictions.</p>
        </section>

        <button type="submit" className="primary-action full preferences-save-button">
          Save preferences
        </button>
        <StatusMessage type={preferenceSaveStatus.type} message={preferenceSaveStatus.message} />
      </form>
    </main>
  );
}
