/** App-wide env defaults. */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/** Demo signed-in employee until real auth exists. */
export const DEFAULT_EMPLOYEE_CODE =
  import.meta.env.VITE_EMPLOYEE_CODE ?? "NX-4471";

/** Policy §1.2 — advance may be up to 60% of estimated employee-borne cost. */
export const MAX_ADVANCE_RATIO = 0.6;
