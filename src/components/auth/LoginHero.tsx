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
          className={`object-cover transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          priority={i === 0}
          sizes="55vw"
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-br from-brand-teal/90 via-brand-ink/92 to-brand-blue/85" />

      <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
        <div>
          <AppLogo variant="auth" priority className="mb-8" />
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            SVITECH Foundation
          </p>
          <h2 className="mt-4 max-w-lg text-3xl font-bold leading-tight text-white xl:text-4xl">
            NGO management for education, technology &amp; community
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
            Coordinate programs, track beneficiaries, and manage operations in one trusted
            workspace.
          </p>
        </div>

        <div className="space-y-5">
          <LoginQuoteSlider variant="card" index={index} onIndexChange={setIndex} />

          <div className="flex flex-wrap gap-2">
            {["Education", "Technology", "Community"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-medium text-white/90"
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
