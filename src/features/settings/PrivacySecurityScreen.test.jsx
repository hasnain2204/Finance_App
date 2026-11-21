import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivacySecurityScreen } from './PrivacySecurityScreen';
import { MoreScreen } from './MoreScreen';

describe('Privacy and security settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('sets the PIN first, then allows app and notes locks to be enabled independently', async () => {
    const onSaveSettings = vi.fn();
    const props = {
      onBack: vi.fn(),
      settings: { appLockEnabled: false, notesLockEnabled: false, pinVerifier: '' },
      onSaveSettings
    };
    const { rerender } = render(
      <PrivacySecurityScreen
        {...props}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set PIN' }));
    expect(screen.getByRole('form', { name: 'Set PIN' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('Confirm PIN'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save PIN' }));

    await waitFor(() => expect(onSaveSettings).toHaveBeenCalledWith(expect.objectContaining({
      pinSalt: expect.any(String),
      pinVerifier: expect.any(String)
    })));
    expect(screen.queryByRole('form', { name: 'Set PIN' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('PIN added');
    expect(window.localStorage.getItem('pws-security-settings')).not.toContain('123456');

    rerender(
      <PrivacySecurityScreen
        {...props}
        settings={{ appLockEnabled: false, notesLockEnabled: false, pinVerifier: 'configured' }}
      />
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Lock Notes' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Lock the app' }));
    await waitFor(() => {
      expect(onSaveSettings).toHaveBeenCalledWith({ notesLockEnabled: true });
      expect(onSaveSettings).toHaveBeenCalledWith({ appLockEnabled: true });
    });
  });

  it('exposes Privacy & Security from More', () => {
    const onOpenPrivacySecurity = vi.fn();
    render(<MoreScreen status={{ type: 'idle', message: '' }} onOpenPrivacySecurity={onOpenPrivacySecurity} />);

    fireEvent.click(screen.getByRole('button', { name: 'Privacy & Security' }));
    expect(onOpenPrivacySecurity).toHaveBeenCalledOnce();
  });
});
