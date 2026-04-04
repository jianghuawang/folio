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
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[14px] transition-colors",
        active
          ? "bg-[--color-sidebar-active-bg] text-[--color-sidebar-active-text]"
          : "text-[--color-text-muted] hover:bg-white/5 hover:text-[--color-text-primary]",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="text-xs text-[--color-text-muted]">{count}</span>
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
        "w-[210px] shrink-0 bg-[--color-bg-sidebar] px-4 py-6",
        variant === "docked"
          ? "hidden border-r border-[--color-border] min-[1000px]:block"
          : "w-full",
      ].join(" ")}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[--color-text-primary]">
            Library
          </h1>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[--color-text-section]">
            Library
          </p>
          <SidebarButton
            active={activeSection === "all"}
            count={allCount}
            label="All"
            onClick={() => onSectionChange("all")}
          />
          <SidebarButton
            active={activeSection === "recent"}
            count={recentCount}
            label="Recently Read"
            onClick={() => onSectionChange("recent")}
          />
        </div>
      </div>
    </aside>
  );
}
