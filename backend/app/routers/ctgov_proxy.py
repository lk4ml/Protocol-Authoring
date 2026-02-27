"""
ClinicalTrials.gov Proxy Router
---------------------------------
Proxies requests to ClinicalTrials.gov API v2 through the backend,
avoiding CORS issues and providing more reliable connectivity.

Also provides SOA auto-population from NCT trial data.
"""

import httpx
from fastapi import APIRouter, HTTPException

from ..config import settings
from ..services.soa_mapper import build_suggested_soa

router = APIRouter()

CT_GOV_BASE = settings.CTGOV_BASE_URL


async def _fetch_study_raw(nct_id: str) -> dict:
    """Internal helper to fetch raw study JSON from CT.gov."""
    cleaned = nct_id.strip().upper()
    if not cleaned.startswith("NCT"):
        raise HTTPException(status_code=400, detail="Invalid NCT ID format")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{CT_GOV_BASE}/studies/{cleaned}")

            if resp.status_code == 404:
                raise HTTPException(
                    status_code=404,
                    detail=f"Trial {cleaned} not found on ClinicalTrials.gov",
                )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"ClinicalTrials.gov returned status {resp.status_code}",
                )

            return resp.json()

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="ClinicalTrials.gov request timed out. Please try again.",
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to ClinicalTrials.gov. Please check your internet connection.",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching from ClinicalTrials.gov: {str(e)}",
        )


@router.get("/studies/{nct_id}")
async def fetch_study(nct_id: str):
    """
    Fetch a single study from ClinicalTrials.gov by NCT ID.
    Proxies the request through the backend to avoid browser CORS issues.
    """
    return await _fetch_study_raw(nct_id)


@router.get("/suggest-soa/{nct_id}")
async def suggest_soa_from_nct(nct_id: str):
    """
    Fetch a trial from ClinicalTrials.gov and generate a suggested
    Schedule of Activities (SOA) by mapping trial characteristics
    to the procedure library.

    Returns suggested procedures, visits, and match statistics.
    """
    raw = await _fetch_study_raw(nct_id)

    # Parse the CT.gov response into the format our mapper expects
    proto = raw.get("protocolSection") or {}
    ident = proto.get("identificationModule") or {}
    design = proto.get("designModule") or {}
    arms_module = proto.get("armsInterventionsModule") or {}
    outcomes_module = proto.get("outcomesModule") or {}
    elig_module = proto.get("eligibilityModule") or {}
    desc_module = proto.get("descriptionModule") or {}
    status_module = proto.get("statusModule") or {}
    sponsor_module = proto.get("sponsorCollaboratorsModule") or {}
    conditions_module = proto.get("conditionsModule") or {}

    trial_data = {
        "nctId": nct_id.strip().upper(),
        "briefTitle": ident.get("briefTitle", ""),
        "officialTitle": ident.get("officialTitle", ""),
        "conditions": conditions_module.get("conditions", []),
        "keywords": conditions_module.get("keywords", []),
        "phase": (design.get("phases") or []),
        "studyType": design.get("studyType", ""),
        "numberOfArms": (design.get("designInfo") or {}).get("numberOfArms"),
        "designInfo": design.get("designInfo") or {},
        "arms": [
            {
                "label": a.get("label", ""),
                "type": a.get("type", ""),
                "description": a.get("description", ""),
                "interventionNames": a.get("interventionNames", []),
            }
            for a in (arms_module.get("armGroups") or [])
        ],
        "interventions": [
            {
                "name": i.get("name", ""),
                "type": i.get("type", ""),
                "description": i.get("description", ""),
            }
            for i in (arms_module.get("interventions") or [])
        ],
        "outcomes": {
            "primary": [
                {"measure": o.get("measure", ""), "description": o.get("description", ""), "timeFrame": o.get("timeFrame", "")}
                for o in (outcomes_module.get("primaryOutcomes") or [])
            ],
            "secondary": [
                {"measure": o.get("measure", ""), "description": o.get("description", ""), "timeFrame": o.get("timeFrame", "")}
                for o in (outcomes_module.get("secondaryOutcomes") or [])
            ],
            "other": [
                {"measure": o.get("measure", ""), "description": o.get("description", ""), "timeFrame": o.get("timeFrame", "")}
                for o in (outcomes_module.get("otherOutcomes") or [])
            ],
        },
        "eligibility": {
            "rawText": elig_module.get("eligibilityCriteria", ""),
            "sex": elig_module.get("sex", "All"),
            "minimumAge": elig_module.get("minimumAge", ""),
            "maximumAge": elig_module.get("maximumAge", ""),
        },
        "description": {
            "briefSummary": desc_module.get("briefSummary", ""),
            "detailedDescription": desc_module.get("detailedDescription", ""),
        },
        "sponsorName": (sponsor_module.get("leadSponsor") or {}).get("name", ""),
        "enrollment": (design.get("enrollmentInfo") or {}).get("count"),
    }

    # Run the SOA mapper
    suggestion = build_suggested_soa(trial_data)

    # Include trial metadata in the response
    suggestion["trialInfo"] = {
        "nctId": trial_data["nctId"],
        "briefTitle": trial_data["briefTitle"],
        "officialTitle": trial_data["officialTitle"],
        "conditions": trial_data["conditions"],
        "phase": trial_data["phase"],
        "sponsor": trial_data["sponsorName"],
        "enrollment": trial_data["enrollment"],
        "arms": trial_data["arms"],
    }

    return suggestion
