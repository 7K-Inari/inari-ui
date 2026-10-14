import * as React from "react";

interface DropdownProps {
  trigger: React.ReactElement;
  label: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  className?: string;
}

// Accessible dropdown: the trigger must be a real interactive element (button
// or element accepting a ref); the menu closes on Escape/outside click and
// supports ArrowUp/ArrowDown/Home/End navigation between .menu-item entries.
export function Dropdown({ trigger, label, children, align = "start", className }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const items = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(".menu-item:not([disabled])") ?? [],
    );

  const focusItem = (index: number) => {
    const list = items();
    if (list.length === 0) return;
    const clamped = (index + list.length) % list.length;
    list[clamped].focus();
  };

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => setOpen(false);

  const triggerRef = React.useRef<HTMLElement | null>(null);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeAndFocusTrigger();
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => focusItem(0));
      }
      return;
    }
    const list = items();
    const current = list.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(current <= 0 ? list.length - 1 : current - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(list.length - 1);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const triggerEl = React.cloneElement(trigger, {
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-label": label,
    ref: (el: HTMLElement | null) => {
      triggerRef.current = el;
      const originalRef = (trigger as { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof originalRef === "function") originalRef(el);
      else if (originalRef && typeof originalRef === "object")
        (originalRef as React.MutableRefObject<HTMLElement | null>).current = el;
    },
    onClick: (e: React.MouseEvent) => {
      (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
      setOpen((v) => !v);
    },
    onKeyDown,
  } as Partial<unknown>);

  return (
    <div ref={ref} className={`dropdown${className ? ` ${className}` : ""}`}>
      {triggerEl}
      {open && (
        <div
          ref={menuRef}
          className={`menu dropdown-menu dropdown-menu-${align}`}
          role="menu"
          onKeyDown={onKeyDown}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
