import { beforeEach, describe, expect, it } from 'vitest';
import { createSecurityRepository } from './securityRepository';

describe('securityRepository', () => {
  let repository;

  beforeEach(() => {
    window.localStorage.clear();
    repository = createSecurityRepository(window.localStorage);
  });

  it('stores a one-way PIN verifier and verifies the PIN', async () => {
    await repository.setPin('123456');
    expect(window.localStorage.getItem('pws-security-settings')).not.toContain('123456');
    expect(await repository.verifyPin('000000')).toBe(false);
    expect(await repository.verifyPin('123456')).toBe(true);
  });

  it('rejects enabling a lock before a PIN is set', () => {
    expect(() => repository.saveSettings({ notesLockEnabled: true })).toThrow('Set a PIN before enabling a lock.');
  });

  it('requires a cooldown after five failed PIN attempts', async () => {
    await repository.setPin('123456');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await repository.verifyPin('000000');
    }

    await expect(repository.verifyPin('123456')).rejects.toThrow('Too many attempts.');
  });
});
