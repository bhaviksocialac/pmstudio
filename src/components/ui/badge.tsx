import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30",
  {
    variants: {
      variant: {
        default:
          "bg-primary/12 text-primary shadow-[var(--shadow-inset-sm)]",
        secondary:
          "bg-[var(--chip-cream)] text-[var(--chip-cream-ink)] shadow-[var(--shadow-inset-sm)]",
        destructive:
          "bg-[var(--chip-blush)] text-[var(--chip-blush-ink)] shadow-[var(--shadow-inset-sm)]",
        success:
          "bg-[var(--chip-sage)] text-[var(--chip-sage-ink)] shadow-[var(--shadow-inset-sm)]",
        warning:
          "bg-[var(--chip-peach)] text-[var(--chip-peach-ink)] shadow-[var(--shadow-inset-sm)]",
        info:
          "bg-[var(--chip-mist)] text-[var(--chip-mist-ink)] shadow-[var(--shadow-inset-sm)]",
        outline:
          "bg-[var(--surface-raised)] text-foreground shadow-[var(--shadow-soft-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
