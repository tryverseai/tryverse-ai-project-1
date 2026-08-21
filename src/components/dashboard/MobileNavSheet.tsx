import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

export interface MobileNavItem {
  icon: React.ElementType;
  label: string;
  badge?: string | number;
}

export interface MobileNavGroup {
  section: string;
  items: MobileNavItem[];
}

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandEyebrow: string;
  brandName: string;
  groups: MobileNavGroup[];
  activeLabel: string;
  onSelect: (label: string) => void;
  /** Optional trailing action row under the identity block, e.g. an admin "Lock" button. */
  headerAction?: ReactNode;
  /** Optional footer content pinned to the bottom of the panel. */
  footer?: ReactNode;
}

/**
 * Full-height left slide-in navigation panel for mobile — replaces the old dropdown-under-navbar
 * pattern across the dashboard and admin, matching the app's desktop sidebar grouping.
 */
export function MobileNavSheet({
  open,
  onOpenChange,
  brandEyebrow,
  brandName,
  groups,
  activeLabel,
  onSelect,
  headerAction,
  footer,
}: MobileNavSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[85vw] max-w-[320px] p-0 flex flex-col gap-0 sm:max-w-[320px] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
              {brandEyebrow}
            </p>
            <p className="text-sm font-semibold text-foreground truncate">{brandName}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {headerAction}
            <SheetClose className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group.section}>
              <p className="px-3 mb-1.5 text-[0.6875rem] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                {group.section}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onSelect(item.label)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      activeLabel === item.label
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`flex-shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border ${
                          activeLabel === item.label
                            ? "border-background/30 text-background/80"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {footer && <div className="flex-shrink-0 border-t border-border p-4">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
