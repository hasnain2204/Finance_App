import { useState } from 'react';
import { Check } from 'lucide-react';
import { BackHeader, StatusMessage } from '../../components/ui';
import { supportedCurrencies } from '../../lib/finance';

export function CurrencyScreen({ currentCurrency = 'PKR', onSelectCurrency, onBack }) {
  const [selected, setSelected] = useState(currentCurrency.toUpperCase());
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const handleSelect = async (code) => {
    setSelected(code);
    if (onSelectCurrency) {
      const result = await onSelectCurrency(code);
      if (result && result.error) {
        setStatus({ type: 'error', message: result.error });
      } else {
        setStatus({ type: 'success', message: `Active currency changed to ${code}.` });
      }
    }
  };

  return (
    <main className="account-shell">
      <BackHeader title="Currency" onBack={onBack} backLabel="Back to More" />

      <section className="currency-screen-content">
        <p className="currency-screen-note">
          Select your primary currency. All balances, transactions, and analytics throughout the app will format with this currency.
        </p>

        <div className="currency-list" role="radiogroup" aria-label="Available currencies">
          {supportedCurrencies.map((c) => {
            const isSelected = selected === c.code;
            return (
              <button
                key={c.code}
                type="button"
                className={`currency-item-row ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleSelect(c.code)}
                role="radio"
                aria-checked={isSelected}
              >
                <div className="currency-item-main">
                  <span className="currency-flag" aria-hidden="true">{c.flag}</span>
                  <div className="currency-info">
                    <div className="currency-title-row">
                      <strong className="currency-code">{c.code}</strong>
                      <span className="currency-symbol-badge">{c.symbol}</span>
                    </div>
                    <span className="currency-name">{c.name} · {c.country}</span>
                  </div>
                </div>
                {isSelected && (
                  <span className="currency-selected-indicator" aria-hidden="true">
                    <Check size={18} strokeWidth={2.6} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <StatusMessage type={status.type} message={status.message} />
      </section>
    </main>
  );
}
