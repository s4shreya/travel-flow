import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { EmployeeProvider } from "@/context/EmployeeContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { ApprovalsInboxPage } from "@/features/approvals/ApprovalsInboxPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { FinanceAdvancesPage } from "@/features/finance/FinanceAdvancesPage";
import { CreateTravelRequestPage } from "@/features/travel-requests/CreateTravelRequestPage";
import { TrackTravelRequestsPage } from "@/features/travel-requests/TrackTravelRequestsPage";

export default function App() {
  return (
    <EmployeeProvider>
      <NotificationsProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route
                path="/travel-requests/new"
                element={<CreateTravelRequestPage />}
              />
              <Route
                path="/travel-requests"
                element={<TrackTravelRequestsPage />}
              />
              <Route path="/approvals" element={<ApprovalsInboxPage />} />
              <Route path="/finance" element={<FinanceAdvancesPage />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </NotificationsProvider>
    </EmployeeProvider>
  );
}
