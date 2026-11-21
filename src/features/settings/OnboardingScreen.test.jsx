import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingScreen } from './OnboardingScreen';

function renderOnboarding(auth = { isConfigured: true, actionLoading: false, sendEmailVerificationLink: vi.fn() }) {
  const onContinue = vi.fn();
  return {
    auth,
    onContinue,
    ...render(
      <OnboardingScreen
        onboardingName=""
        setOnboardingName={vi.fn()}
        status={{ type: 'idle', message: '' }}
        auth={auth}
        onContinue={onContinue}
      />
    )
  };
}

describe('OnboardingScreen email verification', () => {
  it('sends an optional verification link and still allows local onboarding', async () => {
    const { auth, onContinue } = renderOnboarding();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send verification link' }));

    await waitFor(() => expect(auth.sendEmailVerificationLink).toHaveBeenCalledWith('user@gmail.com'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows a connected address as verified when Supabase confirms it', () => {
    renderOnboarding({
      isConfigured: true,
      actionLoading: false,
      user: { email: 'user@gmail.com', email_confirmed_at: '2026-11-21T00:00:00Z' }
    });

    expect(screen.getByRole('status').textContent).toContain('Verified: user@gmail.com');
    expect(screen.queryByLabelText('Email address')).toBeNull();
  });
});
