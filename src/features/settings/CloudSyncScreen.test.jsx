import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CloudSyncScreen } from './CloudSyncScreen';

function makeProps(authUser = null) {
  return {
    auth: { loading: false, user: authUser },
    sync: {
      syncEnabled: false,
      syncPreferenceLoading: false,
      busy: false,
      status: { ownerUserId: null }
    },
    onBack: vi.fn(),
    onOpenCloudAccount: vi.fn(),
    onToggleSync: vi.fn()
  };
}

describe('Cloud Sync settings screen', () => {
  it('keeps the switch disabled until an email account is connected', () => {
    const props = makeProps();
    render(<CloudSyncScreen {...props} />);

    expect(screen.getByRole('switch', { name: 'Cloud Sync' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Connect account' }));
    expect(props.onOpenCloudAccount).toHaveBeenCalledOnce();
  });

  it('lets a connected account opt in to Cloud Sync', () => {
    const props = makeProps({ id: 'account-1', email: 'user@gmail.com' });
    render(<CloudSyncScreen {...props} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Cloud Sync' }));
    expect(props.onToggleSync).toHaveBeenCalledWith(true);
  });
});
