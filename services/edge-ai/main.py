"""
Project Vaidhya — edge-ai service (T1 lane).

    uvicorn main:app --reload --port 8000

/health works right now. Everything else answers 501 with the task number that
owns it, so T2 can wire the real client against a live port on day one and see
exactly what is still missing.

T1 tests with curl and requests.http. T1 never opens a browser.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import get_settings
from contracts import (
    ConsultAskRequest,
    HealthResponse,
    IntakeCompleteRequest,
    ModelOption,
    ModelsResponse,
    SessionStartRequest,
    SessionState,
    SetModelRequest,
    VitalsRequest,
    VitalsResponse,
    VoiceTurnTextRequest,
)
from voicebot.session import as_contract, resolve_pending, store

settings = get_settings()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("edge-ai")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """
    Two long-lived things start here and nowhere else: the MQTT connection and
    the outbox drain. Both are designed to be started unconditionally — with no
    broker and no Supabase they degrade to local logging rather than failing,
    so the offline demo path takes no special casing.
    """
    from mqtt_client import mqtt
    from sync.worker import sync_loop

    mqtt.connect(asyncio.get_running_loop())
    task = asyncio.create_task(sync_loop())

    yield

    task.cancel()
    mqtt.stop()


app = FastAPI(title="Vaidhya edge-ai", version="0.1.0", lifespan=lifespan)

@app.get("/")
async def root():
    return {"status": "ok", "service": "vaidhya-edge-ai"}


# The patient browser is on the same laptop, on :3000.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TTS writes mp3s here; the browser plays them straight from /audio/<name>.mp3.
audio_dir = Path(settings.audio_dir)
audio_dir.mkdir(exist_ok=True)
app.mount("/audio", StaticFiles(directory=audio_dir), name="audio")


def not_implemented(task: str) -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={"error": "not_implemented", "owner": "T1", "task": task},
    )


# ---------------------------------------------------------------------------
# GET/POST /settings/model — runtime model selection.
#
# The tiny local model is the whole offline story, but it is not reliably
# instruction-following (verified: the same conversation, run twice,
# produced different turn counts). This lets a nurse pick a bigger model —
# a larger LM Studio download, or Groq directly — for the rest of the
# session, no restart. Options are queried live rather than hardcoded, so
# the list only ever shows what is actually reachable right now.
# ---------------------------------------------------------------------------


@app.get("/settings/models", response_model=ModelsResponse)
async def list_models():
    import httpx

    from model_settings import get_active

    settings = get_settings()
    available: list[ModelOption] = []

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.edge_llm_url}/models")
            if resp.status_code == 200:
                for m in resp.json().get("data", []):
                    available.append(
                        ModelOption(id=m["id"], provider="lmstudio", label=f"{m['id']} (local)")
                    )
    except Exception:
        logger.info("settings/models: LM Studio unreachable, omitting local models")

    if settings.groq_api_key:
        try:
            from groq import AsyncGroq

            groq_client = AsyncGroq(api_key=settings.groq_api_key)
            resp = await groq_client.models.list()
            for m in resp.data:
                # The same account lists Whisper/TTS models too — not chat models.
                if "whisper" in m.id or "tts" in m.id or "guard" in m.id:
                    continue
                available.append(ModelOption(id=m.id, provider="groq", label=f"{m.id} (cloud)"))
        except Exception:
            logger.info("settings/models: Groq model list unreachable, omitting cloud models")

    active = get_active()
    return ModelsResponse(current=active.model, provider=active.provider, available=available)


@app.post("/settings/model")
async def set_model(req: SetModelRequest):
    from model_settings import set_active

    set_active(req.provider, req.model)
    logger.info("settings/model: switched to %s (%s)", req.model, req.provider)
    return {"ok": True, "current": req.model, "provider": req.provider}


# ---------------------------------------------------------------------------
# GET /health — build this first; T2 needs the port live.
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    from providers import get_llm, get_stt, get_translate, get_tts
    from mqtt_client import mqtt

    async def probe(fn) -> str:
        try:
            return "ok" if await fn() else "down"
        except Exception:
            return "down"

    return HealthResponse(
        llm=await probe(get_llm().healthy),
        stt=await probe(get_stt().healthy),
        tts=await probe(get_tts().healthy),
        translate=await probe(get_translate().healthy),
        mqtt="ok" if mqtt.healthy() else "down",
    )


# ---------------------------------------------------------------------------
# Seam A
# ---------------------------------------------------------------------------


@app.post("/session/start")
async def session_start(req: SessionStartRequest):
    try:
        from voicebot.session import Session, store
        from providers.tts import get_tts
        from providers.translate import get_translate
        
        # Reuse an in-flight session rather than replacing it. The nurse's Pass One
        # vitals — and the urgency flags they fired — arrive before this call, and
        # constructing a fresh Session here silently discarded them, which is how a
        # 2-flag visit came out routine.
        session = store.get(req.visit_id)
        if session is None:
            session = Session(visit_id=req.visit_id, patient_id=req.patient_id, language=req.language)
        else:
            session.patient_id = req.patient_id or session.patient_id
            session.language = req.language
    
        store.put(session)
    
        # The visit row is written locally first — it is the parent of every reading
        # and report the outbox will later push, so it has to exist offline too.
        from sync.worker import record_visit
    
        record_visit(session)
    
    
        greeting_en = "Hello, I am Vaidhya. How can I help you today?"
        translate = get_translate()
        bot_text_native = await translate.to_native(greeting_en, req.language)
        tts = get_tts()
        audio_url = await tts.speak(bot_text_native, req.language)
        return {
            "session_id": session.visit_id,
            "greeting_text_en": greeting_en,
            "greeting_text_native": bot_text_native,
            "greeting_audio_url": audio_url,
            "bot_text_en": greeting_en,
            "bot_text_native": bot_text_native,
            "bot_audio_url": audio_url,
        }
    except Exception:
        logger.error("/session/start failed", exc_info=True)
        return {
            "session_id": req.visit_id,
            "greeting_text_en": "Hello, I am Vaidhya. How can I help you today?",
            "greeting_text_native": "Hello, I am Vaidhya. How can I help you today?",
            "greeting_audio_url": "",
            "bot_text_en": "Hello, I am Vaidhya. How can I help you today?",
            "bot_text_native": "Hello, I am Vaidhya. How can I help you today?",
            "bot_audio_url": "",
        }


@app.post("/vitals", response_model=VitalsResponse)
async def vitals(req: VitalsRequest):
    """
    Pass One baseline AND the nurse answering an on-demand finding — one
    endpoint, told apart by phase. Firing the rules here is what makes the
    report come out Urgent instead of routine.
    """
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
        session = store.get(visit_id)
        if not session:
            return JSONResponse(status_code=404, content={"error": "session not found"})
            
        resolve_pending(session)
        
        from voicebot.orchestrator import run_turn
        audio_bytes = await audio.read()
        response = await run_turn(session, audio_bytes)
    
        # If the doctor was waiting on this turn, their answer goes back over MQTT.
        # answer_doctor() clears the question, so the patient is not re-asked it.
        from consult import answer_doctor
    
        answer_doctor(session, response.transcript_en)
    
        store.put(session)
        return response
    except Exception:
        logger.error("/voice/turn failed", exc_info=True)
        from contracts import TurnResponse
        return TurnResponse(
            transcript_native="",
            transcript_en="",
            bot_text_en="I'm sorry, I encountered a technical issue. Please try again.",
            bot_text_native="I'm sorry, I encountered a technical issue. Please try again.",
            bot_audio_url="",
            next_action="ask_question",
            pending_finding=None,
            intake_done=False
        )


@app.post("/voice/turn/text")
async def voice_turn_text(req: VoiceTurnTextRequest):
    """The typed-answer fallback — same turn loop as /voice/turn, minus STT."""
    try:
        session = store.get(req.visit_id)
        if not session:
            return JSONResponse(status_code=404, content={"error": "session not found"})
    
        resolve_pending(session)
    
        from voicebot.orchestrator import run_text_turn
    
        response = await run_text_turn(session, req.text_en)
    
        from consult import answer_doctor
    
        answer_doctor(session, response.transcript_en)
    
        store.put(session)
        return response
    except Exception:
        logger.error("/voice/turn/text failed", exc_info=True)
        from contracts import TurnResponse
        return TurnResponse(
            transcript_native="",
            transcript_en="",
            bot_text_en="I'm sorry, I encountered a technical issue. Please try again.",
            bot_text_native="I'm sorry, I encountered a technical issue. Please try again.",
            bot_audio_url="",
            next_action="ask_question",
            pending_finding=None,
            intake_done=False
        )


@app.get("/session/{visit_id}/state", response_model=SessionState)
async def session_state(visit_id: str):
    """
    The nurse-finding state machine is evaluated here, lazily, from timestamps.
    No background timers anywhere in this service.
    """
    session = store.get(visit_id)
    if session is None:
        return SessionState(visit_id=visit_id, phase="pass_one", pending_finding=None, turn_count=0)

    resolve_pending(session)
    store.put(session)

    return SessionState(
        visit_id=visit_id,
        phase=session.phase,
        pending_finding=as_contract(session.pending_finding),
        turn_count=session.turn_count,
        doctor_question=session.doctor_question,
    )


@app.post("/intake/complete")
async def intake_complete(req: IntakeCompleteRequest):
    try:
        session = store.get(req.visit_id)
        if not session:
            # `store` is imported at module scope. Importing it here would make
            # Python treat it as a local variable throughout this function,
            # causing the lookup above to fail before the fallback is reached.
            from voicebot.session import Session
            session = Session(visit_id=req.visit_id, patient_id="", language="en")
            store.put(session)
            
        from report.builder import build_and_publish
        return await build_and_publish(session)
    except Exception as e:
        logger.error("/intake/complete failed", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/consult/{visit_id}/answers")
async def consult_answers(visit_id: str):
    """Test convenience only. Polled by doctor UI when MQTT is offline."""
    session = store.get(visit_id)
    if not session:
        return {"answers": []}
    
    answers = []
    for i, t in enumerate(session.turns):
        if t.speaker == "patient_to_doctor":
            answers.append({
                "message_id": f"fallback_{i}",
                "sender": "patient_voicebot",
                "text": t.text_en,
                "timestamp": str(t.timestamp)
            })
    return {"answers": answers}


@app.get("/consult/{visit_id}/messages")
async def consult_messages(visit_id: str):
    """Durable consultation timeline for reopening a visit after a refresh."""
    from consult_history import list_for_visit
    return {"messages": list_for_visit(visit_id)}


@app.post("/consult/ask")
async def consult_ask(req: ConsultAskRequest):
    """TEST CONVENIENCE ONLY. The real path is MQTT — this lets T1 exercise the
    consult relay without a broker, and is the fallback if HiveMQ is blocked at
    the venue and both nodes end up on one laptop."""
    session = store.get(req.visit_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "session not found"})

    from consult import ask_patient

    question = await ask_patient(session, req.question_en)
    return question


@app.get("/sync/status")
async def sync_status():
    """How many local writes have not reached Supabase. This is the number to
    put on screen when the wifi comes back."""
    from sync.worker import status

    return status()


@app.post("/sync/flush")
async def sync_flush():
    """Drain the outbox now instead of waiting for the next tick."""
    from sync.worker import flush_outbox

    return await flush_outbox()
