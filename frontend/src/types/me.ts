import type { Capability } from "@/types/auth";

export interface EmployeeSummary {
  id: number;
  employee_code: string;
  name: string;
  designation: string;
  department: string;
  role: string;
  city: string;
}

export interface MeResponse {
  employee: EmployeeSummary;
  capabilities: Capability[];
}

/** Login / refresh response: profile + short-lived access token. */
export interface TokenResponse extends MeResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}
