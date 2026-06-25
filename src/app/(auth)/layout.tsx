import { AppLogo } from "@/components/layout/AppLogo";
import { LoginHero } from "@/components/auth/LoginHero";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <LoginHero />

      <div className="relative flex min-h-screen flex-col bg-slate-50">
        <div
          className="absolute inset-0 bg-[url('/images/login-education.jpg')] bg-cover bg-center opacity-[0.07] lg:hidden"
          aria-hidden
        />

        <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="mb-8 flex w-full max-w-[420px] justify-center">
            <AppLogo priority variant="plain" />
          </div>

          <div className="w-full max-w-[420px]">{children}</div>

          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} SVITECH Foundation · NGO Hub Platform
          </p>
        </div>
      </div>
    </div>
  );
}
