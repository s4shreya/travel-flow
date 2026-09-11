import type { Capability } from "@/lib/capabilities";

export interface DashboardAction {
  id: string;
  title: string;
  description: string;
  to: string;
  /** If set, tile is shown only when the signed-in role has this capability. */
  capability?: Capability;
  /** Accent label shown on the tile. */
  eyebrow: string;
}

/** Single source of truth for dashboard action blocks. */
export const DASHBOARD_ACTIONS: DashboardAction[] = [
  {
    id: "create-request",
    eyebrow: "Request",
    title: "Create travel request",
    description: "Raise a new travel request for your upcoming trip.",
    to: "/travel-requests/new",
    capability: "create_request",
  },
  {
    id: "track-requests",
    eyebrow: "Track",
    title: "Track travel requests",
    description:
      "Track the status of your travel requests and view your travel history.",
    to: "/travel-requests",
    capability: "track_requests",
  },
  {
    id: "approve-requests",
    eyebrow: "Approvals",
    title: "Approve requests",
    description:
      "Review pending travel requests.",
    to: "/approvals",
    capability: "approve_requests",
  },
  {
    id: "release-funds",
    eyebrow: "Finance",
    title: "Release funds",
    description:
      "Disburse travel advances.",
    to: "/finance",
    capability: "release_funds",
  },
];
