import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/web/.env.local' });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  // 1. Insert a visit
  const visitId = "test_visit_123";
  const doctorId = "doc_001";
  
  console.log("Inserting visit...");
  const { error: insertErr } = await db.from("visits").insert({
    visit_id: visitId,
    patient_id: "pat_001",
    edge_jurisdiction_id: "jur_thrissur_01",
    status: "awaiting_doctor"
  });
  console.log("Insert Error:", insertErr);

  // 2. Claim it
  console.log("Claiming visit...");
  const { data, error } = await db
    .from("visits")
    .update({ status: "in_consult", claimed_by_doctor_id: doctorId })
    .eq("visit_id", visitId)
    .or(`status.eq.awaiting_doctor,claimed_by_doctor_id.is.null,claimed_by_doctor_id.eq.${doctorId}`)
    .select("visit_id");
    
  console.log("Claim Data:", data);
  console.log("Claim Error:", error);
}

test();
