import os
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from typing import List

from state import PatientConsultState

# ---------------------------------------------------------
# Pydantic Schemas for Structured Output
# ---------------------------------------------------------

class DiagnosticianOutput(BaseModel):
    diagnoses: str = Field(description="The proposed differential diagnoses.")
    evidence_from_raw: str = Field(description="Exact quotes from the raw patient data that justify these diagnoses.")
    missing_data: str = Field(description="Any critical information missing that would be needed for a definitive diagnosis.")

class TreatmentPlannerOutput(BaseModel):
    treatment_plan: str = Field(description="The proposed step-by-step treatment plan.")
    rationale: str = Field(description="Why this plan is appropriate, strictly citing the proposed diagnoses and raw patient data.")

class CMOReviewOutput(BaseModel):
    is_approved: bool = Field(description="True ONLY IF the diagnoses and treatment are completely grounded in the raw data, medically sound, and free of any hallucinations.")
    rejection_reasons: List[str] = Field(description="If rejected, list specific hallucinations, missing evidence, or unsafe recommendations. Empty if approved.")

# ---------------------------------------------------------
# LLM Initialization
# ---------------------------------------------------------
def get_llm():
    # Using temperature 0 for deterministic, analytical outputs
    # llama3-70b-8192 was decommissioned by Groq; llama-3.3-70b-versatile is its replacement.
    return ChatGroq(model="llama-3.3-70b-versatile", temperature=0.0)

# ---------------------------------------------------------
# Agent Nodes
# ---------------------------------------------------------

def diagnostician_node(state: PatientConsultState):
    """Diagnostician: Analyzes raw data to propose diagnoses."""
    llm = get_llm().with_structured_output(DiagnosticianOutput)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the Diagnostician. Analyze the patient data and provide differential diagnoses. "
                   "CRITICAL: You must NEVER hallucinate or infer facts not present in the raw data. "
                   "If the data is insufficient for a diagnosis, explicitly state 'INSUFFICIENT DATA'. "
                   "If you were previously rejected by the CMO, address these errors: {cmo_rejections}"),
        ("human", "Raw Patient Data: {raw_data}")
    ])
    
    rejections = ", ".join(state.get("cmo_rejection_reasons", [])) if state.get("cmo_rejection_reasons") else "None."
    chain = prompt | llm
    
    result = chain.invoke({
        "raw_data": state["patient_raw_data"],
        "cmo_rejections": rejections
    })
    
    formatted_diagnosis = f"Diagnoses:\n{result.diagnoses}\n\nEvidence:\n{result.evidence_from_raw}\n\nMissing Data:\n{result.missing_data}"
    
    return {"proposed_diagnoses": formatted_diagnosis}


def treatment_planner_node(state: PatientConsultState):
    """Treatment Planner: Proposes a treatment plan based on the diagnoses and raw data."""
    llm = get_llm().with_structured_output(TreatmentPlannerOutput)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the Treatment Planner. Create a safe, evidence-based treatment plan based ONLY on the Diagnostician's assessment and the raw patient data. "
                   "CRITICAL: You must NEVER invent medications, patient allergies, or lab results. "
                   "If the Diagnostician noted 'INSUFFICIENT DATA', your plan must only be to request that missing data. "
                   "If you were previously rejected by the CMO, address these errors: {cmo_rejections}"),
        ("human", "Raw Patient Data:\n{raw_data}\n\nDiagnostician Assessment:\n{diagnoses}")
    ])
    
    rejections = ", ".join(state.get("cmo_rejection_reasons", [])) if state.get("cmo_rejection_reasons") else "None."
    chain = prompt | llm
    
    result = chain.invoke({
        "raw_data": state["patient_raw_data"],
        "diagnoses": state["proposed_diagnoses"],
        "cmo_rejections": rejections
    })
    
    formatted_plan = f"Treatment Plan:\n{result.treatment_plan}\n\nRationale:\n{result.rationale}"
    
    return {"proposed_treatment_plan": formatted_plan}


def cmo_node(state: PatientConsultState):
    """Chief Medical Officer: Strictly audits diagnoses and treatment plans."""
    llm = get_llm().with_structured_output(CMOReviewOutput)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the Chief Medical Officer (CMO). You are the final safety check. "
                   "Your job is to relentlessly hunt for hallucinations. "
                   "Compare the Diagnostician and Treatment Planner outputs AGAINST THE ORIGINAL RAW PATIENT DATA. "
                   "If they mention a symptom, condition, medication, or demographic not EXPLICITLY present in the raw data, REJECT IT as a hallucination. "
                   "If the treatment contradicts standard medical safety based on the raw data, REJECT IT. "
                   "Only approve if you are 100% confident no hallucinations occurred and the advice is safe."),
        ("human", "ORIGINAL RAW PATIENT DATA:\n{raw_data}\n\nDIAGNOSTICIAN OUTPUT:\n{diagnoses}\n\nTREATMENT PLANNER OUTPUT:\n{treatment}")
    ])
    
    chain = prompt | llm
    result = chain.invoke({
        "raw_data": state["patient_raw_data"],
        "diagnoses": state["proposed_diagnoses"],
        "treatment": state["proposed_treatment_plan"]
    })
    
    # Update revision count
    current_rev = state.get("revision_count", 0) + 1
    
    return {
        "cmo_approved": result.is_approved,
        "cmo_rejection_reasons": result.rejection_reasons,
        "revision_count": current_rev
    }
