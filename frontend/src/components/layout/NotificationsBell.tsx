import { useNotifications } from "@/context/NotificationsContext";

export function NotificationsBell() {
  const { unreadCount, isOpen, toggle } = useNotifications();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-teal-700/40 hover:text-teal-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/25"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0"
        />
      </svg>
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-amber-200 px-1 text-[10px] font-bold leading-none text-amber-950 ring-2 ring-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
