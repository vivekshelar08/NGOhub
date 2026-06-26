"use client";

import Link from "next/link";
import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-mist p-6">
      <div className="page-card max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <CloudOff className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">You are offline</h1>
        <p className="mt-2 text-sm text-slate-600">
          NGO Hub needs a connection to load new pages. Your pending field data is still saved locally and
          will sync when you are back online.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="teal"
            className="gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/dashboard">
            <Button type="button" variant="outline" className="w-full">
              Go to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
