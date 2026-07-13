import { cn } from "@/lib/utils";

export function MetaLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground", className)}
      {...props}
    />
  );
}
