"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { ACCENT_GRADIENT, INSPIRATIONAL_QUOTES } from "@/lib/inspirational-quotes";
import { cn } from "@/lib/utils";

interface LoginQuoteSliderProps {
  variant?: "compact" | "card";
  className?: string;
  autoAdvanceMs?: number;
  index?: number;
  onIndexChange?: (index: number) => void;
}

export function LoginQuoteSlider({
  variant = "compact",
  className,
  autoAdvanceMs = 7000,
  index: controlledIndex,
  onIndexChange,
}: LoginQuoteSliderProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const index = controlledIndex ?? internalIndex;
  const [paused, setPaused] = useState(false);

  const setIndex = useCallback(
    (next: number | ((prev: number) => number)) => {
      const resolved = typeof next === "function" ? next(index) : next;
      const wrapped = (resolved + INSPIRATIONAL_QUOTES.length) % INSPIRATIONAL_QUOTES.length;
      if (onIndexChange) onIndexChange(wrapped);
      else setInternalIndex(wrapped);
    },
    [index, onIndexChange]
  );

  const advance = useCallback(
    (delta: number) => setIndex((i) => i + delta),
    [setIndex]
  );

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => advance(1), autoAdvanceMs);
    return () => clearInterval(timer);
  }, [advance, autoAdvanceMs, paused]);

  const item = INSPIRATIONAL_QUOTES[index];
  const gradient = ACCENT_GRADIENT[item.accent];

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/60 bg-white/90 p-4 shadow-lg shadow-brand-coral/10 backdrop-blur-sm",
          className
        )}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", gradient)} aria-hidden />
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
              gradient
            )}
          >
            <Quote className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-brand-ink">&ldquo;{item.quote}&rdquo;</p>
            <p className="mt-2 text-xs font-bold text-brand-emerald">{item.author}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{item.title}</p>
          </div>
        </div>
        <SliderControls index={index} gradient={gradient} onDot={setIndex} onPrev={() => advance(-1)} onNext={() => advance(1)} />
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-4", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
        <Quote className="mb-3 h-8 w-8 text-brand-saffron-light/60" />
        <p className="text-lg font-medium leading-relaxed text-white">&ldquo;{item.quote}&rdquo;</p>
        <div className="mt-5 border-t border-white/15 pt-4">
          <p className="text-base font-bold text-white">{item.author}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">{item.title}</p>
        </div>
      </div>
      <SliderControls
        index={index}
        gradient={gradient}
        onDot={setIndex}
        onPrev={() => advance(-1)}
        onNext={() => advance(1)}
        light
      />
    </div>
  );
}

function SliderControls({
  index,
  gradient,
  onDot,
  onPrev,
  onNext,
  light,
}: {
  index: number;
  gradient: string;
  onDot: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  light?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between", light ? "" : "mt-3")}>
      <div className="flex gap-1.5">
        {INSPIRATIONAL_QUOTES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Quote ${i + 1}`}
            onClick={() => onDot(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index
                ? cn("w-6 bg-gradient-to-r", gradient, light && "w-8")
                : light
                  ? "w-3 bg-white/35 hover:bg-white/55"
                  : "w-2 bg-slate-200"
            )}
          />
        ))}
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          aria-label="Previous quote"
          onClick={onPrev}
          className={cn(
            "rounded-lg p-1",
            light
              ? "rounded-full border border-white/25 p-2 text-white/80 hover:bg-white/10"
              : "text-slate-400 hover:bg-slate-100 hover:text-brand-emerald"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Next quote"
          onClick={onNext}
          className={cn(
            "rounded-lg p-1",
            light
              ? "rounded-full border border-white/25 p-2 text-white/80 hover:bg-white/10"
              : "text-slate-400 hover:bg-slate-100 hover:text-brand-emerald"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
