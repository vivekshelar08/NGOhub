"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const slides = [
  {
    src: "/images/login-community.jpg",
    title: "Community impact",
    caption: "Empowering people through education, technology, and outreach.",
  },
  {
    src: "/images/login-education.jpg",
    title: "Education for all",
    caption: "Building skills and opportunity in every community we serve.",
  },
  {
    src: "/images/login-volunteers.jpg",
    title: "Field action",
    caption: "Coordinating programs that create lasting social change.",
  },
];

export function LoginHero() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[index];

  return (
    <div className="relative hidden min-h-screen overflow-hidden lg:block">
      {slides.map((item, i) => (
        <Image
          key={item.src}
          src={item.src}
          alt={item.title}
          fill
          className={`object-cover transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          priority={i === 0}
          sizes="55vw"
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-br from-brand-teal/90 via-brand-ink/90 to-brand-blue/80" />

      <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            SVITECH Foundation
          </p>
          <h2 className="mt-4 max-w-lg text-3xl font-bold leading-tight text-white xl:text-4xl">
            NGO management for education, technology &amp; community
          </h2>
        </div>

        <div className="space-y-6">
          <div className="max-w-md rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md">
            <p className="text-lg font-semibold text-white">{slide.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/85">{slide.caption}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {["Education", "Technology", "Community"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-brand-red" : "w-3 bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
