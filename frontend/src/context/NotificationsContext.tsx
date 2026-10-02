/* eslint-disable react-refresh/only-export-components -- provider + its hook live together */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/api/notifications";
import { useEmployee } from "@/context/EmployeeContext";

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  markAllRead: () => void;
  markRead: (id: number) => void;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { employee } = useEmployee();
  const employeeId = employee?.id ?? null;
  const [loaded, setLoaded] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Nothing to show until someone is signed in (and nothing after sign-out)
  const notifications = useMemo(
    () => (employeeId ? loaded : []),
    [employeeId, loaded],
  );

  const refresh = useCallback(async () => {
    try {
      setLoaded(await listNotifications());
    } catch {
      setLoaded([]);
    }
  }, []);

  // Load for each signed-in employee
  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    listNotifications()
      .then((rows) => !cancelled && setLoaded(rows))
      .catch(() => !cancelled && setLoaded([]));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const markAllRead = useCallback(() => {
    markAllNotificationsRead()
      .then(setLoaded)
      .catch(() => setLoaded((prev) => prev.map((item) => ({ ...item, read: true }))));
  }, []);

  const markRead = useCallback((id: number) => {
    const replace = (next: (item: AppNotification) => AppNotification) =>
      setLoaded((prev) => prev.map((item) => (item.id === id ? next(item) : item)));
    markNotificationRead(id)
      .then((updated) => replace(() => updated))
      .catch(() => replace((item) => ({ ...item, read: true })));
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
      markAllRead,
      markRead,
      refresh,
    }),
    [notifications, unreadCount, isOpen, markAllRead, markRead, refresh],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
