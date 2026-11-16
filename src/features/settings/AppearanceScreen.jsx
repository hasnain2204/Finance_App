import { useState } from 'react';
import { Sun, Moon, Smartphone } from 'lucide-react';
import { BackHeader, StatusMessage } from '../../components/ui';

export function AppearanceScreen({
  currentTheme,
  isLightMode,
  onSaveAppearance,
  onBack
}) {
  // Resolve initial theme: support both currentTheme string ('system' | 'light' | 'dark') and isLightMode boolean
  const initialTheme = currentTheme !== undefined
    ? currentTheme
    : (isLightMode === false ? 'dark' : (isLightMode === true ? 'light' : 'system'));
  const [selectedTheme, setSelectedTheme] = useState(initialTheme);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const themeOptions = [
    {
      id: 'system',
      title: 'System Adaptive',
      subtitle: 'Automatically match your device theme',
      ariaLabel: 'System adaptive theme',
      icon: Smartphone
    },
    {
      id: 'light',
      title: 'Light Theme',
      subtitle: 'Clean white surfaces with classic emerald',
      ariaLabel: 'Light theme',
      icon: Sun
    },
    {
      id: 'dark',
      title: 'Dark Theme',
      subtitle: 'Deep luminous surfaces with vibrant emerald',
      ariaLabel: 'Dark theme',
      icon: Moon
    }
  ];

  const handleSelectMode = async (themeId) => {
    setSelectedTheme(themeId);
    if (onSaveAppearance) {
      // Pass boolean or string for backwards compatibility
      const arg = themeId === 'system' ? 'system' : (themeId === 'light' ? true : false);
      const result = await onSaveAppearance(arg);
      if (result && result.error) {
        setStatus({ type: 'error', message: result.error });
      } else {
        const label = themeId === 'system' ? 'System Adaptive' : (themeId === 'light' ? 'Light' : 'Dark');
        setStatus({
          type: 'success',
          message: `${label} theme applied and saved.`
        });
      }
    }
  };

  return (
    <main className="account-shell appearance-screen-shell">
      <BackHeader title="Appearance" onBack={onBack} backLabel="Back to More" />

      <section className="appearance-screen-content">
        <p className="settings-screen-note">
          Customize how PWS appears on your device. Choose between light, dark, or system adaptive mode to match your device settings automatically.
        </p>

        <div className="appearance-toggle-group" role="radiogroup" aria-label="Appearance options">
          {themeOptions.map((opt) => {
            const isSelected = selectedTheme === opt.id ||
              (opt.id === 'light' && selectedTheme === true) ||
              (opt.id === 'dark' && selectedTheme === false);
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                type="button"
                className={`appearance-toggle-row ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleSelectMode(opt.id)}
                role="radio"
                aria-checked={isSelected}
                aria-label={opt.ariaLabel}
              >
                <div className={`appearance-toggle-icon-box is-${opt.id}`} aria-hidden="true">
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div className="appearance-toggle-copy">
                  <strong className="appearance-toggle-title">{opt.title}</strong>
                  <span className="appearance-toggle-subtitle">{opt.subtitle}</span>
                </div>
                <div className="themed-radio-outer" aria-hidden="true">
                  {isSelected && <div className="themed-radio-inner" />}
                </div>
              </button>
            );
          })}
        </div>

        <StatusMessage type={status.type} message={status.message} />
      </section>
    </main>
  );
}
