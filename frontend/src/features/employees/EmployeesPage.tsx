import { Download, LogIn, Plane, Search, UserCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchEmployees, type EmployeeDirectoryItem } from "@/api/employees";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { PageLoader } from "@/components/ui/Loader";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { useEmployee } from "@/context/EmployeeContext";
import { StatRow, type StatTile } from "@/features/dashboard/components/StatRow";
import { downloadCsv } from "@/lib/csv";
import { formatDate, todayIso } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";

const ROLE_TONE: Record<string, string> = {
  Admin: "bg-teal-50 text-teal-800 ring-teal-600/20",
  Finance: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  Employee: "bg-slate-100 text-slate-700 ring-slate-500/15",
};
// Approver roles (manager → MD) share one tone
const APPROVER_TONE = "bg-sky-50 text-sky-800 ring-sky-600/20";

const pill = "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

const columns: Column<EmployeeDirectoryItem>[] = [
  {
    key: "employee",
    header: "Employee",
    render: (emp) => (
      <>
        <p className="font-medium text-slate-900">{emp.name}</p>
        <p className="text-xs text-slate-500">
          {emp.employee_code} · {emp.email}
        </p>
      </>
    ),
  },
  {
    key: "role",
    header: "Role",
    render: (emp) => <span className={`${pill} ${ROLE_TONE[emp.role] ?? APPROVER_TONE}`}>{emp.role}</span>,
  },
  {
    key: "department",
    header: "Department",
    render: (emp) => (
      <>
        <p className="text-slate-900">{emp.designation}</p>
        <p className="text-xs text-slate-500">
          {emp.department} · {emp.cost_centre} · {emp.city}
        </p>
      </>
    ),
  },
  { key: "manager", header: "Reports to", render: (emp) => emp.manager_name ?? "—" },
  {
    key: "trips",
    header: "Trips",
    align: "right",
    render: (emp) => (
      <>
        <p className="text-slate-900">{emp.trips_total}</p>
        <p className="text-xs text-slate-500">{emp.trips_open} open</p>
      </>
    ),
  },
  {
    key: "login",
    header: "Last sign-in",
    render: (emp) => (emp.last_login_at ? formatDate(emp.last_login_at) : <span className="text-slate-400">Never</span>),
  },
  {
    key: "status",
    header: "Status",
    render: (emp) =>
      emp.is_active ? (
        <span className={`${pill} bg-emerald-50 text-emerald-800 ring-emerald-600/20`}>Active</span>
      ) : (
        <span className={`${pill} bg-slate-100 text-slate-600 ring-slate-500/15`}>Inactive</span>
      ),
  },
];

/** Read-only employee directory for administrators. */
export function EmployeesPage() {
  const { can } = useEmployee();
  const allowed = can("view_employees");
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    // load the directory
    fetchEmployees()
      .then((rows) => {
        if (!cancelled) setEmployees(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Failed to load employees"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  // role filter options from the data itself
  const roleOptions = useMemo(
    () => [
      { value: "", label: "All roles" },
      ...[...new Set(employees.map((emp) => emp.role))].sort().map((value) => ({ value, label: value })),
    ],
    [employees],
  );

  // filter by search text and role
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter(
      (emp) =>
        (!role || emp.role === role) &&
        (!needle ||
          [emp.name, emp.email, emp.employee_code, emp.department, emp.designation, emp.city].some((field) =>
            field.toLowerCase().includes(needle),
          )),
    );
  }, [employees, query, role]);

  const tiles: StatTile[] = useMemo(() => {
    const active = employees.filter((emp) => emp.is_active).length;
    const signedIn = employees.filter((emp) => emp.last_login_at).length;
    const departments = new Set(employees.map((emp) => emp.department)).size;
    return [
      { id: "total", label: "Employees", value: String(employees.length), hint: `${departments} departments`, icon: Users, accent: "teal" },
      { id: "active", label: "Active accounts", value: String(active), hint: `${employees.length - active} inactive`, icon: UserCheck, accent: "emerald" },
      { id: "signed-in", label: "Have signed in", value: String(signedIn), hint: "At least once", icon: LogIn, accent: "sky" },
      {
        id: "travelling",
        label: "Open trips",
        value: String(employees.reduce((sum, emp) => sum + emp.trips_open, 0)),
        hint: `${employees.filter((emp) => emp.trips_open > 0).length} employees travelling`,
        icon: Plane,
        accent: "amber",
      },
    ];
  }, [employees]);

  function exportCsv() {
    downloadCsv(
      `travelflow-employees-${todayIso()}.csv`,
      ["Code", "Name", "Email", "Role", "Designation", "Department", "Cost centre", "City", "Reports to", "Trips", "Open trips", "Last sign-in", "Status"],
      rows.map((emp) => [
        emp.employee_code,
        emp.name,
        emp.email,
        emp.role,
        emp.designation,
        emp.department,
        emp.cost_centre,
        emp.city,
        emp.manager_name,
        emp.trips_total,
        emp.trips_open,
        emp.last_login_at ? formatDate(emp.last_login_at) : "Never",
        emp.is_active ? "Active" : "Inactive",
      ]),
    );
  }

  if (!allowed) {
    return <Alert tone="error">You do not have access to the employee directory.</Alert>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in">
      <PageHeader
        eyebrow="Administration"
        title="Employees"
        aside={
          <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0} className="gap-2">
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        }
      >
        <p className="text-sm text-slate-600">
          Everyone with a TravelFlow account, their role and reporting line.
        </p>
      </PageHeader>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <PageLoader />
      ) : (
        <>
          <StatRow label="Overview" tiles={tiles} loading={false} />

          {/* search + role filter */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs text-slate-500">
              {rows.length} of {employees.length} employees
            </p>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <div className="relative min-w-64 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, code, department"
                  aria-label="Search employees"
                  className="pl-9"
                />
              </div>
              <div className="w-48">
                <SelectMenu id="employee-role" value={role} options={roleOptions} onChange={setRole} />
              </div>
            </div>
          </div>

          <DataTable columns={columns} rows={rows} rowKey={(emp) => emp.id} empty="No employees match these filters." />
        </>
      )}
    </div>
  );
}
