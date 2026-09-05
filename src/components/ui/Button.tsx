import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-strong disabled:bg-primary/50",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-subtle",
  tertiary: "bg-transparent text-text-muted hover:text-text hover:bg-surface-subtle",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/10",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", className = "", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      />
    );
  },
);
