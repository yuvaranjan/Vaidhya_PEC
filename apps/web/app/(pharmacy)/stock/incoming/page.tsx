import { PharmacistPortal } from "@/components/PharmacistPortal";

export const dynamic = "force-dynamic";

export default function PharmacyIncomingQueuePage() {
  return <PharmacistPortal initialTab="queue" />;
}
