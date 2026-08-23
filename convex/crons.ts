import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "reconcile expired subscriptions",
  { hours: 24 },
  internal.billingReconciliation.reconcileExpiredSubscriptions,
  {}
);

export default crons;
