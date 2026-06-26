"use client";

import { useCallback, useEffect, useState } from "react";

export interface FundOption {
  id: string;
  code: string;
  name: string;
  restriction: string;
  isFcra: boolean;
}

export interface FinanceProjectOption {
  id: string;
  code: string;
  name: string;
  fundingType: string | null;
  legacyProjectId: string | null;
  budgetLines: Array<{ budgetHead: string; amount: number; fundId: string | null }>;
}

export interface LedgerAccountOption {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface BankAccountOption {
  id: string;
  name: string;
  accountType: string;
  ledgerAccount: { code: string; name: string };
}

export interface FinanceMeta {
  funds: FundOption[];
  financeProjects: FinanceProjectOption[];
  accounts: LedgerAccountOption[];
  bankAccounts: BankAccountOption[];
}

export function useFinanceMeta() {
  const [meta, setMeta] = useState<FinanceMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/finance/meta");
    if (res.ok) {
      setMeta(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { meta, loading, reload: load };
}
