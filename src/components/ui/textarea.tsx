import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "neu-inset-sm flex min-h-[80px] w-full px-4 py-3 text-sm transition-shadow",
          "placeholder:text-muted-foreground/80",
          "focus-visible:outline-none focus-visible:shadow-[inset_2px_2px_5px_rgba(184,168,148,0.32),inset_-2px_-2px_5px_rgba(255,255,255,0.95),0_0_0_3px_rgba(193,127,90,0.18)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
