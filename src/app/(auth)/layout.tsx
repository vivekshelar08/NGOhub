import { AppLogo } from "@/components/layout/AppLogo";
import { LoginHero } from "@/components/auth/LoginHero";
import { LoginQuoteSlider } from "@/components/auth/LoginQuoteSlider";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <LoginHero />

      <div className="relative flex min-h-screen flex-col bg-slate-50">
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/images/login-education.jpg')] bg-cover bg-center opacity-[0.07] lg:hidden"
          aria-hidden
        />

        <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-10">
          <div className="mb-5 w-full max-w-[420px] lg:hidden">
            <LoginQuoteSlider variant="compact" />
          </div>

          <div className="mb-6 flex w-full max-w-[420px] justify-center lg:mb-8">
            <AppLogo priority variant="auth" />
          </div>

          <div className="w-full max-w-[420px]">{children}</div>

          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} SVITECH Foundation · Svitech HR
          </p>
        </div>
      </div>
    </div>
  );
}
