import { Header } from "@/components/Header";

export default function RegionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  );
}
