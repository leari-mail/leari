import { useEffect } from "react";
import { useSettingsStore } from "@stores";

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

/** Keeps the `dark` class on <html> in sync with the theme setting and the OS. */
export function useApplyTheme() {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && darkQuery.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    darkQuery.addEventListener("change", apply);
    return () => darkQuery.removeEventListener("change", apply);
  }, [theme]);
}
