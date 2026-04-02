import { BookOpenText, Bookmark, Globe, Type } from "lucide-react";
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
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="h-9 rounded-full px-3 text-[--color-text-secondary] hover:bg-white/10 hover:text-[--color-text-primary]"
      aria-label={label}
    >
      {icon}
      <span className="hidden min-[700px]:inline">{label}</span>
    </Button>
  );
}

export function ReaderToolbar({ title, visible, onToggleToc }: ReaderToolbarProps) {
  return (
    <div
      className={[
        "pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-4 transition-opacity duration-200 ease-out",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div className="pointer-events-auto mx-auto flex max-w-[1200px] items-center justify-between gap-4 rounded-full border border-[--color-border] bg-[--color-bg-surface]/90 px-3 py-2 shadow-popup backdrop-blur">
        <div className="flex items-center gap-2">
          <ToolbarIconButton
            icon={<BookOpenText className="h-4 w-4" />}
            label="TOC"
            onClick={onToggleToc}
          />
        </div>

        <div className="truncate px-4 text-center text-[13px] font-light text-[--color-text-secondary]">
          {title}
        </div>

        <div className="flex items-center gap-2">
          <ToolbarIconButton disabled icon={<Type className="h-4 w-4" />} label="Aa" />
          <ToolbarIconButton disabled icon={<Globe className="h-4 w-4" />} label="Translate" />
          <ToolbarIconButton disabled icon={<Bookmark className="h-4 w-4" />} label="Notes" />
        </div>
      </div>
    </div>
  );
}
