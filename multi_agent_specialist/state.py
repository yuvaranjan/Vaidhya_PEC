from typing import TypedDict, Annotated, List, Optional
from langchain_core.messages import BaseMessage
import operator

class PatientConsultState(TypedDict):
    """
    The shared state for the multi-agent medical consult system.
    """
    # Original raw data from the doctor portal (MUST be the only source of truth)
    patient_raw_data: str
    
    # Message history
    messages: Annotated[List[BaseMessage], operator.add]
    
    # Diagnostician Output
    proposed_diagnoses: Optional[str]
    
    # Treatment Planner Output
    proposed_treatment_plan: Optional[str]
    
    # Chief Medical Officer (CMO) Review Results
    cmo_approved: bool
    cmo_rejection_reasons: List[str]
    
    # Iteration counter to prevent infinite loops when revising
    revision_count: int
