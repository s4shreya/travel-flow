import { apiFetch } from "@/api/client";

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
}

export function listNotifications(
  employeeCode: string,
): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>("/api/notifications", {
    method: "GET",
    employeeCode,
  });
}

export function markNotificationRead(
  employeeCode: string,
  notificationId: number,
): Promise<AppNotification> {
  return apiFetch<AppNotification>(
    `/api/notifications/${notificationId}/read`,
    { method: "POST", employeeCode },
  );
}

export function markAllNotificationsRead(
  employeeCode: string,
): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>("/api/notifications/read-all", {
    method: "POST",
    employeeCode,
  });
}
