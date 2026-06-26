import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StaleBuildRecovery } from "@/components/layout/StaleBuildRecovery";
import { PwaShell } from "@/components/layout/PwaShell";

export const metadata: Metadata = {
  title: "SVITECH Foundation | NGO Hub",
  description: "NGO Management Platform — Education, Technology, Community",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NGO Hub",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PwaShell />
        <StaleBuildRecovery />
        {children}
      </body>
    </html>
  );
}
