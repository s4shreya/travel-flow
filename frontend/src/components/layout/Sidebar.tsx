import { Link, useLocation } from "react-router-dom";

import { BrandMark } from "@/components/layout/BrandMark";
import { NAV_SECTIONS } from "@/config/navigation";
import { POLICY } from "@/config/policy";
import { useEmployee } from "@/context/EmployeeContext";
import { paths } from "@/lib/routes";

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { can } = useEmployee();
  const { pathname } = useLocation();

  // Only show sections this role can use
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.capability || can(item.capability)),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full w-full flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center border-b border-slate-100 px-5">
        <Link to={paths.home} onClick={onNavigate} aria-label="TravelFlow home">
          <BrandMark />
        </Link>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = item.isActive
                  ? item.isActive(pathname)
                  : pathname === item.to;
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                        active
                          ? "bg-teal-50 text-teal-800"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 ${active ? "text-teal-700" : "text-slate-400 group-hover:text-slate-600"}`}
                        strokeWidth={2}
                        aria-hidden
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-3 py-3">
        <Link
          to={POLICY.path}
          onClick={onNavigate}
          className="block rounded-md px-2 py-1.5 text-[11px] leading-relaxed text-slate-400 transition hover:bg-slate-50 hover:text-teal-800"
        >
          {POLICY.title} {POLICY.docId}
          <br />
          {POLICY.revision} · Effective {POLICY.effective}
        </Link>
      </div>
    </div>
  );
}
