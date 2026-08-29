import React from "react";
import { PrescriptionView } from "@/components/PrescriptionView";

export const dynamic = "force-dynamic";

export default async function DynamicPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrescriptionView initialPrescriptionId={id || "rx_seed_001"} />;
}
