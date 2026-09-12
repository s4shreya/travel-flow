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
  const { employeeCode } = useEmployee();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await listNotifications(employeeCode);
      setNotifications(rows);
    } catch {
      setNotifications([]);
    }
  }, [employeeCode]);

  useEffect(() => {
    // Start empty for each persona; load from API (populated after advance release)
    setNotifications([]);
    void refresh();
  }, [refresh]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const markAllRead = useCallback(() => {
    void (async () => {
      try {
        const rows = await markAllNotificationsRead(employeeCode);
        setNotifications(rows);
      } catch {
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      }
    })();
  }, [employeeCode]);

  const markRead = useCallback(
    (id: number) => {
      void (async () => {
        try {
          const updated = await markNotificationRead(employeeCode, id);
          setNotifications((prev) =>
            prev.map((item) => (item.id === id ? updated : item)),
          );
        } catch {
          setNotifications((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, read: true } : item,
            ),
          );
        }
      })();
    },
    [employeeCode],
  );

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
