import re

path = r"D:\Personal_Projects\Vaidhya_PEC\services\edge-ai\main.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# The bad tool removed from if session.patient_id: down to store.put(session).
# Currently it looks like:
#         store.put(session)
#     store.put(session)
#     return VitalsResponse(ok=True, fired_flags=fired)

# Let's just find store.put(session) inside vitals and replace it with the correct block.

original_block = '''        if session.patient_id:
            record_visit(session)

    from vitals_store import record_vitals

    if req.phase == "pass_one_baseline":
        # If the nurse is submitting baseline vitals, this is the start of a fresh triage.
        # Clear any existing conversation history in case the user is reusing the same visit_id.
        session.turns = []
        session.phase = "pass_one"
        session.pending_finding = None
        session.doctor_question = None
        session.vitals = []
        session.fired_flags = []
        session.branch_tags = []
        session.clinical_state = {}

    fired = record_vitals(session, req)

    if req.phase == "on_demand":
        resolve_pending(session)

    store.put(session)
    return VitalsResponse(ok=True, fired_flags=fired)'''

# I'll just restore the whole def vitals function to be safe.
