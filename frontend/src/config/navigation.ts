import {
  BarChart3,
  ClipboardCheck,
  FilePlus2,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { paths } from "@/lib/routes";
import type { Capability } from "@/types/auth";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Shown only when the signed-in role has this capability. */
  capability?: Capability;
  /** Custom active match (defaults to exact path). */
  isActive?: (pathname: string) => boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/** Sidebar navigation, filtered by role capabilities at render time. */
export const NAV_SECTIONS: NavSection[] = [
  {
    // Your own trips and claims
    label: "Work",
    items: [
      {
        label: "Dashboard",
        to: paths.home,
        icon: LayoutDashboard,
      },
      {
        label: "New Request",
        to: paths.claims,
        icon: FilePlus2,
        capability: "create_request",
        // Category picker and every claim form under it
        isActive: (pathname) => pathname.startsWith(paths.claims),
      },
      {
        label: "My Requests",
        to: paths.myRequests,
        icon: ListChecks,
        capability: "track_requests",
        // Any request page (list, detail, edit, settlement)
        isActive: (pathname) => pathname.startsWith(paths.myRequests),
      },
    ],
  },
  {
    // Queues you act on for others
    label: "Review",
    items: [
      {
        label: "Approvals",
        to: paths.approvals,
        icon: ClipboardCheck,
        capability: "approve_requests",
        // Inbox and every review page under it
        isActive: (pathname) => pathname.startsWith(paths.approvals),
      },
    ],
  },
  {
    // Money Finance releases or recovers
    label: "Finance",
    items: [
      {
        label: "Payments",
        to: paths.finance,
        icon: Wallet,
        capability: "release_funds",
        // Payments list and every Finance review page under it
        isActive: (pathname) => pathname.startsWith(paths.finance),
      },
    ],
  },
  {
    // Read-only organisation reporting
    label: "Insights",
    items: [
      {
        label: "Reports",
        to: paths.reports,
        icon: BarChart3,
        capability: "view_reports",
      },
    ],
  },
  {
    // People and access (administrators)
    label: "Administration",
    items: [
      {
        label: "Employees",
        to: paths.employees,
        icon: Users,
        capability: "view_employees",
      },
    ],
  },
  {
    // How-to guides and FAQs for everyone
    label: "Help",
    items: [
      {
        label: "Learning Hub",
        to: paths.help,
        icon: GraduationCap,
      },
    ],
  },
];
