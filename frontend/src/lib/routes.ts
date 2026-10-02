/** App URLs. */
export const paths = {
  login: "/login",
  home: "/",
  claims: "/claims",
  newClaim: (kind: string) => `/claims/${kind}`,
  myRequests: "/travel-requests",
  approvals: "/approvals",
  /** Approver's review of one request or settlement. */
  review: (id: string) => `/approvals/${id}`,
  /** Full request form, under the approver's or the requester's section. */
  reviewForm: (id: string) => `/approvals/${id}/form`,
  tripForm: (id: string) => `/travel-requests/${id}/form`,
  finance: "/finance",
  /** Finance's review of one advance / settlement payment, and its full form. */
  financeReview: (id: string) => `/finance/${id}`,
  financeForm: (id: string) => `/finance/${id}/form`,
  reports: "/reports",
  employees: "/employees",
  policy: "/policy",
  help: "/help",
  trip: (id: string) => `/travel-requests/${id}`,
  tripEdit: (id: string) => `/travel-requests/${id}/edit`,
  tripSettlement: (id: string) => `/travel-requests/${id}/settlement`,
} as const;
