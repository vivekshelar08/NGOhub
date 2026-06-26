import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "teal" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-gradient-to-r from-brand-coral to-brand-red text-white shadow-md shadow-brand-coral/30 hover:from-brand-red hover:to-brand-red-dark focus-visible:ring-brand-coral/40",
    secondary:
      "bg-brand-blue-light text-brand-blue hover:bg-brand-blue/10 focus-visible:ring-brand-blue/30",
    outline:
      "border-2 border-brand-teal bg-white text-brand-teal hover:bg-brand-mist focus-visible:ring-brand-teal/30",
    teal: "bg-gradient-to-r from-brand-emerald to-brand-teal text-white shadow-md shadow-brand-emerald/25 hover:from-brand-teal-dark hover:to-brand-teal-dark focus-visible:ring-brand-emerald/40",
    danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
