import React, { forwardRef } from "react";

function cn(...a: (string | false | undefined | null)[]) {
  return a.filter(Boolean).join(" ");
}

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
};

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className, wrapperClassName, ...props },
  ref
) {
  return (
    <label className={cn("block space-y-1", wrapperClassName)}>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <input
        ref={ref}
        {...props}
        className={cn(
          "w-full rounded-xl border border-input bg-secondary px-3 py-2.5",
          "text-foreground placeholder:text-muted",
          "focus:outline-none",
          className
        )}
      />
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="text-xs text-red-300">{error}</span>}
    </label>
  );
});

export default Input;
