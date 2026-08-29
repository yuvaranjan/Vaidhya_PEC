import { getSession } from "@/lib/auth";
import { 
  User, 
  Phone, 
  Calendar, 
  Activity, 
  ShieldCheck, 
  LogOut, 
  Mail, 
  MapPin, 
  Heart,
  CheckCircle2
} from "lucide-react";

export default async function ProfilePage() {
  const session = await getSession();
  const userName = session.name || "Demo Patient";
  
  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-5 sm:px-8 space-y-7">
      {/* Header Pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-1">Account & Settings</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-[-0.025em]">Patient Profile</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-[#E5F5F3] text-[#14736A] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Identity Verified
          </span>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
        
        {/* User Hero Banner */}
        <div className="bg-secondary/60 p-6 sm:p-8 border-b border-border flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-3xl shadow-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-accent ring-2 ring-white"></span>
          </div>

          <div className="space-y-1 text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-2xl font-bold text-foreground">{userName}</h2>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-accent/10 text-accent border border-accent/20">
                Primary Account Holder
              </span>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              Patient Identification Hash: <code className="text-foreground bg-background px-2 py-0.5 rounded border border-border">{session.patientId || "P-9000000001"}</code>
            </p>
            <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" /> EHR Record Encryption: AES-256 Enabled
            </p>
          </div>
        </div>

        {/* Details Form Grid */}
        <div className="p-6 sm:p-8 space-y-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-4">Personal Demographics</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-accent" /> Full Name
                </label>
                <div className="h-11 px-3.5 flex items-center bg-input border border-border rounded-lg text-foreground text-sm font-semibold">
                  {userName}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-accent" /> Primary Phone
                </label>
                <div className="h-11 px-3.5 flex items-center bg-input border border-border rounded-lg text-foreground text-sm font-semibold">
                  +91 9000000001
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-accent" /> Date of Birth
                </label>
                <div className="h-11 px-3.5 flex items-center bg-input border border-border rounded-lg text-foreground text-sm font-semibold">
                  January 15, 1992 (34 Yrs)
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-destructive" /> Blood Type & Allergies
                </label>
                <div className="h-11 px-3.5 flex items-center justify-between bg-input border border-border rounded-lg text-foreground text-sm font-semibold">
                  <span>O Positive (O+)</span>
                  <span className="text-xs text-muted-foreground font-normal">No Known Drug Allergies</span>
                </div>
              </div>

            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent mb-4">Contact & Location</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-accent" /> Email Address
                </label>
                <div className="h-11 px-3.5 flex items-center bg-input border border-border rounded-lg text-foreground text-sm font-semibold">
                  patient.demo@vaidhya.health
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-accent" /> Registered Health Node
                </label>
                <div className="h-11 px-3.5 flex items-center bg-input border border-border rounded-lg text-foreground text-sm font-semibold">
                  Primary Clinic Node #4 (Kochi, KL)
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-6 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Logged in as Patient Portal Session</p>
            <form action={async () => {
              "use server";
              const { logout } = await import("@/app/(patient)/login/actions");
              await logout();
            }}>
              <button 
                type="submit" 
                className="px-5 h-10 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 font-bold text-xs hover:bg-destructive hover:text-white transition-all flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out Account</span>
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
