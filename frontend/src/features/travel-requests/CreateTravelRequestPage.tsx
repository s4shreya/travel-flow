import { Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { PolicyReference } from "@/components/ui/PolicyReference";
import { TRAVEL_REQUEST_RULES } from "@/config/policy";
import { claimTypeBySlug } from "@/features/claims/claimTypes";
import { TravelRequestForm } from "@/features/travel-requests/TravelRequestForm";
import { paths } from "@/lib/routes";

export function CreateTravelRequestPage() {
  const { claimType: slug } = useParams();
  const claimType = claimTypeBySlug(slug);

  // Unknown claim type: back to the category picker
  if (!claimType) return <Navigate to={paths.claims} replace />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="New Request" title={claimType.title}>
        {/* Policy this form follows */}
        <PolicyReference rules={TRAVEL_REQUEST_RULES} />
      </PageHeader>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        {/* key resets the form when switching between claim types */}
        <TravelRequestForm key={claimType.kind} kind={claimType.kind} />
      </div>
    </div>
  );
}
