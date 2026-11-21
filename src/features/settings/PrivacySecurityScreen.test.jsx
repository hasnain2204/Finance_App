import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivacySecurityScreen } from './PrivacySecurityScreen';
import { MoreScreen } from './MoreScreen';

describe('Privacy and security settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('sets a PIN before enabling the selected notes lock', async () => {
    const onSaveSettings = vi.fn();
    render(
      <PrivacySecurityScreen
        onBack={vi.fn()}
        settings={{ appLockEnabled: false, notesLockEnabled: false, pinVerifier: '' }}
        onSaveSettings={onSaveSettings}
      />
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Lock Notes' }));
    fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('Confirm PIN'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save PIN' }));

    await waitFor(() => expect(onSaveSettings).toHaveBeenCalledWith({ notesLockEnabled: true }));
    expect(window.localStorage.getItem('pws-security-settings')).not.toContain('123456');
  });

  it('exposes Privacy & Security from More', () => {
    const onOpenPrivacySecurity = vi.fn();
    render(<MoreScreen status={{ type: 'idle', message: '' }} onOpenPrivacySecurity={onOpenPrivacySecurity} />);

    fireEvent.click(screen.getByRole('button', { name: 'Privacy & Security' }));
    expect(onOpenPrivacySecurity).toHaveBeenCalledOnce();
  });
});
