import { Sidebar, NavItem } from "@/components/Sidebar";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  if (!session.doctorId) {
    redirect("/doctor/login");
  }

  const doctorNavItems: NavItem[] = [
    { label: "Patient Queue", href: "/doctor/queue", iconName: "queue" },
    { label: "Clinical Consult", href: "/doctor/queue", iconName: "consult" },
    { label: "Medical Records", href: "/doctor/queue", iconName: "records" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        items={doctorNavItems} 
        userName={session.name || "Doctor"} 
        userRole="Doctor"
      />
      <main className="md:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
