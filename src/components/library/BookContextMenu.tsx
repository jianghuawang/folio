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
        "flex h-[26px] w-full items-center gap-[7px] rounded-[5px] px-2 text-left text-[13px] hover:bg-[#0a84ff] hover:text-white",
        destructive ? "text-[#ff453a]" : "text-white/90",
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

    const menuWidth = 210;
    const menuHeight = 118;

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
      className="animate-fade-in fixed z-50 w-[210px] rounded-[10px] border border-white/[0.14] bg-[#2c2c2e]/90 p-1 shadow-popup backdrop-blur-2xl"
      style={{ left: clampedPosition.x, top: clampedPosition.y }}
    >
      <MenuButton
        icon={<BookOpen className="h-[14px] w-[14px] stroke-[1.8]" />}
        onClick={() => {
          onDismiss();
          onOpenBook();
        }}
      >
        Open
      </MenuButton>
      <MenuButton
        icon={<Info className="h-[14px] w-[14px] stroke-[1.8]" />}
        onClick={() => {
          onDismiss();
          onShowInfo();
        }}
      >
        Book Info…
      </MenuButton>
      <Separator className="mx-2 my-1 w-auto bg-white/[0.14]" />
      <MenuButton
        destructive
        icon={<Trash2 className="h-[14px] w-[14px] stroke-[1.8]" />}
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
