/** Travel & Expense Policy NTX-HR-POL-11 — reference shown next to forms. */

import { paths } from "@/lib/routes";

export const POLICY = {
  title: "Travel & Expense Policy",
  docId: "NTX-HR-POL-11",
  revision: "Rev 4",
  effective: "01 Apr 2026",
  path: paths.policy,
} as const;

export interface PolicyRule {
  /** Section number in the policy, e.g. "3.1". */
  section: string;
  label: string;
}

/** Policy §1.2 — advance may be up to 60% of estimated employee-borne cost. */
export const MAX_ADVANCE_RATIO = 0.6;
/** "60%" for copy next to the advance field. */
export const MAX_ADVANCE_PERCENT = `${Math.round(MAX_ADVANCE_RATIO * 100)}%`;

/** Link to a policy section, e.g. "/policy#section-3-1". */
export function policySectionHref(section: string): string {
  return `${POLICY.path}#section-${section.replace(/\./g, "-")}`;
}

// Rules the travel request form applies
export const TRAVEL_REQUEST_RULES: PolicyRule[] = [
  { section: "1", label: "Approved request before booking" },
  { section: "1", label: `Advance up to ${MAX_ADVANCE_PERCENT} of estimated cost` },
  { section: "2", label: "Approval route by estimated value" },
];

// Rules the settlement form and receipt scan apply
export const SETTLEMENT_RULES: PolicyRule[] = [
  { section: "3.1", label: "Lodging limit per night by city tier" },
  { section: "3.2", label: "Air travel booked by the travel desk" },
  { section: "3.3", label: "Meals limit per day" },
  { section: "4", label: "Non-reimbursable items excluded" },
  { section: "5", label: "Proof on every line, no duplicate bills" },
  { section: "5", label: "Submit within 7 days of return" },
];
