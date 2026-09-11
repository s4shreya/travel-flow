import { TravelRequestForm } from "@/features/travel-requests/TravelRequestForm";

export function CreateTravelRequestPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display mt-2 text-3xl text-teal-950 sm:text-4xl">
          Travel request
        </h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <TravelRequestForm />
      </div>
    </div>
  );
}
