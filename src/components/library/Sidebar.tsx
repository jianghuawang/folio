import { History, Library } from "lucide-react";

import type { LibraryFilter } from "@/types/book";

interface SidebarProps {
  activeSection: LibraryFilter;
  allCount: number;
  recentCount: number;
  onSectionChange: (section: LibraryFilter) => void;
  variant?: "docked" | "sheet";
}

function SidebarButton({
  active,
  count,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: typeof Library;
  label: string;
  onClick: () => void;
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-[30px] w-full items-center justify-between rounded-[6px] px-2.5 text-left text-[13px] transition-colors duration-100",
        active
          ? "bg-white/[0.12] font-medium text-white"
          : "text-white/70 hover:bg-white/[0.06] hover:text-white/90",
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          className={[
            "h-[15px] w-[15px] shrink-0 stroke-[1.8]",
            active ? "text-white/80" : "text-white/50",
          ].join(" ")}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className={["text-[11px]", active ? "text-white/36" : "text-white/24"].join(" ")}>
        {count}
      </span>
    </button>
  );
}

export function Sidebar({
  activeSection,
  allCount,
  recentCount,
  onSectionChange,
  variant = "docked",
}: SidebarProps) {
  return (
    <aside
      className={[
        "w-[200px] shrink-0",
        variant === "docked"
          ? "hidden min-[1000px]:block"
          : "w-full",
      ].join(" ")}
    >
      <div className="flex h-full min-h-screen flex-col px-3 pb-6 pt-12">
        <div className="space-y-1">
          <p className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/30">
            Library
          </p>
          <SidebarButton
            active={activeSection === "all"}
            count={allCount}
            icon={Library}
            label="All"
            onClick={() => onSectionChange("all")}
          />
          <SidebarButton
            active={activeSection === "recent"}
            count={recentCount}
            icon={History}
            label="Recently Read"
            onClick={() => onSectionChange("recent")}
          />
        </div>
      </div>
    </aside>
  );
}
