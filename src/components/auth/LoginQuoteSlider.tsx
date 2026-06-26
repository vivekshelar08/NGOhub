"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { INSPIRATIONAL_QUOTES } from "@/lib/inspirational-quotes";
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

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
          className
        )}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-mist text-brand-teal">
            <Quote className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-slate-700">&ldquo;{item.quote}&rdquo;</p>
            <p className="mt-2 text-xs font-semibold text-brand-ink">{item.author}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{item.title}</p>
          </div>
        </div>
        <SliderControls index={index} onDot={setIndex} onPrev={() => advance(-1)} onNext={() => advance(1)} />
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-4", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="rounded-xl border border-white/15 bg-black/25 p-6">
        <Quote className="mb-3 h-7 w-7 text-white/40" />
        <p className="text-lg leading-relaxed text-white">&ldquo;{item.quote}&rdquo;</p>
        <div className="mt-5 border-t border-white/15 pt-4">
          <p className="text-base font-semibold text-white">{item.author}</p>
          <p className="text-xs uppercase tracking-[0.15em] text-white/55">{item.title}</p>
        </div>
      </div>
      <SliderControls
        index={index}
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
  onDot,
  onPrev,
  onNext,
  light,
}: {
  index: number;
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
                ? light
                  ? "w-8 bg-white"
                  : "w-6 bg-brand-teal"
                : light
                  ? "w-3 bg-white/35 hover:bg-white/55"
                  : "w-2 bg-slate-200 hover:bg-slate-300"
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
            light
              ? "rounded-md border border-white/25 p-1.5 text-white/80 hover:bg-white/10"
              : "rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-teal"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Next quote"
          onClick={onNext}
          className={cn(
            light
              ? "rounded-md border border-white/25 p-1.5 text-white/80 hover:bg-white/10"
              : "rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-teal"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
