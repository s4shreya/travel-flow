import { useEffect, useId, useRef } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

import { useNotifications } from "@/context/NotificationsContext";

export function NotificationsBell() {
  const {
    isOpen,
    toggle,
    close,
    notifications,
    unreadCount,
    markAllRead,
    markRead,
  } = useNotifications();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Close on outside click or Escape while the panel is open
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/25"
      >
        <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 flex max-h-[28rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-in"
        >
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-sm text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Mark all read
            </button>
          </header>

          <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
            {notifications.map((item) => {
              // Unread rows are tinted, like an inbox
              const rowClass = `block w-full px-5 py-3 text-left transition ${
                item.read ? "bg-white hover:bg-slate-50" : "bg-teal-50/70 hover:bg-teal-50"
              }`;
              const content = (
                <>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{item.body}</p>
                </>
              );

              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      to={item.href}
                      onClick={() => {
                        markRead(item.id);
                        close();
                      }}
                      className={rowClass}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => markRead(item.id)} className={rowClass}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
            {notifications.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-slate-500">
                No notifications yet.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
