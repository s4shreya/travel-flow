import { apiFetch } from "@/api/client";

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
}

export function listNotifications(): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>("/api/notifications");
}

export function markNotificationRead(notificationId: number): Promise<AppNotification> {
  return apiFetch<AppNotification>(`/api/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead(): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>("/api/notifications/read-all", { method: "POST" });
}
