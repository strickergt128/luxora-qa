import React, { forwardRef } from "react";

function cn(...a: (string | false | undefined | null)[]) {
  return a.filter(Boolean).join(" ");
}

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  wrapperClassName?: string;
};

const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, error, className, wrapperClassName, children, ...props },
  ref
) {
  return (
    <label className={cn("block space-y-1", wrapperClassName)}>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <select
        ref={ref}
        {...props}
        className={cn(
          "w-full rounded-xl border border-input bg-secondary px-3 py-2.5",
          "text-foreground focus:outline-none",
          className
        )}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </label>
  );
});

export default Select;
