export type ApprovalDecisionOutcome =
  | "approved"
  | "rejected"
  | "deferred";

export interface ApprovalDecisionChange<T> {
  previous: T;
  next: T;
}

export interface ApprovalDecision {
  outcome: ApprovalDecisionOutcome;
  reason?: string;
  missionPolicyChange?: ApprovalDecisionChange<string>;
  ticketCapabilityChange?: ApprovalDecisionChange<string[]>;
  ticketSkillPackChange?: ApprovalDecisionChange<string[]>;
  budgetObservations?: string[];
}
