import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { EmployeeProvider } from "@/context/EmployeeContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { ToastProvider } from "@/context/ToastContext";
import { ApprovalReviewPage } from "@/features/approvals/ApprovalReviewPage";
import { ApprovalsInboxPage } from "@/features/approvals/ApprovalsInboxPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { ClaimsPage } from "@/features/claims/ClaimsPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { EmployeesPage } from "@/features/employees/EmployeesPage";
import { NotFoundPage } from "@/features/errors/NotFoundPage";
import { FinanceInboxPage } from "@/features/finance/FinanceInboxPage";
import { FinanceReviewPage } from "@/features/finance/FinanceReviewPage";
import { HelpPage } from "@/features/help/HelpPage";
import { PolicyPage } from "@/features/policy/PolicyPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { CreateTravelRequestPage } from "@/features/travel-requests/CreateTravelRequestPage";
import { EditTravelRequestPage } from "@/features/travel-requests/EditTravelRequestPage";
import { SettlementPage } from "@/features/travel-requests/SettlementPage";
import { TrackTravelRequestsPage } from "@/features/travel-requests/TrackTravelRequestsPage";
import { TravelRequestDetailPage } from "@/features/travel-requests/TravelRequestDetailPage";
import { TravelRequestFormPage } from "@/features/travel-requests/TravelRequestFormPage";
import { paths } from "@/lib/routes";

// Route param names read by the pages via useParams()
const TRIP_ID = ":travelRequestId";
const CLAIM_TYPE = ":claimType";

/** Signed-in area: shell + feature pages. */
function ProtectedApp() {
  return (
    <RequireAuth>
      <AppShell>
        <Routes>
          <Route path={paths.home} element={<DashboardPage />} />
          <Route path={paths.claims} element={<ClaimsPage />} />
          <Route path={paths.newClaim(CLAIM_TYPE)} element={<CreateTravelRequestPage />} />

          {/* Requester: my trips */}
          <Route path={paths.myRequests} element={<TrackTravelRequestsPage />} />
          <Route path={paths.trip(TRIP_ID)} element={<TravelRequestDetailPage />} />
          <Route path={paths.tripForm(TRIP_ID)} element={<TravelRequestFormPage />} />
          <Route path={paths.tripEdit(TRIP_ID)} element={<EditTravelRequestPage />} />
          <Route path={paths.tripSettlement(TRIP_ID)} element={<SettlementPage />} />

          {/* Approvers */}
          <Route path={paths.approvals} element={<ApprovalsInboxPage />} />
          <Route path={paths.review(TRIP_ID)} element={<ApprovalReviewPage />} />
          <Route path={paths.reviewForm(TRIP_ID)} element={<TravelRequestFormPage />} />

          {/* Finance */}
          <Route path={paths.finance} element={<FinanceInboxPage />} />
          <Route path={paths.financeReview(TRIP_ID)} element={<FinanceReviewPage />} />
          <Route path={paths.financeForm(TRIP_ID)} element={<TravelRequestFormPage />} />

          {/* Insights, administration and help */}
          <Route path={paths.reports} element={<ReportsPage />} />
          <Route path={paths.employees} element={<EmployeesPage />} />
          <Route path={paths.policy} element={<PolicyPage />} />
          <Route path={paths.help} element={<HelpPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <EmployeeProvider>
      <NotificationsProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path={paths.login} element={<LoginPage />} />
              <Route path="/*" element={<ProtectedApp />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </NotificationsProvider>
    </EmployeeProvider>
  );
}
