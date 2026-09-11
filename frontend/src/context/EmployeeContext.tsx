import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchEmployees, fetchMe } from "@/api/me";
import { DEFAULT_EMPLOYEE_CODE } from "@/config/env";
import type { Capability } from "@/types/auth";
import type { EmployeeSummary } from "@/types/me";

interface EmployeeContextValue {
  employeeCode: string;
  employee: EmployeeSummary | null;
  employees: EmployeeSummary[];
  capabilities: Capability[];
  loading: boolean;
  error: string | null;
  setEmployeeCode: (code: string) => void;
  can: (capability: Capability) => boolean;
  refresh: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextValue | null>(null);

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [employeeCode, setEmployeeCode] = useState(DEFAULT_EMPLOYEE_CODE);
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, directory] = await Promise.all([
        fetchMe(employeeCode),
        fetchEmployees(employeeCode),
      ]);
      setEmployee(me.employee);
      setCapabilities(me.capabilities);
      setEmployees(directory);
    } catch (err) {
      setEmployee(null);
      setCapabilities([]);
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [employeeCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      employeeCode,
      employee,
      employees,
      capabilities,
      loading,
      error,
      setEmployeeCode,
      can: (capability: Capability) => capabilities.includes(capability),
      refresh,
    }),
    [employeeCode, employee, employees, capabilities, loading, error, refresh]
  );

  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) {
    throw new Error("useEmployee must be used within EmployeeProvider");
  }
  return ctx;
}
