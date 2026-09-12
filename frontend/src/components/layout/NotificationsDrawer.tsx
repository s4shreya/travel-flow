import { useEffect } from "react";
import { Link } from "react-router-dom";

import { useNotifications } from "@/context/NotificationsContext";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function NotificationsDrawer() {
  const {
    isOpen,
    close,
    notifications,
    unreadCount,
    markAllRead,
    markRead,
  } = useNotifications();

  // Lock body scroll and close on Escape while the drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Close notifications"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px] animate-fade"
        onClick={close}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-drawer-title"
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-drawer-in"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="notifications-drawer-title"
              className="font-display text-xl text-teal-950"
            >
              Notifications
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {unreadCount > 0
                ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                : "You are up to date"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-sm font-medium text-teal-800 transition hover:text-teal-950 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              ✕
            </button>
          </div>
        </header>

        <ul className="flex-1 overflow-y-auto px-2 py-2">
          {notifications.map((item) => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  {!item.read ? (
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-700"
                      aria-label="Unread"
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {formatWhen(item.created_at)}
                </p>
              </>
            );

            return (
              <li key={item.id} className="px-2 py-1">
                {item.href ? (
                  <Link
                    to={item.href}
                    onClick={() => {
                      markRead(item.id);
                      close();
                    }}
                    className="block rounded-lg px-3 py-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/30"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => markRead(item.id)}
                    className="block w-full rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
                  >
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
      </aside>
    </div>
  );
}
