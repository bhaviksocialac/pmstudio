import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--surface-raised)] group-[.toaster]:text-foreground group-[.toaster]:border-0 group-[.toaster]:shadow-[var(--shadow-soft-lg)] group-[.toaster]:rounded-[20px] group-[.toaster]:px-5 group-[.toaster]:py-4",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-full group-[.toast]:shadow-[var(--shadow-soft-sm)]",
          cancelButton:
            "group-[.toast]:bg-[var(--surface-sunken)] group-[.toast]:text-muted-foreground group-[.toast]:rounded-full",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
