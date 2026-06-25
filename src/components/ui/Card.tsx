import { cn } from "@/lib/utils";

export function Card({ className, accent, ...props }: React.HTMLAttributes<HTMLDivElement> & { accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover",
        accent && "border-t-4 border-t-brand-red",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-bold tracking-tight text-brand-ink sm:text-xl", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-slate-500", className)} {...props} />;
}
