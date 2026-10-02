import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { BrandMark } from "@/components/layout/BrandMark";
import { Loader } from "@/components/ui/Loader";
import { useEmployee } from "@/context/EmployeeContext";
import { paths } from "@/lib/routes";

/** Renders children only for a signed-in employee; otherwise redirects to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { employee, loading } = useEmployee();

  // Wait for the session check before deciding
  if (loading && !employee) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50">
        <BrandMark />
        <Loader label="Restoring your session…" />
      </div>
    );
  }

  // Not signed in: go to login (sign-in then lands on the dashboard)
  if (!employee) {
    return <Navigate to={paths.login} replace />;
  }

  return <>{children}</>;
}
