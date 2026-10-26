export type ApprovalStatus = "approved" | "pending" | "rejected";

interface ApprovableOperator {
  approvalStatus?: ApprovalStatus;
}

/**
 * The approval state of a driver.
 *
 * The field is optional on the document so that adding it did not need a
 * backfill. An operator without a value predates the approval flow, which
 * means the admin panel never has to re-approve a working driver.
 */
export function approvalStatusOf(operator: ApprovableOperator): ApprovalStatus {
  return operator.approvalStatus ?? "approved";
}

/**
 * True when the driver has been cleared to take rides.
 */
export function isApproved(operator: ApprovableOperator): boolean {
  return approvalStatusOf(operator) === "approved";
}
