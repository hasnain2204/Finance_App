import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MoreScreen } from './MoreScreen';

describe('More settings navigation', () => {
  it('places Cloud Sync beside Restore Data and opens its page', () => {
    const onOpenCloudSync = vi.fn();
    render(<MoreScreen status={{ type: 'idle', message: '' }} onOpenCloudSync={onOpenCloudSync} />);

    const restoreButton = screen.getByRole('button', { name: 'Restore Data' });
    const cloudSyncButton = screen.getByRole('button', { name: 'Cloud Sync' });
    expect(restoreButton.nextElementSibling).toBe(cloudSyncButton);

    fireEvent.click(cloudSyncButton);
    expect(onOpenCloudSync).toHaveBeenCalledOnce();
  });
});
