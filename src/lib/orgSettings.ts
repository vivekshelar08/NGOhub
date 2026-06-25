export interface OrgSettingsData {
  orgName: string;
  orgAddress: string | null;
  orgPan: string | null;
  org80G: string | null;
  org12A: string | null;
  orgFcra: string | null;
  orgEmail: string | null;
  orgPhone: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smsProvider: string | null;
  smsApiKey: string | null;
  whatsappApiKey: string | null;
  razorpayKeyId: string | null;
}

export const DEFAULT_ORG_SETTINGS: OrgSettingsData = {
  orgName: "SVITECH Foundation",
  orgAddress: "Maharashtra, India",
  orgPan: null,
  org80G: null,
  org12A: null,
  orgFcra: null,
  orgEmail: null,
  orgPhone: null,
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smsProvider: null,
  smsApiKey: null,
  whatsappApiKey: null,
  razorpayKeyId: null,
};

export function mergeOrgSettings(row: Partial<OrgSettingsData> | null | undefined): OrgSettingsData {
  return { ...DEFAULT_ORG_SETTINGS, ...row };
}
