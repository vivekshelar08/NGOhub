import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** light = white card; plain = logo only; auth = clear on login */
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
        (variant === "light" || variant === "auth") &&
          "rounded-xl bg-white p-3 shadow-md ring-1 ring-slate-200/80",
        variant === "plain" && !compact && "overflow-hidden rounded-xl",
        variant === "plain" && compact && "overflow-hidden rounded-lg",
        variant === "auth" && "p-4",
        className
      )}
    >
      <Image
        src="/svitech-logo.png"
        alt="SVITECH Foundation — Education, Technology, Community"
        width={compact ? 120 : variant === "auth" ? 340 : 320}
        height={compact ? 33 : variant === "auth" ? 94 : 88}
        className={cn(
          compact && "h-7 w-auto max-w-[7.5rem]",
          !compact && variant === "auth" && "h-auto w-full max-w-[300px] xl:max-w-[320px]",
          !compact && variant !== "auth" && "h-auto w-full max-w-[280px] sm:max-w-[320px]",
          imageClassName
        )}
        priority={priority}
      />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block transition-opacity hover:opacity-90">
        {logo}
      </Link>
    );
  }

  return logo;
}
