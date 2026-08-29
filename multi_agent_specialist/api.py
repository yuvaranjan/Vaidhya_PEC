from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from graph import app as langgraph_app
from dotenv import load_dotenv

# Load environment variables (Groq API Key)
load_dotenv()

app = FastAPI(
    title="Multi-Agent Specialist API",
    description="API for the 3-Agent LangGraph Medical Consult System",
    version="1.0.0"
)

class ConsultRequest(BaseModel):
    patient_data: str

@app.post("/consult")
async def run_consultation(request: ConsultRequest):
    """
    Takes raw patient data and runs it through the Diagnostician, 
    Treatment Planner, and CMO for hallucination-free advice.
    """
    if not request.patient_data.strip():
        raise HTTPException(status_code=400, detail="Patient data cannot be empty.")
        
    initial_state = {
        "patient_raw_data": request.patient_data,
        "messages": [],
        "revision_count": 0,
        "cmo_rejection_reasons": [],
        "cmo_approved": False
    }
    
    try:
        # Run the graph
        result = langgraph_app.invoke(initial_state)
        
        return {
            "status": "success",
            "cmo_approved": result.get("cmo_approved"),
            "diagnoses": result.get("proposed_diagnoses"),
            "treatment_plan": result.get("proposed_treatment_plan"),
            "revisions_required": result.get("revision_count"),
            "cmo_rejection_reasons": result.get("cmo_rejection_reasons", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Running on port 8002 to avoid conflicting with port 8000 (and 8001 which is blocked)
    print("Starting Multi-Agent API on port 8002...")
    uvicorn.run(app, host="0.0.0.0", port=8002)
