import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Tooltip } from "./Tooltip.tsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks clicks; the label stays for screen readers. */
  loading?: boolean;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Three steps of emphasis that all read as buttons. A ghost (text) button is a quiet tonal pill — a tint of the
 * text colour, so it shows on the page, on cards and in both themes — never bare text ("Ask Claude", "Wrap up"
 * read like prose before Wave 3). Icon-only buttons stay transparent until hovered (`ICON_VARIANTS`).
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover border-transparent",
  secondary: "bg-control text-text border-control-border hover:bg-control-hover",
  ghost: "bg-text/[0.06] text-text border-transparent hover:bg-text/[0.11] aria-pressed:bg-text/[0.13]",
  danger: "bg-danger text-on-danger border-transparent hover:opacity-90",
  /** A text action inside a line of other actions ("Wrap up", "Try a new one"): underlined, so it reads as one. */
  link: "bg-transparent text-link border-transparent underline decoration-current/40 underline-offset-[3px] hover:decoration-current",
};
const ICON_VARIANTS: Record<ButtonVariant, string> = {
  ...VARIANTS,
  ghost: "bg-transparent text-text-2 border-transparent hover:bg-surface-2 hover:text-text",
};
const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-sm gap-1.5",
  md: "h-8 px-3 text-sm gap-2",
  lg: "h-10 px-4 text-base gap-2",
};

const LINK_SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-0.5 text-sm gap-1.5",
  md: "h-8 px-0.5 text-sm gap-1.5",
  lg: "h-10 px-0.5 text-base gap-2",
};

export const buttonClass = (variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) =>
  clsx(
    "inline-flex items-center justify-center whitespace-nowrap rounded-full border font-medium",
    "transition-colors duration-150 select-none",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    variant === "link" ? LINK_SIZES[size] : SIZES[size],
    extra,
  );

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin reduced:animate-none" /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Accessible name and tooltip text. */
  label: string;
  icon: ReactNode;
  /** Shortcut shown in the tooltip, e.g. "⌘J". */
  shortcut?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pressed?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  /** See `Tooltip`'s `align`: `end` for an icon at the right edge of the window. */
  tooltipAlign?: "start" | "center" | "end";
  ref?: Ref<HTMLButtonElement>;
}

const ICON_SIZES: Record<ButtonSize, string> = { sm: "size-7", md: "size-8", lg: "size-10" };

export function IconButton({
  label,
  icon,
  shortcut,
  variant = "ghost",
  size = "md",
  pressed,
  className,
  type = "button",
  tooltipSide = "bottom",
  tooltipAlign = "center",
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide} align={tooltipAlign}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        className={clsx(
          "inline-flex items-center justify-center rounded-control border transition-colors duration-150",
          "disabled:opacity-50 disabled:pointer-events-none",
          ICON_VARIANTS[variant],
          ICON_SIZES[size],
          pressed && "bg-surface-2 text-text",
          className,
        )}
        {...rest}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
