import { History, Library, Search, X } from "lucide-react";

import { isMacOS } from "@/lib/platform";
import type { LibraryFilter } from "@/types/book";

interface SidebarProps {
  activeSection: LibraryFilter;
  onSectionChange: (section: LibraryFilter) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  variant?: "docked" | "sheet";
}

function SidebarButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
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
        "flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[14px] transition-colors duration-100",
        active
          ? "bg-white/[0.17] text-white"
          : "text-white/85 hover:bg-white/[0.07]",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-[18px] w-[18px] shrink-0 stroke-[1.7]",
          active ? "text-white" : "text-white/75",
        ].join(" ")}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function Sidebar({
  activeSection,
  onSectionChange,
  searchQuery,
  onSearchChange,
  onClearSearch,
  variant = "docked",
}: SidebarProps) {
  const docked = variant === "docked";

  return (
    <aside
      className={[
        "shrink-0",
        docked
          ? [
              "hidden w-[230px] min-[1000px]:flex min-[1000px]:flex-col",
              // Vibrancy shows through on macOS; solid panel elsewhere.
              isMacOS ? "bg-transparent" : "bg-[#232326]",
            ].join(" ")
          : "flex h-full w-full flex-col bg-[#232326]",
      ].join(" ")}
    >
      {/* Traffic-light clearance; also a window drag handle on macOS. */}
      {docked ? (
        <div data-tauri-drag-region className="h-[52px] shrink-0" />
      ) : (
        <div className="h-[52px] shrink-0" />
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        <div className="group/search relative flex h-[34px] items-center rounded-[8px] transition-colors duration-100 focus-within:bg-white/[0.07] hover:bg-white/[0.07]">
          <Search className="pointer-events-none ml-2.5 h-[18px] w-[18px] shrink-0 stroke-[1.7] text-white/75" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search"
            aria-label="Search library"
            className="h-full w-full min-w-0 bg-transparent pl-2.5 pr-8 text-[14px] text-white outline-none placeholder:text-white/85"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[#232326] transition-colors hover:bg-white/40"
              aria-label="Clear search"
            >
              <X className="h-2.5 w-2.5 stroke-[3]" />
            </button>
          ) : null}
        </div>

        <p className="mb-1.5 mt-7 px-2.5 text-[13px] font-bold text-white/90">Library</p>
        <div className="space-y-[3px]">
          <SidebarButton
            active={activeSection === "all"}
            icon={Library}
            label="All"
            onClick={() => onSectionChange("all")}
          />
          <SidebarButton
            active={activeSection === "recent"}
            icon={History}
            label="Recently Read"
            onClick={() => onSectionChange("recent")}
          />
        </div>
      </nav>
    </aside>
  );
}
