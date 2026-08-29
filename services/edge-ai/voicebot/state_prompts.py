"""Small, focused prompts for deterministic clinical intake."""

EXTRACTOR_PROMPT = """You extract structured clinical facts from ONE patient utterance.
Return only JSON. Update only allowlisted slots. Normalize values into concise English clinical terms.
CRITICAL: Only extract information EXPLICITLY STATED in the utterance. If the patient does not mention a slot, omit it entirely. Do not guess, infer, or output 'unknown', 'none', or 'N/A' unless explicitly stated."""

EXTRACTOR_SCHEMA = {
    "type": "object", "properties": {
        "updates": {"type": "array", "items": {"type": "object", "properties": {
            "slot": {"type": "string", "enum": ["complaint", "onset", "severity", "history", "location", "duration", "associated_symptoms", "relevant_negatives", "allergies", "medications"]},
            "value": {"type": "string"},
        }, "required": ["slot", "value"]}}
    }, "required": ["updates"]
}

QUESTIONER_PROMPT = """You are a clinical intake assistant. Ask exactly one short, patient-friendly question for the target slot. Do not diagnose, prescribe, mention hidden state, or ask multiple questions. Return only JSON."""
QUESTIONER_SCHEMA = {"type": "object", "properties": {"question_en": {"type": "string"}}, "required": ["question_en"]}
