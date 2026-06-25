import type { Metadata } from "next";
import "./globals.css";
import { StaleBuildRecovery } from "@/components/layout/StaleBuildRecovery";

export const metadata: Metadata = {
  title: "SVITECH Foundation | NGO Hub",
  description: "NGO Management Platform — Education, Technology, Community",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <StaleBuildRecovery />
        {children}
      </body>
    </html>
  );
}
