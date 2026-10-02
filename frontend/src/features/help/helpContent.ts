/** Learning hub content: the trip journey, role guides and FAQs. */

import { MAX_ADVANCE_PERCENT } from "@/config/policy";
import { paths } from "@/lib/routes";
import type { StepKey } from "@/lib/tripProgress";
import type { Capability } from "@/types/auth";

/** A link the reader can follow to do the thing being explained. */
export interface HelpAction {
  label: string;
  to: string;
}

/** What happens at one step of the trip journey (labels come from tripProgress). */
export interface JourneyDetail {
  who: string;
  what: string[];
  tip?: string;
  action?: HelpAction;
  /** Policy section behind this step, e.g. "2". */
  policy?: string;
}

export const JOURNEY: Record<StepKey, JourneyDetail> = {
  request: {
    who: "You",
    what: [
      "Open New Request and pick the kind of trip.",
      "Add destination, dates, purpose and the estimated cost by head (travel, hotel, meals…).",
      `Ask for an advance if you need cash up front (up to ${MAX_ADVANCE_PERCENT} of the employee-paid estimate).`,
      "Save as a draft or submit for approval.",
    ],
    tip: "Book nothing until the request is approved — flights and hotels are booked by the travel desk.",
    action: { label: "Start a claim", to: paths.claims },
    policy: "1",
  },
  approval: {
    who: "Your approvers, one after another",
    what: [
      "Up to ₹25,000: Reporting Manager.",
      "₹25,001 – ₹75,000: plus Head of Department.",
      "₹75,001 – ₹2,00,000: plus Head of Division.",
      "Above ₹2,00,000 or international: plus MD.",
    ],
    tip: "Once the last approver signs, the travel desk books the travel and hotel you marked as company-paid. Sent back? Edit the draft using the comments and submit again.",
    action: { label: "Track my requests", to: paths.myRequests },
    policy: "2",
  },
  advance: {
    who: "Finance",
    what: [
      "Finance releases your advance (in full or in part), or declines it with a reason.",
      "The travel desk bookings are already on your settlement as company-paid — you don't claim them.",
    ],
    tip: "No advance requested? This step is skipped and you go straight to the settlement.",
    policy: "1",
  },
  claim: {
    who: "You, after the trip",
    what: [
      "Open the trip and choose Start settlement.",
      "Drop your bills anywhere on the page — each one is scanned and pre-fills the expense.",
      "Check the scan result: it warns you when a file doesn't look like a valid receipt.",
      "Every expense needs a receipt; changes save automatically as a draft.",
      "Submit for Finance review when everything is in.",
    ],
    tip: "Submit within 7 calendar days of your return.",
    action: { label: "Go to my requests", to: paths.myRequests },
    policy: "5",
  },
  review: {
    who: "The Finance Controller",
    what: [
      "One review — no approval chain for claims.",
      "Finance checks each line and its receipt against the policy.",
      "They approve, send it back with comments, or reject it.",
    ],
    tip: "Sent back? Fix the lines mentioned in the comments and submit again.",
    policy: "5",
  },
  payment: {
    who: "Finance",
    what: [
      "Claim more than your advance: the balance is paid to you.",
      "Advance more than your claim: the difference is recovered from your next payroll.",
      "The trip then closes.",
    ],
    tip: "Payments go out in the runs on the 10th and 25th of each month.",
    policy: "1",
  },
};

export interface Guide {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  action?: HelpAction;
}

export interface GuideGroup {
  id: string;
  label: string;
  /** Who sees this group (by what the signed-in role can do). */
  visible: (can: (capability: Capability) => boolean) => boolean;
  guides: Guide[];
}

export const GUIDE_GROUPS: GuideGroup[] = [
  {
    id: "employee",
    label: "Travelling employee",
    visible: (can) => can("create_request"),
    guides: [
      {
        id: "raise",
        title: "Raise a travel request",
        summary: "Get a trip approved before anything is booked.",
        steps: [
          "Go to New request and choose the trip type.",
          "Fill destination, dates and purpose.",
          "Add estimated cost heads; the employee-paid total decides who approves.",
          `Optionally request an advance (max ${MAX_ADVANCE_PERCENT} of the employee-paid estimate).`,
          "Submit — you'll be notified at each decision.",
        ],
        action: { label: "New Request", to: paths.claims },
      },
      {
        id: "settle",
        title: "Claim your expenses (settlement)",
        summary: "After the trip, add your bills and get paid back.",
        steps: [
          "Open the trip from My requests and choose Start settlement.",
          "Drag bills onto the page or browse; the scan fills in the expense for you.",
          "Review the amount, date and category, then save.",
          "Add anything without a bill using “Add an expense without a bill”, then attach its receipt later.",
          "Check the settlement summary and submit for Finance review.",
        ],
        action: { label: "My requests", to: paths.myRequests },
      },
      {
        id: "sent-back",
        title: "Fix something that was sent back",
        summary: "Requests and claims can be returned with comments.",
        steps: [
          "Open the notification or the trip — the comments are shown at the top.",
          "Edit the request, or change the expenses on the settlement.",
          "Submit again; it goes back to the same reviewer.",
        ],
      },
    ],
  },
  {
    id: "approver",
    label: "Approver",
    // Finance also approves (settlement reviews) but has its own guides below
    visible: (can) => can("approve_requests") && !can("release_funds"),
    guides: [
      {
        id: "decide",
        title: "Review a travel request",
        summary: "Requests reach you when it's your level's turn.",
        steps: [
          "Open Approvals — only requests waiting on you are listed.",
          "Check the purpose, dates and estimated cost.",
          "Approve, send back with comments, or reject with a reason.",
          "Approved requests move to the next level or to Finance.",
        ],
        action: { label: "Open Approvals", to: paths.approvals },
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    // Admin also releases funds but does not review settlements; has its own guides below
    visible: (can) => can("release_funds") && !can("view_employees"),
    guides: [
      {
        id: "advance",
        title: "Release or decline an advance",
        summary: "Approved trips with an advance appear under Payments.",
        steps: [
          "Open Payments and pick an Advance release task.",
          "Release the full amount or a partial amount, or decline with a reason.",
        ],
        action: { label: "Open Payments", to: paths.finance },
      },
      {
        id: "review",
        title: "Review a settlement",
        summary: "Submitted claims come to you for one review.",
        steps: [
          "Open Approvals and pick a Finance review.",
          "Check each line, its receipt and any not-claimable amounts.",
          "Approve, or send back / reject with comments.",
        ],
        action: { label: "Open Approvals", to: paths.approvals },
      },
      {
        id: "pay",
        title: "Pay out or record a recovery",
        summary: "Approved settlements wait under Payments.",
        steps: [
          "Open Payments and pick a Settlement payment or Payroll recovery task.",
          "Confirm the amount and release it — the trip closes.",
        ],
        action: { label: "Open Payments", to: paths.finance },
      },
    ],
  },
  {
    id: "admin",
    label: "Administrator",
    visible: (can) => can("view_employees"),
    guides: [
      {
        id: "reports",
        title: "Monitor spend and turnaround",
        summary: "Organisation-wide, read-only figures under Reports.",
        steps: [
          "Open Reports and pick a period (month, quarter, financial year).",
          "Read the key figures, claimed vs approved trend and spend breakdowns.",
          "Search or filter the request register and export it as CSV.",
        ],
        action: { label: "Open Reports", to: paths.reports },
      },
      {
        id: "employees",
        title: "Look up an employee",
        summary: "Roles, reporting lines and sign-in activity.",
        steps: [
          "Open Employees and search by name, email, code or department.",
          "Filter by role to see approvers or Finance users.",
          "Check who they report to — that line decides their approval chain.",
        ],
        action: { label: "Open Employees", to: paths.employees },
      },
      {
        id: "payments",
        title: "Release advances and payouts",
        summary: "Administrators can act on the Finance Payments queue.",
        steps: [
          "Open Payments and pick an advance or settlement task.",
          "Release, decline or record the recovery, exactly as Finance does.",
          "You cannot process money on your own trips — another Finance user does.",
        ],
        action: { label: "Open Payments", to: paths.finance },
      },
    ],
  },
];

export interface Faq {
  q: string;
  a: string;
  /** Policy section that answers it, e.g. "3.3". */
  policy?: string;
}

export const FAQS: Faq[] = [
  {
    q: "How much advance can I ask for?",
    a: `Up to ${MAX_ADVANCE_PERCENT} of the employee-paid estimated cost on your request (company-paid bookings are not included). Finance may release it in full, in part, or decline it.`,
    policy: "1",
  },
  {
    q: "What happens if I spent less than my advance?",
    a: "The difference is shown as “You return” on the settlement and is recovered from your next payroll.",
    policy: "1",
  },
  {
    q: "Why is part of my expense marked “not claimable”?",
    a: "It is above the policy limit (for example hotel per night or meals per day) or a non-reimbursable item. Show it on the line — it is deducted, not hidden.",
    policy: "3.1",
  },
  {
    q: "Do I claim flights and hotels booked by the travel desk?",
    a: "No. They appear on your settlement as company-paid, for the record only, and are not reimbursed to you.",
    policy: "3.2",
  },
  {
    q: "Which files can I upload as receipts?",
    a: "PDF, JPG, PNG or WEBP up to 5 MB each. Drop them anywhere on the settlement page.",
    policy: "5",
  },
  {
    q: "The scan says “Not a valid receipt”. What now?",
    a: "The file doesn't look like a bill (no amount or bill details found). Upload the actual invoice, or fill the expense manually if you're sure it's right.",
  },
  {
    q: "I uploaded the wrong bill. How do I remove it?",
    a: "Bills not on an expense can be deleted from the “Bills not on an expense” list. Removing an expense also deletes its bill.",
  },
  {
    q: "Can I change my claim after submitting?",
    a: "No — it is locked while Finance reviews it. If they send it back, you can edit and resubmit.",
  },
  {
    q: "When will I be paid?",
    a: "After Finance approves the claim, in the next payment run on the 10th or 25th of the month.",
    policy: "5",
  },
];
