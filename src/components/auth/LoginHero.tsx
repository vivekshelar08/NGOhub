"use client";

import { useState } from "react";
import Image from "next/image";
import { LoginQuoteSlider } from "@/components/auth/LoginQuoteSlider";
import { INSPIRATIONAL_QUOTES } from "@/lib/inspirational-quotes";
import { AppLogo } from "@/components/layout/AppLogo";

export function LoginHero() {
  const [index, setIndex] = useState(0);

  return (
    <div className="relative hidden min-h-screen overflow-hidden lg:block">
      {INSPIRATIONAL_QUOTES.map((item, i) => (
        <Image
          key={item.image ?? item.author}
          src={item.image ?? "/images/login-community.jpg"}
          alt=""
          fill
          className={`object-cover transition-all duration-1000 ${
            i === index ? "opacity-100 scale-100" : "opacity-0 scale-105"
          }`}
          priority={i === 0}
          sizes="55vw"
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-br from-brand-emerald/95 via-brand-ink/88 to-brand-violet/75" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-brand-saffron/20" />

      <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
        <div>
          <AppLogo variant="auth" priority className="mb-8" />
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-brand-saffron-light">
            Inspiring change together
          </p>
          <h2 className="mt-4 max-w-lg text-3xl font-bold leading-tight text-white xl:text-4xl">
            Every act of service writes a brighter chapter for our communities
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
            NGO Hub helps your team turn compassion into measurable impact — from field visits to
            finance, all in one place.
          </p>
        </div>

        <div className="space-y-6">
          <LoginQuoteSlider variant="card" index={index} onIndexChange={setIndex} />

          <div className="flex flex-wrap gap-2">
            {["Hope", "Service", "Dignity", "Impact"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
