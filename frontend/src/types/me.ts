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
