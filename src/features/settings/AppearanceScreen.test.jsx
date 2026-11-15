import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppearanceScreen } from './AppearanceScreen';

describe('AppearanceScreen', () => {
  it('renders theme choices and allows switching to Dark Theme', async () => {
    const onSaveAppearance = vi.fn().mockResolvedValue({ success: true });
    render(
      <AppearanceScreen
        isLightMode={true}
        onSaveAppearance={onSaveAppearance}
        onBack={vi.fn()}
      />
    );

    const lightOption = screen.getByRole('radio', { name: 'Light theme' });
    const darkOption = screen.getByRole('radio', { name: 'Dark theme' });

    expect(lightOption.getAttribute('aria-checked')).toBe('true');
    expect(darkOption.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(darkOption);

    expect(onSaveAppearance).toHaveBeenCalledWith(false);
    expect(darkOption.getAttribute('aria-checked')).toBe('true');
    expect(await screen.findByText(/Dark theme applied and saved/i)).not.toBeNull();
  });

  it('allows switching back to Light Theme', async () => {
    const onSaveAppearance = vi.fn().mockResolvedValue({ success: true });
    render(
      <AppearanceScreen
        isLightMode={false}
        onSaveAppearance={onSaveAppearance}
        onBack={vi.fn()}
      />
    );

    const lightOption = screen.getByRole('radio', { name: 'Light theme' });
    expect(lightOption.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(lightOption);

    expect(onSaveAppearance).toHaveBeenCalledWith(true);
    expect(lightOption.getAttribute('aria-checked')).toBe('true');
    expect(await screen.findByText(/Light theme applied and saved/i)).not.toBeNull();
  });
});
