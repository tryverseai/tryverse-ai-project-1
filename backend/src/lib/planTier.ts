/** True when the user is on a free / trial SKU (preset models may be restricted). */
export function isFreeTierPlanId(planId: string | null | undefined): boolean {
  const p = String(planId || 'free')
    .trim()
    .toLowerCase();
  return p === 'free' || p === 'free_trial' || p === 'trial';
}
