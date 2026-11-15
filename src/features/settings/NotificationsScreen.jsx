import { useState } from 'react';
import { Bell, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { BackHeader, StatusMessage } from '../../components/ui';

export function NotificationsScreen({
  notificationsEnabled = false,
  onSaveNotifications,
  onBack
}) {
  const [enabled, setEnabled] = useState(Boolean(notificationsEnabled));
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const handleToggle = async () => {
    const nextState = !enabled;
    setEnabled(nextState);
    if (onSaveNotifications) {
      const result = await onSaveNotifications(nextState);
      if (result && result.error) {
        setStatus({ type: 'error', message: result.error });
      } else {
        setStatus({
          type: 'success',
          message: nextState ? 'Basic notifications enabled.' : 'Notifications turned off.'
        });
      }
    }
  };

  return (
    <main className="account-shell">
      <BackHeader title="Notifications" onBack={onBack} backLabel="Back to More" />

      <section className="notifications-screen-content">
        <div className="notifications-hero-card">
          <div className="notifications-hero-icon" aria-hidden="true">
            <Bell size={28} strokeWidth={2.2} />
          </div>
          <h2>Notification Alerts</h2>
          <p>
            Stay on top of your daily spending and budget limits with local device reminders.
          </p>
        </div>

        <section className="preferences-notification-card">
          <div className="preferences-notification-row">
            <div>
              <strong className="notifications-toggle-label">Basic Notifications</strong>
              <span className="notifications-toggle-sub">
                {enabled ? 'Active · Reminders enabled' : 'Disabled · No alerts'}
              </span>
            </div>
            <button
              type="button"
              className="preferences-toggle"
              role="switch"
              aria-checked={enabled}
              aria-label="Toggle basic notifications"
              onClick={handleToggle}
            >
              <span />
            </button>
          </div>
        </section>

        <section className="notifications-feature-list" aria-label="Included notification features">
          <div className="notifications-feature-item">
            <Clock size={20} className="notifications-feature-icon" />
            <div>
              <strong>Daily Expense Reminder</strong>
              <p>Evening reminder to review and log your daily spending.</p>
            </div>
          </div>

          <div className="notifications-feature-item">
            <AlertTriangle size={20} className="notifications-feature-icon" />
            <div>
              <strong>Budget Overrun Warnings</strong>
              <p>Alerts when monthly expenses reach 80% or 100% of your budget.</p>
            </div>
          </div>

          <div className="notifications-feature-item">
            <ShieldCheck size={20} className="notifications-feature-icon" />
            <div>
              <strong>100% Private &amp; Local</strong>
              <p>All reminders trigger locally on your device. Zero cloud tracking or spam.</p>
            </div>
          </div>
        </section>

        <StatusMessage type={status.type} message={status.message} />
      </section>
    </main>
  );
}
