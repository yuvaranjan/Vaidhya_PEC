import os
from graph import app
from dotenv import load_dotenv

# Load environment variables (ensure OPENAI_API_KEY is set in a .env file)
load_dotenv()

def run_consult(real_patient_data_from_portal: str):
    """
    Runs the multi-agent specialist system.
    Strictly takes REAL patient data from the portal. NO mock data allowed.
    """
    initial_state = {
        "patient_raw_data": real_patient_data_from_portal,
        "messages": [],
        "revision_count": 0,
        "cmo_rejection_reasons": [],
        "cmo_approved": False
    }
    
    print("--- STARTING MULTI-AGENT SPECIALIST CONSULT ---")
    
    # Run the graph
    result = app.invoke(initial_state)
    
    print("\n[🩺 DIAGNOSTICIAN ASSESSMENT]")
    print(result.get("proposed_diagnoses"))
    
    print("\n[💊 TREATMENT PLANNER]")
    print(result.get("proposed_treatment_plan"))
    
    print("\n[⚖️ CHIEF MEDICAL OFFICER (CMO) REVIEW]")
    print(f"CMO Approved: {result.get('cmo_approved')}")
    if result.get("cmo_rejection_reasons"):
        print("CMO Rejection Reasons / Hallucinations Detected:")
        for err in result.get("cmo_rejection_reasons"):
            print(f" - {err}")
            
    print(f"\nRevisions required: {result.get('revision_count')}")
    
    if not result.get('cmo_approved'):
        print("\nWARNING: The final output failed the CMO's strict hallucination check and MUST be reviewed by a human doctor.")
    else:
        print("\nSUCCESS: The diagnosis and treatment plan are 100% approved by the CMO and grounded in the raw patient data.")

if __name__ == "__main__":
    # INSTRUCTIONS:
    # 1. Connect this to your Doctor Portal database.
    # 2. Fetch a REAL patient case text.
    # 3. Pass it to run_consult().
    
    print("System is ready. Wire this up to your portal to pass real patient strings into `run_consult()`.")
