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
        "flex h-[44px] w-full items-center justify-between rounded-[14px] px-[14px] text-left text-[14px] transition-all duration-150",
        active
          ? "bg-[linear-gradient(90deg,rgba(86,86,90,0.34)_0%,rgba(60,60,64,0.28)_100%)] text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "text-white/74 hover:bg-white/[0.035] hover:text-white/90",
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          className={[
            "h-[18px] w-[18px] shrink-0 stroke-[1.9]",
            active ? "text-white/66" : "text-white/58",
          ].join(" ")}
        />
        <span className={active ? "font-medium text-white/82" : "font-medium text-white/80"}>
          {label}
        </span>
      </span>
      <span className={["text-[11px]", active ? "text-white/40" : "text-white/28"].join(" ")}>
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
        "w-[210px] shrink-0 bg-transparent pl-2 pb-2 pt-2",
        variant === "docked"
          ? "hidden pr-0 min-[1000px]:block"
          : "w-full pr-2",
      ].join(" ")}
    >
      <div className="flex h-full min-h-[calc(100vh-16px)] flex-col rounded-[28px] border border-white/[0.055] bg-[radial-gradient(circle_at_18%_0%,rgba(31,49,63,0.7)_0%,rgba(25,26,29,0.96)_26%,rgba(20,20,23,0.98)_72%,rgba(19,19,21,1)_100%)] px-[18px] pb-8 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div>
          <h1 className="text-[27px] font-semibold tracking-[-0.06em] text-white/96">
            Library
          </h1>
        </div>

        <div className="mt-16 space-y-2.5">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-white/36">
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
