"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  WALKTHROUGH_STEPS,
  WalkthroughModule,
  dismissWalkthrough,
  isWalkthroughDismissed,
} from "@/lib/walkthrough";

interface WalkthroughHostProps {
  module: WalkthroughModule;
}

export function WalkthroughHost({ module }: WalkthroughHostProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isWalkthroughDismissed(module));
  }, [module]);

  if (!visible) return null;

  const steps = WALKTHROUGH_STEPS[module];
  const current = steps[step];
  if (!current) return null;

  function handleDismiss() {
    dismissWalkthrough(module);
    setVisible(false);
  }

  function handleNext() {
    if (step >= steps.length - 1) {
      handleDismiss();
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div
      className="mb-4 rounded-xl border border-brand-teal/30 bg-brand-teal/5 p-4"
      data-walkthrough={current.target}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-teal">
            Quick tour · {step + 1}/{steps.length}
          </p>
          <p className="mt-1 font-medium text-slate-900">{current.title}</p>
          <p className="mt-1 text-sm text-slate-600">{current.body}</p>
        </div>
        <button type="button" onClick={handleDismiss} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="teal" onClick={handleNext}>
          {step >= steps.length - 1 ? "Got it" : "Next"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={handleDismiss}>
          Skip tour
        </Button>
      </div>
    </div>
  );
}
