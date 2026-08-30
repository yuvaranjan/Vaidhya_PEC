import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { LiveDemoProvider } from "@/context/LiveDemoContext";
import { EscalationToast } from "@/components/EscalationToast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VaidhyaPredict — Public Health & Predictive Analytics Dashboard",
  description:
    "Real-time disease surveillance and predictive analytics for rural telemedicine in Tamil Nadu. Track outbreaks, view risk assessments, and access AI-driven insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        <LiveDemoProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <EscalationToast />
        </LiveDemoProvider>
      </body>
    </html>
  );
}
