import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-10 w-10 rounded-md border border-border/40 bg-secondary/20" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="btn h-10 w-10 px-0 flex items-center justify-center text-foreground hover:text-primary border-border/80 bg-card hover:bg-secondary/40 rounded-md transition-all duration-200"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <SunIcon className="h-5 w-5 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <MoonIcon className="h-5 w-5 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
