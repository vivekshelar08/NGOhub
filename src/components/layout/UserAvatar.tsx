import { cn, getFirstName, getUserInitials } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-10 w-10 text-sm",
};

export function UserAvatar({ name, size = "md", className }: UserAvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-teal font-semibold text-white ring-2 ring-white shadow-sm",
        sizeClasses[size],
        className
      )}
      aria-hidden
    >
      {getUserInitials(name)}
    </div>
  );
}

interface UserGreetingProps {
  name: string;
  showName?: boolean;
  avatarSize?: "sm" | "md" | "lg";
  className?: string;
  nameClassName?: string;
}

/** First name + round initials avatar — for compact mobile headers. */
export function UserGreeting({
  name,
  showName = true,
  avatarSize = "md",
  className,
  nameClassName,
}: UserGreetingProps) {
  const firstName = getFirstName(name);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showName && (
        <span className={cn("text-sm font-medium text-slate-700", nameClassName)}>{firstName}</span>
      )}
      <UserAvatar name={name} size={avatarSize} />
    </div>
  );
}
