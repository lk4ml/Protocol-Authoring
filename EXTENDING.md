# Extending TrialForge — Developer Guide

## Adding a New Indication (Therapeutic Area)

No code changes needed — only create a JSON file.

### Step 1: Create Profile JSON

Create a new file in `backend/app/terminology/indication_profiles/`:

```
backend/app/terminology/indication_profiles/respiratory.json
```

### Step 2: Profile Schema

```json
{
  "_meta": {
    "id": "RESPIRATORY",
    "name": "Respiratory",
    "description": "Profile for respiratory disease trials",
    "version": "1.0.0"
  },

  "conditionSignals": [
    "asthma", "copd", "pulmonary fibrosis"
  ],

  "additionalExcludePatterns": [],

  "additionalOutcomeSignals": {
    "DOMAIN_CODE": ["pattern1", "pattern2"]
  },

  "additionalOutcomeToSearch": {
    "DOMAIN_CODE": ["Library Procedure Name"]
  },

  "additionalEligibilitySignals": {
    "eligibility text pattern": ["Library Procedure Name"]
  },

  "additionalProAbbreviations": [
    "sgrq", "act", "aqlq"
  ],

  "visitTemplates": {
    "PHASE2":  [2, 4, 8, 12, 24],
    "PHASE3":  [4, 8, 12, 24, 36, 52],
    "DEFAULT": [4, 12, 24, 52]
  }
}
```

### Step 3: Verify

Run regression tests:
```bash
cd backend
venv/bin/python -m pytest tests/test_indication_profiles.py -v
```

The profile is auto-discovered — no imports or registration needed.

---

## Profile Contract Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_meta.id` | string | Yes | Uppercase TA identifier (e.g., `"RESPIRATORY"`) |
| `_meta.name` | string | Yes | Display name |
| `conditionSignals` | string[] | Yes | Patterns matched against CT.gov conditions/keywords. Scored 3x. |
| `additionalExcludePatterns` | string[] | No | Extra patterns to exclude from core procedure selection |
| `additionalOutcomeSignals` | dict<string, string[]> | No | Extra outcome text patterns keyed by SDTM domain code |
| `additionalOutcomeToSearch` | dict<string, string[]> | No | Library procedure names to add when outcome signals match |
| `additionalEligibilitySignals` | dict<string, string[]> | No | Eligibility text patterns → library procedure names |
| `additionalProAbbreviations` | string[] | No | PRO instrument abbreviations (lowercase) |
| `visitTemplates` | dict<string, int[]> | No | Treatment visit weeks keyed by phase (`PHASE1`, `PHASE2`, `PHASE3`, `DEFAULT`) |

### Merge Behavior

TA profiles are **merged on top of** `_default.json`:
- Lists: concatenated (deduplicated)
- Dicts: keys extended (TA values supplement base)
- Visit templates: TA overrides base per phase key

---

## Schedule Instance Schema (Canonical)

The canonical schema for `ScheduledActivityInstance`:

```json
{
  "id": "uuid",
  "activityIds": ["uuid", "uuid"],
  "encounterId": "uuid",
  "epochId": "uuid | null",
  "defaultConditionId": "mandatory | conditional"
}
```

### Legacy Compatibility

The API accepts legacy fields and normalizes them:

| Legacy Field | Canonical Field | Transformation |
|-------------|----------------|----------------|
| `activityId` (string) | `activityIds` (string[]) | Wrapped in array |
| `conditionality` (string) | `defaultConditionId` (string) | Renamed |

Normalization happens at two boundaries:
1. **Backend API** — `ScheduleInstanceRequest` Pydantic model (in `models/requests.py`)
2. **Frontend store** — `normalizeInstance()` function (in `useScheduleStore.js`)

---

## Configuration

### Backend (FastAPI)

All settings in `backend/app/config.py` via `pydantic-settings`:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENV` | `development` | Runtime environment |
| `DATABASE_URL` | `sqlite:///./protocol_authoring.db` | Database connection |
| `CDISC_API_KEY` | `""` | CDISC Library API key |
| `CDISC_LIBRARY_BASE_URL` | `https://library.cdisc.org/api` | CDISC Library endpoint |
| `CTGOV_BASE_URL` | `https://clinicaltrials.gov/api/v2` | ClinicalTrials.gov endpoint |
| `SDR_BASE_URL` | `http://localhost:5000` | SDR service endpoint |
| `CORS_ORIGINS` | `[localhost:3000, 3001, 5173]` | Allowed CORS origins |
| `PORT` | `8001` | Server port |

Override via environment variables or `.env` file.

### Frontend (Vite)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8001/api` | Backend API base URL |

Set in `frontend/.env` or `frontend/.env.local`.

---

## Database Migrations

Uses Alembic (not startup ALTER TABLE).

```bash
cd backend

# Create a new migration after model changes:
venv/bin/alembic revision --autogenerate -m "describe_change"

# Apply migrations:
venv/bin/alembic upgrade head

# Downgrade:
venv/bin/alembic downgrade -1
```

---

## API Request Models

All write endpoints use strict Pydantic models (see `backend/app/models/requests.py`):

| Endpoint | Method | Request Model |
|----------|--------|---------------|
| `/api/protocols` | POST | `ProtocolCreateRequest` |
| `/api/protocols/{id}` | PUT | `ProtocolUpdateRequest` |
| `/api/protocols/{id}/design` | PUT | `StudyDesignUpdateRequest` |
| `/api/protocols/{id}/schedule` | PUT | `ScheduleUpdateRequest` |
| `/api/protocols/{id}/references` | POST | `ReferenceTrialRequest` |

All GET and terminology endpoints are read-only (no request body).

---

## Project Structure

```
Protocol_Authoring/
├── backend/
│   ├── app/
│   │   ├── config.py                 # Centralized settings
│   │   ├── database.py               # SQLAlchemy engine
│   │   ├── main.py                   # FastAPI app
│   │   ├── db/                       # ORM tables + CRUD
│   │   ├── models/                   # Pydantic models
│   │   │   ├── requests.py           # API request validation
│   │   │   └── schedule.py           # Canonical schedule schema
│   │   ├── routers/                  # API endpoints
│   │   ├── services/
│   │   │   ├── soa_mapper.py         # SOA suggestion engine
│   │   │   └── indication_profiles.py # Profile loader
│   │   └── terminology/
│   │       ├── indication_profiles/  # TA-specific JSON rules
│   │       │   ├── _default.json
│   │       │   ├── oncology.json
│   │       │   ├── cardiovascular.json
│   │       │   └── ...
│   │       ├── procedure_library.json
│   │       └── soa_hierarchy.json
│   ├── alembic/                      # Database migrations
│   ├── tests/                        # Regression tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.js             # Centralized API client
│   │   ├── store/useScheduleStore.js # Canonical schedule state
│   │   └── components/
│   └── .env                          # Frontend config defaults
└── EXTENDING.md                      # This file
```
