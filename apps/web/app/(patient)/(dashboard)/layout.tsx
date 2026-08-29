import { Sidebar, NavItem } from "@/components/Sidebar";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  if (!session.patientId) {
    redirect("/login");
  }

  const patientNavItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", iconName: "dashboard" },
    { label: "Edge AI Voicebot Intake", href: "/voicebot", iconName: "assistant" },
    { label: "Prescriptions & eRx", href: "/prescription", iconName: "prescription" },
    { label: "Medical History", href: "/history", iconName: "history" },
    { label: "AI Settings", href: "/settings", iconName: "settings" },
    { label: "Profile", href: "/profile", iconName: "profile" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        items={patientNavItems} 
        userName={session.name || "Patient"} 
        userRole="Patient"
      />
      <main className="md:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
