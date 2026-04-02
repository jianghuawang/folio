import { BookOpen, Info, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { Separator } from "@/components/ui/separator";

interface BookContextMenuProps {
  open: boolean;
  position: { x: number; y: number } | null;
  onDismiss: () => void;
  onOpenBook: () => void;
  onShowInfo: () => void;
  onRemoveBook: () => void;
}

function MenuButton({
  children,
  destructive = false,
  icon,
  onClick,
}: {
  children: string;
  destructive?: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/10",
        destructive ? "text-[--color-destructive]" : "text-[--color-text-primary]",
      ].join(" ")}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function BookContextMenu({
  open,
  position,
  onDismiss,
  onOpenBook,
  onShowInfo,
  onRemoveBook,
}: BookContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onDismiss();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onDismiss, open]);

  const clampedPosition = useMemo(() => {
    if (!position) {
      return null;
    }

    const menuWidth = 220;
    const menuHeight = 132;

    return {
      x: Math.min(position.x, window.innerWidth - menuWidth - 16),
      y: Math.min(position.y, window.innerHeight - menuHeight - 16),
    };
  }, [position]);

  if (!open || !clampedPosition) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-[220px] overflow-hidden rounded-md border border-[--color-border-strong] bg-[--color-bg-surface] py-1 shadow-popup"
      style={{ left: clampedPosition.x, top: clampedPosition.y }}
    >
      <MenuButton
        icon={<BookOpen className="h-4 w-4" />}
        onClick={() => {
          onDismiss();
          onOpenBook();
        }}
      >
        Open
      </MenuButton>
      <MenuButton
        icon={<Info className="h-4 w-4" />}
        onClick={() => {
          onDismiss();
          onShowInfo();
        }}
      >
        Book Info…
      </MenuButton>
      <Separator className="my-1 bg-white/10" />
      <MenuButton
        destructive
        icon={<Trash2 className="h-4 w-4" />}
        onClick={() => {
          onDismiss();
          onRemoveBook();
        }}
      >
        Remove from Library
      </MenuButton>
    </div>,
    document.body,
  );
}
