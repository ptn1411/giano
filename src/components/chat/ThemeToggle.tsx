import { useState } from "react";
import { Sun, Moon, Palette, Check } from "lucide-react";
import { useTheme, colorThemes } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, colorTheme, setColorTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Light/Dark Toggle */}
      <button
        onClick={toggleTheme}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200",
          "hover:bg-accent text-foreground"
        )}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <Moon className="h-5 w-5" />
        ) : (
          <Sun className="h-5 w-5" />
        )}
      </button>

      {/* Color Theme Picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200",
              "hover:bg-accent text-foreground"
            )}
            aria-label="Choose color theme"
          >
            <Palette className="h-5 w-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="end">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 pb-1">
              Color Theme
            </p>
            {colorThemes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setColorTheme(t.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                  colorTheme === t.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
              >
                <span
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: t.preview }}
                />
                <span className="flex-1 text-left">{t.name}</span>
                {colorTheme === t.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
