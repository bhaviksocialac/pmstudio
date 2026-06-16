import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-2xl px-5 py-4 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-5 [&>svg]:top-5 [&>svg~*]:pl-8",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--surface-raised)] text-foreground shadow-[var(--shadow-soft-sm)] [&>svg]:text-foreground",
        destructive:
          "bg-[var(--chip-blush)] text-[var(--chip-blush-ink)] shadow-[var(--shadow-inset-sm)] [&>svg]:text-[var(--chip-blush-ink)]",
        success:
          "bg-[var(--chip-sage)] text-[var(--chip-sage-ink)] shadow-[var(--shadow-inset-sm)] [&>svg]:text-[var(--chip-sage-ink)]",
        warning:
          "bg-[var(--chip-peach)] text-[var(--chip-peach-ink)] shadow-[var(--shadow-inset-sm)] [&>svg]:text-[var(--chip-peach-ink)]",
        info:
          "bg-[var(--chip-mist)] text-[var(--chip-mist-ink)] shadow-[var(--shadow-inset-sm)] [&>svg]:text-[var(--chip-mist-ink)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
