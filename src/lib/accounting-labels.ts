import { AccountCategory, FundRestriction } from "@/generated/prisma/enums";

export const FUND_RESTRICTION_LABELS: Record<FundRestriction, string> = {
  UNRESTRICTED: "Unrestricted",
  RESTRICTED: "Restricted",
  DESIGNATED: "Designated",
};

export const ACCOUNT_CATEGORY_LABELS: Record<AccountCategory, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity / Fund Balance",
  INCOME: "Income",
  EXPENSE: "Expense",
};
