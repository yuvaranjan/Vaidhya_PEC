import re

path = r"D:\Personal_Projects\Vaidhya_PEC\services\edge-ai\main.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

bad_chunk = '''@app.post("/vitals", response_model=VitalsResponse)
async def vitals(req: VitalsRequest):
        session = store.get(visit_id)'''

good_chunk = '''@app.post("/vitals", response_model=VitalsResponse)
async def vitals(req: VitalsRequest):
    \"\"\"
    Pass One baseline AND the nurse answering an on-demand finding — one
    endpoint, told apart by phase. Firing the rules here is what makes the
    report come out Urgent instead of routine.
    \"\"\"
    session = store.get(req.visit_id)
    if session is None:
        # Pass One usually lands before the consult screen has run
        # /session/start, so open the visit here rather than reject the
        # nurse's readings. Language is provisional and gets corrected the
        # moment the nurse picks one.
        from sync.worker import record_visit
        from voicebot.session import Session

        session = Session(
            visit_id=req.visit_id,
            patient_id=req.patient_id or "",
            language=req.language or "ml",
        )
        store.put(session)
        if session.patient_id:
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
    return VitalsResponse(ok=True, fired_flags=fired)


@app.post("/voice/turn")
async def voice_turn(visit_id: str = Form(...), audio: UploadFile = File(...)):
    try:
        session = store.get(visit_id)'''

content = content.replace(bad_chunk, good_chunk)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
