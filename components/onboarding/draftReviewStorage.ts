/** sessionStorage key OnboardingWizard writes to and OnboardingDraftReview reads from — shared so the two never drift apart. */
export const ONBOARDING_DRAFT_STORAGE_KEY = "shift:onboardingDraft";

export interface OnboardingDraft {
  dates: string[];
  staff: { id: string; name: string }[];
  shiftTypes: { id: string; code: string; name: string }[];
  assignments: { staffId: string; date: string; shiftTypeId: string }[];
}
