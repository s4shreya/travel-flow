import { useState } from "react";

import { createTravelRequest, updateTravelRequest } from "@/api/travelRequests";
import { ApiError } from "@/api/client";
import { useEmployee } from "@/context/EmployeeContext";
import type { TravelRequest } from "@/types/travelRequest";
import {
  toCreatePayload,
  validateTravelRequestForm,
  type FormErrors,
  type TravelRequestFormValues,
} from "@/features/travel-requests/formModel";

interface UseCreateTravelRequestResult {
  submitting: boolean;
  errors: FormErrors;
  apiError: string | null;
  created: TravelRequest | null;
  submit: (values: TravelRequestFormValues, asSubmit: boolean) => Promise<void>;
  clearFeedback: () => void;
  reset: () => void;
}

export function useCreateTravelRequest(
  editId?: string,
): UseCreateTravelRequestResult {
  const { employeeCode } = useEmployee();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [created, setCreated] = useState<TravelRequest | null>(null);

  async function submit(values: TravelRequestFormValues, asSubmit: boolean) {
    const nextErrors = validateTravelRequestForm(values);
    setErrors(nextErrors);
    setApiError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = toCreatePayload(values, asSubmit);
      const result = editId
        ? await updateTravelRequest(employeeCode, editId, payload)
        : await createTravelRequest(employeeCode, payload);
      setCreated(result);
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(error.message);
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
    setCreated(null);
  }

  function reset() {
    setSubmitting(false);
    setErrors({});
    setApiError(null);
    setCreated(null);
  }

  return {
    submitting,
    errors,
    apiError,
    created,
    submit,
    clearFeedback,
    reset,
  };
}
