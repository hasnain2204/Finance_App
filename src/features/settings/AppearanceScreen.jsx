import { useState } from 'react';
import { Sun, Moon, Check } from 'lucide-react';
import { BackHeader, StatusMessage } from '../../components/ui';

export function AppearanceScreen({ isLightMode = true, onSaveAppearance, onBack }) {
  const [currentLightMode, setCurrentLightMode] = useState(isLightMode);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const handleSelectMode = async (lightMode) => {
    setCurrentLightMode(lightMode);
    if (onSaveAppearance) {
      const result = await onSaveAppearance(lightMode);
      if (result && result.error) {
        setStatus({ type: 'error', message: result.error });
      } else {
        setStatus({
          type: 'success',
          message: `${lightMode ? 'Light' : 'Dark'} theme applied and saved.`
        });
      }
    }
  };

  return (
    <main className="account-shell appearance-screen-shell">
      <BackHeader title="Appearance" onBack={onBack} backLabel="Back to More" />

      <section className="appearance-screen-content">
        <p className="settings-screen-note">
          Customize how PWS appears on your device. Choose between the classic light theme or a muted dark theme designed for night-time comfort and lower battery usage.
        </p>

        <div className="appearance-options-grid" role="radiogroup" aria-label="Appearance options">
          {/* Light Theme Option Card */}
          <button
            type="button"
            className={`appearance-card-option ${currentLightMode ? 'is-selected' : ''}`}
            onClick={() => handleSelectMode(true)}
            role="radio"
            aria-checked={currentLightMode}
            aria-label="Light theme"
          >
            <div className="appearance-card-header">
              <div className="appearance-icon-circle is-light" aria-hidden="true">
                <Sun size={22} strokeWidth={2.4} />
              </div>
              <div className="appearance-card-title-group">
                <h3 className="appearance-card-title">Light Theme</h3>
                <span className="appearance-card-subtitle">Clean surfaces &amp; classic emerald</span>
              </div>
              <div className="themed-radio-outer" aria-hidden="true">
                {currentLightMode && <div className="themed-radio-inner" />}
              </div>
            </div>

            {/* Visual Mini Mockup for Light Theme */}
            <div className="appearance-preview-mockup is-light-mockup" aria-hidden="true">
              <div className="mockup-topbar">
                <span className="mockup-pill-logo" />
                <span className="mockup-pill-btn" />
              </div>
              <div className="mockup-card">
                <span className="mockup-line-primary" />
                <span className="mockup-line-sub" />
              </div>
              <div className="mockup-item">
                <span className="mockup-dot" />
                <span className="mockup-text" />
              </div>
            </div>
          </button>

          {/* Dark Theme Option Card */}
          <button
            type="button"
            className={`appearance-card-option ${!currentLightMode ? 'is-selected' : ''}`}
            onClick={() => handleSelectMode(false)}
            role="radio"
            aria-checked={!currentLightMode}
            aria-label="Dark theme"
          >
            <div className="appearance-card-header">
              <div className="appearance-icon-circle is-dark" aria-hidden="true">
                <Moon size={22} strokeWidth={2.4} />
              </div>
              <div className="appearance-card-title-group">
                <h3 className="appearance-card-title">Dark Theme</h3>
                <span className="appearance-card-subtitle">Dark forest surfaces &amp; muted emerald</span>
              </div>
              <div className="themed-radio-outer" aria-hidden="true">
                {!currentLightMode && <div className="themed-radio-inner" />}
              </div>
            </div>

            {/* Visual Mini Mockup for Dark Theme */}
            <div className="appearance-preview-mockup is-dark-mockup" aria-hidden="true">
              <div className="mockup-topbar">
                <span className="mockup-pill-logo" />
                <span className="mockup-pill-btn" />
              </div>
              <div className="mockup-card">
                <span className="mockup-line-primary" />
                <span className="mockup-line-sub" />
              </div>
              <div className="mockup-item">
                <span className="mockup-dot" />
                <span className="mockup-text" />
              </div>
            </div>
          </button>
        </div>

        <button
          type="button"
          className="primary-action full appearance-save-button"
          onClick={() => handleSelectMode(currentLightMode)}
        >
          {currentLightMode ? 'Keep Light Theme' : 'Keep Dark Theme'}
        </button>

        <StatusMessage type={status.type} message={status.message} />
      </section>
    </main>
  );
}
