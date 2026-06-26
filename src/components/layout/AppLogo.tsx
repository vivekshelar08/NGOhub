import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** light = white card; plain = logo only; auth = prominent on login */
  variant?: "light" | "plain" | "auth";
  compact?: boolean;
}

export function AppLogo({
  href,
  className,
  imageClassName,
  priority = false,
  variant = "light",
  compact = false,
}: AppLogoProps) {
  const logo = (
    <div
      className={cn(
        variant === "light" && "rounded-xl bg-white p-3 shadow-md ring-1 ring-slate-200/80",
        variant === "plain" && !compact && "overflow-hidden rounded-xl",
        variant === "plain" && compact && "overflow-hidden rounded-lg",
        variant === "auth" &&
          "relative rounded-2xl bg-white p-4 shadow-xl shadow-brand-emerald/20 ring-2 ring-brand-saffron/40",
        className
      )}
    >
      {variant === "auth" && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-saffron/10 via-transparent to-brand-emerald/10"
          aria-hidden
        />
      )}
      <Image
        src="/svitech-logo.png"
        alt="SVITECH Foundation — Education, Technology, Community"
        width={compact ? 120 : variant === "auth" ? 360 : 320}
        height={compact ? 33 : variant === "auth" ? 99 : 88}
        className={cn(
          "relative",
          compact && "h-7 w-auto max-w-[7.5rem]",
          !compact && variant === "auth" && "h-auto w-full max-w-[300px] brightness-110 contrast-110 xl:max-w-[340px]",
          !compact && variant !== "auth" && "h-auto w-full max-w-[280px] sm:max-w-[320px]",
          imageClassName
        )}
        priority={priority}
      />
    </div>
  );

  const wrapped =
    variant === "auth" ? (
      <div className="relative inline-block">
        <div
          className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand-saffron via-brand-emerald to-brand-sky opacity-60 blur-sm"
          aria-hidden
        />
        {logo}
      </div>
    ) : (
      logo
    );

  if (href) {
    return (
      <Link href={href} className="inline-block transition-opacity hover:opacity-90">
        {wrapped}
      </Link>
    );
  }

  return wrapped;
}
