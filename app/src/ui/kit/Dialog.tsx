// Dialog and Drawer on the native <dialog> element: showModal() gives the focus trap, inert background,
// Esc to close and focus return for free.
import { clsx } from "clsx";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

interface BaseProps {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Hide the visible title (it still names the dialog). */
  hideTitle?: boolean;
}

function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // showModal() focuses the first control, the Close button; a dialog whose job is a field marks that field
      // `data-autofocus` (React's autoFocus runs at mount, while the dialog is still closed, and is lost).
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);
  return ref;
}

function Header({
  id,
  title,
  hideTitle,
  onClose,
}: {
  id: string;
  title: ReactNode;
  hideTitle?: boolean | undefined;
  onClose(): void;
}) {
  return (
    <div className={clsx("flex items-center justify-between gap-3", hideTitle ? "sr-only" : "mb-3")}>
      <h2 id={id} className="text-h3">
        {title}
      </h2>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="inline-flex size-8 items-center justify-center rounded-control text-text-2 hover:bg-surface-2"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  hideTitle,
}: BaseProps) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  const descId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={() => {}}
      className={clsx(
        "m-auto w-[min(92vw,32rem)] rounded-sheet border border-border bg-surface p-5 text-text shadow-overlay",
        "backdrop:bg-scrim open:animate-pop-in",
        className,
      )}
    >
      {open && (
        <>
          <Header id={titleId} title={title} hideTitle={hideTitle} onClose={onClose} />
          {description && (
            <p id={descId} className="mb-4 text-text-2">
              {description}
            </p>
          )}
          {children}
          {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  hideTitle,
  side = "right",
  width = 400,
}: BaseProps & { side?: "left" | "right"; width?: number }) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={() => {}}
      style={{ width: `min(92vw, ${width}px)` }}
      className={clsx(
        "fixed top-0 m-0 h-dvh max-h-none border-border bg-surface p-0 text-text shadow-overlay",
        "backdrop:bg-scrim open:animate-slide-in-right",
        side === "right" ? "right-0 left-auto border-l" : "left-0 border-r",
        className,
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-4 pt-3">
            <Header id={titleId} title={title} hideTitle={hideTitle} onClose={onClose} />
            {description && <p className="mb-3 text-sm text-text-2">{description}</p>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border p-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
