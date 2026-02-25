from fastapi import APIRouter

from ..services import cdisc_terminology

router = APIRouter()


@router.get("/phases")
def get_phases():
    return cdisc_terminology.get_phases()


@router.get("/study-types")
def get_study_types():
    return cdisc_terminology.get_study_types()


@router.get("/epoch-types")
def get_epoch_types():
    return cdisc_terminology.get_epoch_types()


@router.get("/arm-types")
def get_arm_types():
    return cdisc_terminology.get_arm_types()


@router.get("/intervention-models")
def get_intervention_models():
    return cdisc_terminology.get_intervention_models()


@router.get("/blinding-schemas")
def get_blinding_schemas():
    return cdisc_terminology.get_blinding_schemas()


@router.get("/sdtm-domains")
def get_sdtm_domains():
    return cdisc_terminology.get_sdtm_domains()


@router.get("/sdtm-domains/oncology")
def get_oncology_sdtm_domains():
    return cdisc_terminology.get_oncology_domains()


@router.get("/response-criteria")
def get_response_criteria():
    return cdisc_terminology.get_response_criteria()


@router.get("/activity-catalog")
def get_activity_catalog():
    """CDISC-sourced activity catalog for Schedule of Activities."""
    return cdisc_terminology.get_activity_catalog()


@router.get("/procedure-library")
def get_procedure_library():
    """Curated procedure library organized by therapeutic area."""
    return cdisc_terminology.get_procedure_library()


@router.get("/procedure-burden")
def get_procedure_burden():
    """Procedure burden metrics (time, cost, blood volume, RVU) per procedure."""
    return cdisc_terminology.get_procedure_burden()


@router.get("/soa-hierarchy")
def get_soa_hierarchy():
    """SOA hierarchy definitions — groups, subgroups, and auto-assignment rules."""
    return cdisc_terminology.get_soa_hierarchy()
