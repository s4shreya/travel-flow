import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { createTravelRequest, updateTravelRequest } from "@/api/travelRequests";
import { ApiError } from "@/api/client";
import { useToast } from "@/context/ToastContext";
import {
  toCreatePayload,
  validateTravelRequestForm,
  type FormErrors,
  type TravelRequestFormValues,
} from "@/features/travel-requests/formModel";
import { paths } from "@/lib/routes";

interface UseCreateTravelRequestResult {
  submitting: boolean;
  errors: FormErrors;
  apiError: string | null;
  submit: (
    values: TravelRequestFormValues,
    asSubmit: boolean,
    confirmFirst?: () => Promise<boolean>,
  ) => Promise<void>;
  clearFeedback: () => void;
}

export function useCreateTravelRequest(
  editId?: string,
): UseCreateTravelRequestResult {
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  async function submit(
    values: TravelRequestFormValues,
    asSubmit: boolean,
    confirmFirst?: () => Promise<boolean>,
  ) {
    const nextErrors = asSubmit ? validateTravelRequestForm(values) : {};
    setErrors(nextErrors);
    setApiError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    // Ask only once the form is valid, so the popup never hides field errors
    if (confirmFirst && !(await confirmFirst())) return;

    setSubmitting(true);
    try {
      const payload = toCreatePayload(values, asSubmit);
      const result = editId
        ? await updateTravelRequest(editId, payload)
        : await createTravelRequest(payload);
      // Open the saved request and confirm with a toast
      const id = result.travel_request_id;
      toast(
        asSubmit ? `${id} submitted` : `${id} saved as draft`,
        asSubmit
          ? "It is on its way through the approval chain."
          : "Submit it when you're ready to send it for approval.",
      );
      navigate(paths.trip(id));
    } catch (error) {
      if (error instanceof ApiError) {
        // One message per line so the form can list every problem
        setApiError(error.messages.join("\n"));
      } else if (error instanceof Error) {
        setApiError(error.message);
      } else {
        setApiError("Something went wrong while saving the request");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function clearFeedback() {
    setApiError(null);
  }

  return {
    submitting,
    errors,
    apiError,
    submit,
    clearFeedback,
  };
}
