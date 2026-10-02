import {
  BarChart3,
  ClipboardCheck,
  FilePlus2,
  ListChecks,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { paths } from "@/lib/routes";
import type { Capability } from "@/types/auth";

export interface DashboardAction {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  /** If set, the action is shown only when the signed-in role has this capability. */
  capability?: Capability;
}

/** Single source of truth for dashboard quick actions. */
export const DASHBOARD_ACTIONS: DashboardAction[] = [
  {
    id: "create-request",
    title: "Raise a request",
    description: "Domestic or international travel request.",
    to: paths.claims,
    icon: FilePlus2,
    capability: "create_request",
  },
  {
    id: "track-requests",
    title: "Track my requests",
    description: "Status, advances and settlements.",
    to: paths.myRequests,
    icon: ListChecks,
    capability: "track_requests",
  },
  {
    id: "approve-requests",
    title: "Review approvals",
    description: "Requests and settlements awaiting you.",
    to: paths.approvals,
    icon: ClipboardCheck,
    capability: "approve_requests",
  },
  {
    id: "release-funds",
    title: "Payments",
    description: "Release advances and settlement payments.",
    to: paths.finance,
    icon: Wallet,
    capability: "release_funds",
  },
  {
    id: "view-reports",
    title: "Reports",
    description: "Organisation spend, trends and exports.",
    to: paths.reports,
    icon: BarChart3,
    capability: "view_reports",
  },
  {
    id: "view-employees",
    title: "Employees",
    description: "Directory, roles and reporting lines.",
    to: paths.employees,
    icon: Users,
    capability: "view_employees",
  },
];
