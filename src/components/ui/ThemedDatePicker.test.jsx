import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemedDatePicker } from './ThemedDatePicker';

describe('ThemedDatePicker', () => {
  it('renders quick presets in reverse sequence: 2 Days Ago, Yesterday, Today', () => {
    const onChange = vi.fn();
    render(
      <ThemedDatePicker
        id="test-date"
        name="date"
        value="2026-11-16"
        onChange={onChange}
      />
    );

    // Open date picker bottom sheet
    const trigger = screen.getByRole('button', { name: /16 Nov 2026/i });
    fireEvent.click(trigger);

    // Find all preset pills
    const pills = screen.getAllByRole('button').filter(
      (btn) => ['2 Days Ago', 'Yesterday', 'Today'].includes(btn.textContent)
    );

    expect(pills.length).toBe(3);
    expect(pills[0].textContent).toBe('2 Days Ago');
    expect(pills[1].textContent).toBe('Yesterday');
    expect(pills[2].textContent).toBe('Today');

    // Click 2 Days Ago preset
    fireEvent.click(pills[0]);
    expect(onChange).toHaveBeenCalledOnce();
  });
});
