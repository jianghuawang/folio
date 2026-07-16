import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { controlSurface, NESTED_RADIUS, panelSurface, Z } from "@/lib/panel-chrome";

export interface ReaderSelectOption {
  /** Optional extra classes for the option row, e.g. a font-family preview. */
  className?: string;
  label: string;
  value: string;
}

interface ReaderSelectProps {
  ariaLabel: string;
  darkTheme?: boolean;
  id?: string;
  onChange: (value: string) => void;
  options: readonly ReaderSelectOption[];
  placeholder?: string;
  value: string;
}

export function ReaderSelect({
  ariaLabel,
  darkTheme = false,
  id,
  onChange,
  options,
  placeholder = "Select…",
  value,
}: ReaderSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    // Capture phase so stopPropagation inside surrounding panels can't block outside-click close.
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown, { capture: true });

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, { capture: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const activeElement = listRef.current?.querySelector('[data-active="true"]');
    activeElement?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openMenu = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const selectOption = (option: ReaderSelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const activeOption = options[activeIndex];
        if (activeOption) {
          selectOption(activeOption);
        }
        break;
      }
      case "Escape":
        // Close only the menu, not a parent popover listening for Escape on document.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const triggerClassName = [
    "flex h-8 w-full items-center justify-between gap-2 rounded-md px-2.5 text-[13px] outline-none transition-colors focus-visible:border-[#0a84ff]/60",
    controlSurface(darkTheme ? "dark" : "light"),
    darkTheme ? "text-white" : "text-black",
  ].join(" ");

  const menuClassName = [
    `animate-panel-in origin-top absolute left-0 right-0 top-[calc(100%+6px)] ${Z.modal} max-h-[240px] overflow-y-auto p-1`,
    panelSurface(darkTheme ? "dark" : "light"),
  ].join(" ");

  const placeholderTextClassName = darkTheme ? "text-white/40" : "text-black/40";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        className={triggerClassName}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={["truncate", selectedOption ? "" : placeholderTextClassName].join(" ")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={[
            "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
            darkTheme ? "text-white/45" : "text-black/40",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <div ref={listRef} id={listboxId} role="listbox" aria-label={ariaLabel} className={menuClassName}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            const rowTextClassName = darkTheme
              ? isActive
                ? "bg-white/[0.1] text-white"
                : "text-white/80"
              : isActive
                ? "bg-black/[0.05] text-black"
                : "text-black/75";

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-active={isActive || undefined}
                className={[
                  `flex h-8 w-full items-center justify-between gap-2 ${NESTED_RADIUS} px-2.5 text-[13px] transition-colors`,
                  isSelected ? "font-medium" : "",
                  rowTextClassName,
                  option.className ?? "",
                ].join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-[#0a84ff]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
