import type { Metadata } from "next";
import "./globals.css";
import { LiveDemoProvider } from "@/context/LiveDemoContext";
import { EscalationToast } from "@/components/EscalationToast";

export const metadata: Metadata = {
  title: "Cure Cloud · Project Vaidhya",
  description: "Edge-AI telemedicine and predictive epidemiological analytics network for rural primary care",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <LiveDemoProvider>
          {children}
          <EscalationToast />
        </LiveDemoProvider>
      </body>
    </html>
  );
}

