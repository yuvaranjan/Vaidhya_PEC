from langgraph.graph import StateGraph, END
from state import PatientConsultState
from nodes import diagnostician_node, treatment_planner_node, cmo_node

def route_cmo_review(state: PatientConsultState):
    """Routing function from CMO."""
    if state.get("cmo_approved", False):
        return END
    
    # Safety mechanism to prevent infinite loops (max 3 revisions)
    if state.get("revision_count", 0) >= 3:
        return END
        
    return "diagnostician"

# ---------------------------------------------------------
# Graph Construction
# ---------------------------------------------------------
workflow = StateGraph(PatientConsultState)

# Add nodes
workflow.add_node("diagnostician", diagnostician_node)
workflow.add_node("treatment_planner", treatment_planner_node)
workflow.add_node("cmo", cmo_node)

# Add edges
workflow.set_entry_point("diagnostician")
workflow.add_edge("diagnostician", "treatment_planner")
workflow.add_edge("treatment_planner", "cmo")

# Conditional routing from the CMO
workflow.add_conditional_edges(
    "cmo",
    route_cmo_review,
    {
        END: END,
        "diagnostician": "diagnostician"
    }
)

# Compile the graph
app = workflow.compile()
