import { Capacitor } from '@capacitor/core';

const securityStorageKey = 'pws-security-settings';
const biometricDataKey = 'pws-app-unlock';
const defaultSecuritySettings = {
  appLockEnabled: false,
  notesLockEnabled: false,
  biometricEnabled: false,
  pinSalt: '',
  pinVerifier: ''
};

function getCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error('Secure PIN verification is unavailable in this browser.');
  return globalThis.crypto;
}

async function derivePinVerifier(pin, salt) {
  const crypto = getCrypto();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: Uint8Array.from(salt.match(/.{2}/g) || [], (part) => parseInt(part, 16)),
    iterations: 210000,
    hash: 'SHA-256'
  }, key, 256);
  return Array.from(new Uint8Array(derived), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createSalt(crypto) {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createSecurityRepository(storage) {
  if (!storage) throw new Error('Security settings storage is unavailable.');

  const read = () => {
    try {
      const raw = storage.getItem(securityStorageKey);
      if (!raw) return { ...defaultSecuritySettings };
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object') throw new Error('Invalid settings');
      return { ...defaultSecuritySettings, ...value };
    } catch (error) {
      throw new Error('Privacy & Security settings could not be read.', { cause: error });
    }
  };

  const write = (settings) => {
    try {
      storage.setItem(securityStorageKey, JSON.stringify(settings));
    } catch (error) {
      throw new Error('Privacy & Security settings could not be saved.', { cause: error });
    }
  };

  return {
    read,
    async setPin(pin) {
      if (!/^\d{6}$/.test(pin)) throw new Error('Choose a six-digit PIN.');
      const crypto = getCrypto();
      const current = read();
      const pinSalt = createSalt(crypto);
      const pinVerifier = await derivePinVerifier(pin, pinSalt);
      const next = { ...current, pinSalt, pinVerifier };
      write(next);
      return next;
    },
    async verifyPin(pin) {
      const current = read();
      if (!current.pinSalt || !current.pinVerifier || !/^\d{6}$/.test(pin)) return false;
      if (current.pinLockUntil && current.pinLockUntil > Date.now()) {
        const remainingSeconds = Math.ceil((current.pinLockUntil - Date.now()) / 1000);
        throw new Error(`Too many attempts. Try again in ${remainingSeconds} seconds.`);
      }
      const verified = (await derivePinVerifier(pin, current.pinSalt)) === current.pinVerifier;
      if (verified) {
        write({ ...current, pinFailures: 0, pinLockUntil: 0 });
        return true;
      }
      const pinFailures = Number(current.pinFailures || 0) + 1;
      write({
        ...current,
        pinFailures: pinFailures >= 5 ? 0 : pinFailures,
        pinLockUntil: pinFailures >= 5 ? Date.now() + 60_000 : 0
      });
      return false;
    },
    saveSettings(settings) {
      const current = read();
      const next = { ...current, ...settings };
      if ((next.appLockEnabled || next.notesLockEnabled) && !next.pinVerifier) {
        throw new Error('Set a PIN before enabling a lock.');
      }
      write(next);
      return next;
    },
    async biometricAvailable() {
      if (!Capacitor.isNativePlatform()) return false;
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable && result.strongBiometryIsAvailable;
    },
    async enableBiometric() {
      if (!Capacitor.isNativePlatform()) {
        throw new Error('Biometric unlock is available in the Android app, not in a web browser.');
      }
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable || !result.strongBiometryIsAvailable) {
        throw new Error('Set up a supported biometric on this device before enabling biometric unlock.');
      }
      await NativeBiometric.verifyIdentity({
        title: 'Enable biometric unlock',
        subtitle: 'Confirm your identity to enable this feature',
        reason: 'Enable biometric unlock for PWS'
      });
      return this.saveSettings({ biometricEnabled: true });
    },
    async authenticateBiometric() {
      if (!Capacitor.isNativePlatform()) return false;
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable || !result.strongBiometryIsAvailable) return false;
      await NativeBiometric.verifyIdentity({
        title: 'Unlock PWS',
        subtitle: 'Authenticate to continue',
        reason: 'Unlock PWS'
      });
      return true;
    }
  };
}

function getRepository() {
  if (typeof window === 'undefined') throw new Error('Security settings storage is unavailable.');
  return createSecurityRepository(window.localStorage);
}

export const securityRepository = {
  read: () => getRepository().read(),
  setPin: (pin) => getRepository().setPin(pin),
  verifyPin: (pin) => getRepository().verifyPin(pin),
  saveSettings: (settings) => getRepository().saveSettings(settings),
  biometricAvailable: () => getRepository().biometricAvailable(),
  enableBiometric: () => getRepository().enableBiometric(),
  authenticateBiometric: () => getRepository().authenticateBiometric()
};
