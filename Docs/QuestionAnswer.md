# Project Vaidhya: Comprehensive Questions & Answers

This document compiles the complete set of verified questions and spec-aligned answers for the Project Vaidhya offline-first AI telemedicine platform.

---

### Q1. Your urgency tag is based on flag count, not severity. Show me a case where a mildly-fever patient outranks a low-SpO2 patient in your queue. Isn't your tag actively wrong in that case?
**Answer:** You're right, and that's a real limitation we're upfront about[cite: 3]. Our tiering is deliberately simple — count-based, not severity-weighted — because we scoped it as a transparent, auditable presentation layer on top of existing branching logic, not a validated clinical scoring model[cite: 2, 3]. A patient with fever + slightly elevated pulse could show the same "Urgent" tag as a patient with critical SpO2 and one other flag[cite: 3]. That's a real gap[cite: 3]. The mitigation is that the tag never gates doctor access — a doctor can open any patient's full report regardless of tag, and the tag is explicitly framed as "informs, doesn't decide"[cite: 2, 3]. But we're not claiming this is clinically validated triage, and we wouldn't want a doctor treating it as such[cite: 3]. Post-hackathon, the fix is per-vital severity weighting instead of flat counting[cite: 3].

---

### Q2. If your system labels a patient 'Urgent' and every doctor is busy, what actually happens to that patient?
**Answer:** Honestly — right now, nothing beyond the visible tag[cite: 3]. The patient stays in the queue with an Urgent label until a doctor picks them up[cite: 2, 3]. There's no forced escalation, no ambulance dispatch trigger, no automatic notification if wait time exceeds a threshold[cite: 3]. This is the most important gap in our current scope, and we'd rather say that plainly than imply otherwise[cite: 3]. In a production version, an Urgent tag sitting unclaimed past a time threshold should trigger an active alert to all available doctors, not just a passive tag[cite: 3]. For this build, the nurse on-site remains the real safety net — she's physically present and would escalate through normal emergency channels if the patient deteriorates, independent of what our software shows[cite: 3].

---

### Q3. A nurse performs an abdominal palpation your bot requested. What clinical training do you assume that nurse has, and what happens if she gets it wrong?
**Answer:** We assume the baseline clinical training of a staff nurse or trained community health worker already present at these centers — this isn't asking an untrained layperson to do it[cite: 3]. But you're right that we don't validate her finding against anything; it's trusted at face value and can shift both the question branching and the urgency tier[cite: 2, 3]. If she misjudges tenderness or misreports a finding, the system has no way to catch that — it propagates the input as ground truth[cite: 3]. That's a real limitation of any system relying on remote/assisted exam input, not unique to us, but we don't currently soften it with any confidence check on the nurse's side[cite: 3].

---

### Q4. You call this platform offline-first, but your flagship AI decision-support feature requires a cloud LLM. Which is it?
**Answer:** Both, at different layers, and we should be clearer about that distinction[cite: 3]. The core patient-facing path — voicebot intake, vitals capture, diagnostic summary generation, and the MQTT-text consultation itself — is genuinely offline-capable, running on local inference[cite: 2, 3]. The Specialist AI advisory is an optional, doctor-triggered add-on layered on top of that core flow, and it does require connectivity because it's a cloud LLM call[cite: 2, 3]. If a doctor is offline, they can still review the full diagnostic report and issue a prescription without the specialist opinion — it's additive, not load-bearing[cite: 3]. So the platform doesn't stop working offline; one advisory feature becomes unavailable[cite: 3].

---

### Q5. Your jurisdiction-based doctor queue routing is a real feature in your data model, but your demo-scope note says seed data might just flatten it into one shared queue. Are we watching a real feature tonight, or a schema that isn't wired up to the demo?
**Answer:** Fair to call that out directly — for tonight's demo, we're using flattened seed data (every demo doctor assigned to every demo jurisdiction) so the queue is easy to showcase live without needing multiple simulated villages[cite: 2, 3]. The filtering logic itself is real and implemented — `Visit.edge_jurisdiction_id` against `Doctor.serves_jurisdiction_ids` — but we chose demo data that doesn't exercise the filter, purely for demo clarity[cite: 2, 3]. If you want, we can reconfigure the seed data live to show two doctors with non-overlapping jurisdictions and prove the filtering actually works[cite: 3].

---

### Q6. Walk me through what's actually encrypted between the patient's MQTT client and the doctor's — not at rest, in transit, right now.
**Answer:** This is a genuine gap in the current build[cite: 3]. We haven't implemented TLS on the MQTT broker or payload-level encryption for the demo — the priority was getting the reconnect/dedup/queueing logic working correctly first[cite: 3]. In production this is non-negotiable: TLS on the broker connection at minimum, likely payload encryption given the clinical content, plus per-`consultation_id` topic authorization so only the paired patient and doctor can publish/subscribe to that channel[cite: 3]. Right now, that authorization and encryption layer doesn't exist — the topic namespace by `consultation_id` gives structural isolation, but nothing enforces it against a malicious actor with broker access[cite: 2, 3].

---

### Q7. Any random person with a phone number can apparently register as a doctor and issue a prescription. What stops that?
**Answer:** Nothing, in the current build — that's accurate and we won't pretend otherwise[cite: 3]. Doctor accounts are phone + password with no credentialing step[cite: 2, 3]. In a real deployment this is mandatory: license number verification against a medical council registry (India has the National Medical Register) before an account can issue prescriptions, likely with a manual or API-based verification step before activation[cite: 3]. For the hackathon, we treated doctor accounts as pre-vetted/seeded rather than building live credential verification, because that's a compliance integration, not a core product mechanic we could meaningfully demo in the time we had[cite: 3].

---

### Q8. A nurse takes a webcam photo of a patient's rash. Where does the patient consent to that?
**Answer:** There isn't an explicit consent step in the current flow — the voicebot instructs the nurse, the nurse captures[cite: 2, 3]. That's a real gap, especially given the sensitivity of some visual symptom locations[cite: 3]. The fix is straightforward and we should have included it: before the nurse captures, the voicebot should verbally confirm with the patient that a photo will be taken and briefly stored as part of their diagnostic report, and proceed only on a verbal yes[cite: 3]. We didn't build that confirmation step for the demo, and we should say so rather than imply it's there[cite: 3].

---

### Q9. Two family members share a phone. Your reconciliation logic merges records by phone number. What stops their histories from merging?
**Answer:** Nothing currently — this is a real identity-collision risk we hadn't fully accounted for, and it's a known pattern in the context we're designing for, not a rare edge case[cite: 3]. Right now reconciliation matches on ABHA ID or phone number, and ABHA ID is the safer of the two since it's meant to be a unique individual health ID[cite: 2, 3]. The honest fix is to weight ABHA ID as the primary/required match key and treat phone-number-only matching as provisional — flagged for manual confirmation (e.g., "is this the same person as this phone's prior visit? y/n") rather than auto-merged[cite: 3]. We haven't implemented that safeguard yet[cite: 3].

---

### Q10. Your own document says this is a multi-week build compressed into 20 hours, and you haven't decided what to cut. What, specifically, is not going to work tonight?
**Answer:** We flagged this ourselves before you could, which is deliberate — we'd rather tell you now than have you discover it live[cite: 3]. Realistically, here's where we expect thinness: full MQTT reconnect/dedup logic may be simplified to reconnect-only without message deduplication, we are likely building 1–2 specialist prompts fully rather than all 4, and the public health dashboard's anomaly highlighting is precomputed against seed data rather than live computation[cite: 3]. Everything else — core voicebot intake, the three portals, and prescription-to-pharmacy routing — is our committed critical path and will work end to end[cite: 2, 3].

---

### Q11. Rural India already has ASHA workers, 108 ambulance services, and government telemedicine (eSanjeevani). Why would a village health center choose Vaidhya over what already exists and is government-funded?
**Answer:** Existing platforms like eSanjeevani require continuous, high-speed internet to stream live video, which fails in rural centers during patchy connectivity[cite: 1]. Vaidhya addresses this specific gap through a two-tier edge server topology that stores clinical data locally with zero internet dependency[cite: 2]. Its flagship consultation mode uses lightweight MQTT text with automated pause/resume handling during drops, allowing consults to proceed even when live video or voice connections are completely impossible[cite: 1, 2].

---

### Q12. Who pays for this? Is the village health center buying edge hardware, is this a government contract, is this a subscription per pharmacy/doctor?
**Answer:** The architecture spec focuses on technical implementation, so business and deployment models are kept out of scope[cite: 2]. In a real-world deployment, Vaidhya is designed as a Business-to-Government (B2G) software/hardware model integrated into existing public health initiatives (such as Ayushman Bharat Digital Mission) servicing Primary Health Centres (PHCs)[cite: 1, 2].

---

### Q13. You need a doctor to actually staff this and be available. What's your evidence doctors will opt into a jurisdiction-assignment model like this rather than just working at existing hospitals?
**Answer:** Doctors are not locked into single physical villages; they are assigned one or more rural catchment areas via `serves_jurisdiction_ids`[cite: 2]. The platform supports flexible asynchronous or queue-based triage, allowing city-based doctors to review pre-compiled diagnostic summaries and handle consultations on demand or during designated shift windows without disrupting hospital workflows[cite: 2].

---

### Q14. Your voicebot runs on Ollama locally. What model, what's the actual quality of its medical reasoning versus a cloud model, and have you tested it hallucinating a wrong follow-up question on a real transcript?
**Answer:** The platform spec keeps tech stack and specific LLM providers intentionally agnostic[cite: 2]. To prevent AI hallucinations during clinical intake, the voicebot does not rely on open-ended LLM reasoning alone; it operates against a structured, deterministic rules table (`BranchingRule`) that explicitly governs question depth and priority based on verified vitals[cite: 2]. Final clinical decisions remain strictly in the hands of the human doctor[cite: 1, 2].

---

### Q15. Your rules table uses simple comparison operators, no expression language. What happens with a rule that needs to combine two conditions — like 'fever AND low SpO2 together' — that your current schema can't express?
**Answer:** That is a real schema limitation in the current spec. Section 7.6 defines `condition` as a single comparison-operator + value pair evaluated against a single vital or finding field[cite: 2]. Under the current design, evaluating composite conditions (e.g., `fever AND low_spO2`) requires adding multi-condition logic or group-rule definitions to the `BranchingRule` schema[cite: 2].