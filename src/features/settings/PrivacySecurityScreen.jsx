import { useEffect, useState } from 'react';
import { Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BackHeader } from '../../components/ui';
import { securityRepository } from '../../services/securityRepository';

export function PinUnlockScreen({ title, description, onUnlock, onBiometric, biometricEnabled }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleUnlock = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onUnlock(pin);
    } catch (unlockError) {
      setError(unlockError?.message || 'Could not verify the PIN.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="security-lock-shell">
      <section className="security-card">
        <span className="security-hero-icon"><LockKeyhole size={28} /></span>
        <h1>{title}</h1>
        <p>{description}</p>
        {biometricEnabled ? (
          <button type="button" className="secondary-button security-biometric-button" onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await onBiometric();
            } catch (unlockError) {
              setError(unlockError?.message || 'Biometric authentication was not completed. Use your PIN instead.');
            } finally {
              setBusy(false);
            }
          }} disabled={busy}>
            <Fingerprint size={19} /> Unlock with biometrics
          </button>
        ) : null}
        <form className="security-pin-form" onSubmit={handleUnlock}>
          <label htmlFor="security-unlock-pin">Six-digit PIN</label>
          <input
            id="security-unlock-pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          {error ? <p className="cloud-auth-error" role="alert">{error}</p> : null}
          <button className="primary-action full" type="submit" disabled={busy || pin.length !== 6}>
            {busy ? 'Verifying…' : 'Unlock'}
          </button>
        </form>
      </section>
    </main>
  );
}

export function PrivacySecurityScreen({ onBack, settings, onSaveSettings }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pendingLockKey, setPendingLockKey] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    securityRepository.biometricAvailable()
      .then(setBiometricAvailable)
      .catch((error) => setStatus({ type: 'error', message: error?.message || 'Could not check biometric availability.' }));
  }, []);

  const setLock = async (key, enabled) => {
    setStatus({ type: '', message: '' });
    if (enabled && !settings.pinVerifier) {
      setPendingLockKey(key);
      setIsSettingPin(true);
      return;
    }
    try {
      await onSaveSettings({ [key]: enabled });
      setStatus({ type: 'success', message: `${key === 'appLockEnabled' ? 'App lock' : 'Notes lock'} ${enabled ? 'enabled' : 'disabled'}.` });
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Could not update lock settings.' });
    }
  };

  const savePin = async (event) => {
    event.preventDefault();
    if (pin !== confirmPin) {
      setStatus({ type: 'error', message: 'The PINs do not match.' });
      return;
    }
    setBusy(true);
    try {
      const next = await securityRepository.setPin(pin);
      await onSaveSettings(pendingLockKey
        ? { [pendingLockKey]: true }
        : { appLockEnabled: next.appLockEnabled, notesLockEnabled: next.notesLockEnabled });
      setPin('');
      setConfirmPin('');
      setIsSettingPin(false);
      setPendingLockKey(null);
      setStatus({ type: 'success', message: 'Your PIN was set and the selected lock is enabled.' });
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Could not set the PIN.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="account-shell">
      <BackHeader title="Privacy & Security" onBack={onBack} backLabel="Back to More" />
      <section className="security-settings-content">
        <div className="security-intro-card">
          <span className="security-hero-icon"><ShieldCheck size={26} /></span>
          <div>
            <h2>Protect your privacy</h2>
            <p>Choose whether to lock the whole app or only your personal notes.</p>
          </div>
        </div>

        <section className="security-card" aria-labelledby="app-security-title">
          <p className="eyebrow">App security</p>
          <div className="security-setting-row">
            <div>
              <strong id="app-security-title">Lock the app</strong>
              <p>Require authentication when reopening PWS.</p>
            </div>
            <button type="button" className="preferences-toggle" role="switch" aria-checked={settings.appLockEnabled} aria-label="Lock the app" onClick={() => setLock('appLockEnabled', !settings.appLockEnabled)}>
              <span />
            </button>
          </div>
        </section>

        <section className="security-card" aria-labelledby="notes-security-title">
          <p className="eyebrow">Notes security</p>
          <div className="security-setting-row">
            <div>
              <strong id="notes-security-title">Lock Notes</strong>
              <p>Require authentication before opening your personal notes.</p>
            </div>
            <button type="button" className="preferences-toggle" role="switch" aria-checked={settings.notesLockEnabled} aria-label="Lock Notes" onClick={() => setLock('notesLockEnabled', !settings.notesLockEnabled)}>
              <span />
            </button>
          </div>
        </section>

        <section className="security-card" aria-labelledby="unlock-method-title">
          <p className="eyebrow">Unlock method</p>
          <div className="security-setting-row">
            <div>
              <strong id="unlock-method-title">Six-digit PIN</strong>
              <p>{settings.pinVerifier ? 'PIN configured. Use it if biometric unlock is unavailable.' : 'Set a PIN to enable an app or notes lock.'}</p>
            </div>
            <button type="button" className="secondary-button security-pin-action" onClick={() => setIsSettingPin(true)}>
              {settings.pinVerifier ? 'Change PIN' : 'Set PIN'}
            </button>
          </div>
          {biometricAvailable ? (
            <div className="security-setting-row">
              <div>
                <strong>Biometric unlock</strong>
                <p>Use your device’s fingerprint or face authentication, with PIN fallback.</p>
              </div>
              <button
                type="button"
                className="preferences-toggle"
                role="switch"
                aria-checked={settings.biometricEnabled}
                aria-label="Biometric unlock"
                disabled={!settings.pinVerifier}
                onClick={async () => {
                  try {
                    if (settings.biometricEnabled) {
                      await onSaveSettings({ biometricEnabled: false });
                    } else {
                      const next = await securityRepository.enableBiometric();
                      await onSaveSettings({ biometricEnabled: next.biometricEnabled });
                    }
                    setStatus({ type: 'success', message: 'Biometric unlock settings updated.' });
                  } catch (error) {
                    setStatus({ type: 'error', message: error?.message || 'Could not update biometric settings.' });
                  }
                }}
              >
                <span />
              </button>
            </div>
          ) : null}
        </section>

        <p className="security-disclaimer">
          These locks protect against casual access through the app. Your notes and finance data remain stored locally on this device; this is not full-disk encryption or protection against someone with developer access to the device.
        </p>
        {status.message ? <p className={status.type === 'error' ? 'cloud-auth-error' : 'cloud-auth-message'} role={status.type === 'error' ? 'alert' : 'status'}>{status.message}</p> : null}

        {isSettingPin ? (
          <form className="security-card security-pin-form" onSubmit={savePin}>
            <h2>Set your PIN</h2>
            <p>Choose a six-digit PIN. It is stored as a one-way verifier, not as plain text.</p>
            <label htmlFor="security-new-pin">New PIN</label>
            <input id="security-new-pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
            <label htmlFor="security-confirm-pin">Confirm PIN</label>
            <input id="security-confirm-pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6}" maxLength={6} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
            <div className="security-pin-actions">
              <button type="button" className="dialog-cancel" onClick={() => { setIsSettingPin(false); setPendingLockKey(null); }}>Cancel</button>
              <button type="submit" className="primary-action" disabled={busy || pin.length !== 6 || confirmPin.length !== 6}>{busy ? 'Saving…' : 'Save PIN'}</button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}
