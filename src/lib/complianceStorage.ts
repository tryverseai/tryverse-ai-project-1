/** Session flag: user completed legal onboarding this browser session (cleared on sign-out). */
export function complianceDoneSessionKey(userId: string): string {
  return `tryverse_compliance_done_${userId}`;
}
