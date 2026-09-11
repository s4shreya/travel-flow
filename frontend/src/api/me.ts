import { apiFetch } from "@/api/client";
import type { EmployeeSummary, MeResponse } from "@/types/me";

export function fetchMe(employeeCode: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/me", {
    method: "GET",
    employeeCode,
  });
}

export function fetchEmployees(employeeCode: string): Promise<EmployeeSummary[]> {
  return apiFetch<EmployeeSummary[]>("/api/employees", {
    method: "GET",
    employeeCode,
  });
}
