# Vaidhya integration decision log

## Scope

This workspace is the implementation target. It begins as a preserved copy of
`Vaidhya_IES`; the archived experiments remain unchanged and are used only as
working references. Existing routes, visible text, portal features, pharmacy
flow, analytics, WebRTC, and database work are retained.

## Evidence reviewed

- `Archive/Vaidhya_Exps/Offline_chatbot` contains a state-first intake loop:
  separate clinical fact extraction and question generation, compact context,
  allowlisted slots, and deterministic required fields.
- `Archive/Vaidhya_Exps/MQTT_chat` stores room history and an outbox locally,
  and includes connection, reconnect, and delivery concepts.
- The original IES UI already makes nurse vital entry the first patient action,
  then starts the voice chatbot, creates a report, routes it to a doctor, and
  contains a prescription/pharmacy path.

## Decision: retain IES as the application shell

Copying the entire MQTT or chatbot experiment as a second application would
duplicate frontend routing, backend processes, and user sessions. IES is the
only project that already combines patient, doctor, prescription, pharmacy,
analytics, WebRTC, edge AI, and database code. Therefore it remains the sole
application; experiment code is integrated only where it improves behaviour.

## Decision: use state-first intake

The previous IES intake asked one model call to read the complete transcript,
interpret vitals, choose an action, choose a question, optionally request an
exam, and decide completion. That makes a small local model responsible for
too many decisions and can lead to repetition or malformed output.

The implemented flow stores the full transcript for clinical reporting, but
uses a compact `clinical_state` as model context on normal patient turns:

1. Extract facts from the current utterance into allowlisted fields.
2. Identify the next missing required field: complaint, onset, severity, or
   history.
3. Generate exactly one patient-friendly question for that field.
4. Complete the intake after all required fields are recorded.

Vitals, fired urgency flags, and nurse findings are retained in the compact
state. Speech-to-text, translation, text-to-speech, SQLite session recovery,
typed fallback, report generation, and doctor-question handling remain IES
features.

## Decision: MQTT is transport; visit history is storage

QoS 1 can deliver an event at least once, but it is not a patient record and
React state disappears on refresh. The implementation stores doctor questions
and patient answers in local edge SQLite (`consult_messages`) before relying on
live delivery. The doctor consult page restores its local browser copy
immediately, then reconciles it with the edge endpoint. Message IDs prevent
duplicates from combining MQTT, refresh, and server recovery.

Doctor-originated questions also enter a browser outbox before publishing. The
outbox is retried when the MQTT client reconnects and is cleared only after the
broker accepts the QoS-1 publish callback. History remains separate from the
outbox, so an already delivered question remains visible in the visit timeline.

## Decision: persistent MQTT endpoints

The doctor browser was already configured with a stable client ID and persistent
session. The edge client instead used a random client ID and a clean session,
which defeats broker-side reconnection recovery. It now uses a stable edge ID
and `clean_session=False`, matching the intended QoS-1 behaviour. A real broker
URL, credentials, and two-machine test are still required before claiming
cross-device delivery is proven.

## Expected clinical flow

1. Nurse enters baseline vitals.
2. Edge rules calculate urgency and start the patient chatbot.
3. Chatbot gathers structured clinical history and creates the doctor report.
4. The report enters the doctor queue.
5. The doctor asks a follow-up question through MQTT.
6. Edge translates/voices it through the patient chatbot.
7. The patient answer returns to the doctor and both sides retain the timeline.
8. The doctor issues a prescription; the existing patient prescription and
   pharmacy flows display it.

## Verification to perform

- Python compile checks for modified backend files.
- Type/build checks once workspace dependencies are installed.
- Manual typed patient journey using a local model or provider.
- Restart the edge service mid-visit and verify state and timeline restore.
- Refresh doctor consult page and verify messages restore.
- Test a real configured broker from two devices, including a disconnect and
  reconnect while a doctor question is pending.
