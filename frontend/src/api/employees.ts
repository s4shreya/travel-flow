import { apiFetch } from "@/api/client";

/** Read-only employee row for the administration directory. */
export interface EmployeeDirectoryItem {
  id: number;
  employee_code: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  cost_centre: string;
  city: string;
  role: string;
  manager_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  trips_total: number;
  trips_open: number;
}

export function fetchEmployees(): Promise<EmployeeDirectoryItem[]> {
  return apiFetch<EmployeeDirectoryItem[]>("/api/employees");
}
