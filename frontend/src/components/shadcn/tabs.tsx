import * as React from "react";
import { cn } from "../../lib/utils";

type TabsContext = { value: string; setValue: (v: string) => void };
const Ctx = React.createContext<TabsContext | null>(null);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [internal, setInternal] = React.useState(defaultValue || "");
  const val = value !== undefined ? value : internal;
  const setVal = (v: string) =>
    onValueChange ? onValueChange(v) : setInternal(v);
  return (
    <Ctx.Provider value={{ value: val, setValue: setVal }}>
      <div className={cn("w-full", className)}>{children}</div>
    </Ctx.Provider>
  );
}
export function TabsList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border bg-background p-1",
        className
      )}
    >
      {children}
    </div>
  );
}
export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-input hover:bg-accent",
        className
      )}
    >
      {children}
    </button>
  );
}
export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div className={cn("pt-3", className)}>{children}</div>;
}
