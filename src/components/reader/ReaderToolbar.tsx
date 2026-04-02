import {
  Bookmark,
  Menu,
  NotebookTabs,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ReaderToolbarProps {
  title: string;
  visible: boolean;
  onToggleToc: () => void;
}

function ToolbarIconButton({
  disabled = false,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      className="h-10 w-10 rounded-full text-black/70 disabled:opacity-100 hover:bg-black/[0.05] hover:text-black/85"
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  );
}

export function ReaderToolbar({ title, visible, onToggleToc }: ReaderToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-3">
      <div
        className={[
          "absolute left-5 top-3 flex items-center transition-opacity duration-200 ease-out",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center rounded-full border border-black/5 bg-white/92 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.10)] backdrop-blur-xl">
          <ToolbarIconButton
            icon={<Menu className="h-5 w-5 stroke-[1.75]" />}
            label="TOC"
            onClick={onToggleToc}
          />
          <ToolbarIconButton
            disabled
            icon={<Bookmark className="h-5 w-5 stroke-[1.75]" />}
            label="Bookmarks"
          />
          <ToolbarIconButton disabled icon={<NotebookTabs className="h-5 w-5 stroke-[1.75]" />} label="Notes" />
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 px-4 text-center text-[13px] font-semibold tracking-[0.01em] text-black/80">
        {title}
      </div>

      <div
        className={[
          "absolute right-5 top-3 flex items-center transition-opacity duration-200 ease-out",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center rounded-full border border-black/5 bg-white/92 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.10)] backdrop-blur-xl">
          <button
            type="button"
            disabled
            className="flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[15px] font-semibold tracking-[-0.02em] text-black/70"
            aria-label="Reader settings"
            title="Reader settings"
          >
            Aa
          </button>
          <ToolbarIconButton disabled icon={<Search className="h-5 w-5 stroke-[1.75]" />} label="Search" />
          <ToolbarIconButton disabled icon={<Bookmark className="h-5 w-5 stroke-[1.75]" />} label="Notes" />
        </div>
      </div>
    </div>
  );
}
