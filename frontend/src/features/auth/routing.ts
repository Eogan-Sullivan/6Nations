export function authenticatedRedirect(onboardingComplete: boolean | null): '/squad' | '/onboarding' | null {
  if (onboardingComplete === null) return null;
  return onboardingComplete ? '/squad' : '/onboarding';
}
