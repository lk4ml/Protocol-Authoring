# Plan: OSB-Style CDISC CT, Versioning & Study-Level Graph Architecture

## Goal
Transform TrialForge's Neo4j layer to match OpenStudyBuilder's enterprise patterns:
1. **CDISC Controlled Terminology as graph nodes** (not string properties)
2. **Root-Value versioning** on all study entities
3. **Study-level CT binding** (lock specific CT package versions per study)
4. **Audit trail** (StudyAction nodes with BEFORE/AFTER)
5. **Activity Concept library** (reusable across studies)

## What We Already Have
- 22 node types, 32 relationships in Neo4j (flat model)
- 35 MB of CDISC data already downloaded (1,181 codelists, 1,127 BCs, SDTM specs)
- Dual-write SQLite + Neo4j with graceful fallback
- Download script for CDISC Library API
- Full procedure library built from CDISC data

---

## Phase 1: CDISC Controlled Terminology as Graph Nodes

**Files to create/modify:**
- `backend/app/graph/ct_schema.py` — CT node constraints & indexes
- `backend/app/graph/ct_loader.py` — Load CT JSON into Neo4j nodes
- `backend/app/graph/ct_crud.py` — CT query operations
- `backend/app/routers/ct.py` — New REST API for CT browsing
- `backend/app/graph/schema.py` — Add CT constraints

**New Node Types (7):**
- `CTCatalogue` — top-level standard (SDTM CT, ADaM CT, CDASH CT)
- `CTPackage` — versioned package (sdtmct-2025-09-26)
- `CTCodelist` — codelist definition (conceptId=C66742, name="Sex")
- `CTTerm` — individual term (conceptId=C16576, submissionValue="M")
- `BiomedicalConcept` — CDISC COSMOS BC (conceptId=C105585)
- `DataElementConcept` — BC data element (Observation Result, Unit, etc.)
- `SDTMDomain` — SDTM domain definition (DM, AE, LB, VS)

**New Relationships (10):**
- `(CTCatalogue)-[:HAS_PACKAGE]->(CTPackage)`
- `(CTPackage)-[:PRIOR_VERSION]->(CTPackage)`
- `(CTPackage)-[:CONTAINS_CODELIST]->(CTCodelist)`
- `(CTCodelist)-[:HAS_TERM]->(CTTerm)`
- `(BiomedicalConcept)-[:HAS_DATA_ELEMENT]->(DataElementConcept)`
- `(BiomedicalConcept)-[:PARENT_BC]->(BiomedicalConcept)`
- `(BiomedicalConcept)-[:IN_DOMAIN]->(SDTMDomain)`
- `(SDTMDomain)-[:HAS_VARIABLE]->(SDTMVariable)` (optional, from SDTMIG)
- `(CTTerm)-[:MAPS_TO_BC]->(BiomedicalConcept)` (cross-reference)
- `(Protocol)-[:USES_CT_PACKAGE]->(CTPackage)` (study-level binding)

**Implementation Steps:**
1. Create `ct_schema.py` with constraints for all CT nodes (conceptId uniqueness)
2. Create `ct_loader.py` that reads the existing JSON files from `inputs/`:
   - Parse `cdisc_api_sdtm_ct_latest.json` → create CTCatalogue + CTPackage + CTCodelist + CTTerm nodes
   - Parse `cdisc_api_bc_details.json` → create BiomedicalConcept + DataElementConcept nodes
   - Parse `cdisc_api_sdtmig_domain_details.json` → create SDTMDomain nodes
   - All in batched transactions (UNWIND pattern for performance)
3. Create `ct_crud.py` with query functions:
   - `list_catalogues()` — all CT catalogues
   - `list_packages(catalogue)` — packages for a catalogue
   - `get_codelist(conceptId)` — codelist with terms
   - `search_terms(query)` — full-text search across terms
   - `get_bc(conceptId)` — BC with data elements
   - `get_codelists_for_domain(domain)` — codelists relevant to a domain
4. Create `routers/ct.py` with REST endpoints:
   - `GET /api/ct/catalogues`
   - `GET /api/ct/packages/{catalogue}`
   - `GET /api/ct/codelists?search=...&domain=...`
   - `GET /api/ct/codelists/{conceptId}`
   - `GET /api/ct/terms?search=...`
   - `GET /api/ct/biomedical-concepts?search=...&category=...`
5. Run CT loader on startup (idempotent — skip if nodes exist)

**Estimated nodes created:** ~40,000 (1,181 codelists × ~20 terms avg + 1,127 BCs + 63 domains)

---

## Phase 2: Root-Value Versioning Pattern

**Files to create/modify:**
- `backend/app/graph/versioning.py` — Version management logic
- `backend/app/graph/crud.py` — Refactor all writes to Root-Value pattern
- `backend/app/graph/schema.py` — Add Root/Value constraints
- `backend/app/routers/versions.py` — Version management API

**Versioning Architecture:**

Every study entity gets split into Root + Value:
```
(StudyArmRoot {uid: "arm-001"})
  -[:HAS_VERSION {version: 1, status: "FINAL"}]-> (StudyArmValue {name: "Placebo", ...})
  -[:HAS_VERSION {version: 2, status: "DRAFT"}]-> (StudyArmValue {name: "Treatment A", ...})
  -[:LATEST_FINAL]-> (StudyArmValue v1)
  -[:LATEST_DRAFT]-> (StudyArmValue v2)
```

**Entities to version (12 Root-Value pairs):**
- Protocol → ProtocolRoot + ProtocolValue
- StudyArm → StudyArmRoot + StudyArmValue
- StudyEpoch → StudyEpochRoot + StudyEpochValue
- StudyElement → StudyElementRoot + StudyElementValue
- StudyCell → StudyCellRoot + StudyCellValue
- Encounter → EncounterRoot + EncounterValue
- Activity → ActivityRoot + ActivityValue
- Objective → ObjectiveRoot + ObjectiveValue
- Endpoint → EndpointRoot + EndpointValue
- EligibilityCriterion → CriterionRoot + CriterionValue
- ScheduleTimeline → TimelineRoot + TimelineValue
- ScheduledActivityInstance → InstanceRoot + InstanceValue

**New Relationships:**
- `HAS_VERSION` (with properties: version, status, startDate, endDate, authorId)
- `LATEST_DRAFT` — shortcut to current working version
- `LATEST_FINAL` — shortcut to approved version
- `LATEST_RETIRED` — shortcut to deprecated version

**Version Lifecycle:**
1. **Create**: Root node + first Value node (status=DRAFT) + LATEST_DRAFT pointer
2. **Edit**: Update properties on the LATEST_DRAFT Value node
3. **Finalize**: Change status from DRAFT→FINAL, move LATEST_FINAL pointer, set endDate on old FINAL
4. **New Version**: Create new Value node (DRAFT), move LATEST_DRAFT pointer
5. **Retire**: Set status RETIRED, move LATEST_RETIRED pointer

**Implementation Steps:**
1. Create `versioning.py` with core functions:
   - `create_root_value(label, uid, properties)` — create Root + initial DRAFT Value
   - `update_draft(root_uid, properties)` — update current draft
   - `finalize_version(root_uid, author_id)` — DRAFT → FINAL
   - `create_new_version(root_uid, author_id)` — clone FINAL → new DRAFT
   - `get_latest(root_uid, status="DRAFT")` — get via shortcut pointer
   - `get_version_history(root_uid)` — all versions with metadata
   - `rollback_to_version(root_uid, version_number)` — restore old version
2. Refactor `crud.py` write functions to use Root-Value pattern:
   - `save_design()` → create Root nodes on first write, update Values on subsequent
   - Smart detection: if Root exists, update draft; if not, create Root + Value
3. Refactor `crud.py` read functions to follow LATEST_DRAFT/LATEST_FINAL pointers
4. Create `routers/versions.py`:
   - `GET /api/protocols/{id}/versions` — list all versions
   - `POST /api/protocols/{id}/versions/finalize` — finalize current draft
   - `POST /api/protocols/{id}/versions/new` — create new draft from latest final
   - `GET /api/protocols/{id}/versions/{version}` — get specific version snapshot
5. Update frontend stores to handle version metadata

**Migration Strategy:**
- Existing flat nodes → convert to Root + single DRAFT Value
- One-time migration script similar to existing `migration.py`

---

## Phase 3: Study-Level CT Binding & Term References

**Files to modify:**
- `backend/app/graph/crud.py` — Add CT term references on save
- `backend/app/graph/ct_crud.py` — Study-CT binding queries

**How It Works:**
When a study is created, it binds to a specific CT package version:
```
(ProtocolRoot)-[:USES_CT_PACKAGE]->(CTPackage {name: "sdtmct-2025-09-26"})
```

When study entities reference coded values (phase, arm type, epoch type), they link to CT terms:
```
(StudyArmValue)-[:HAS_CT_TERM {role: "armType"}]->(CTTerm {submissionValue: "Experimental Arm"})
(StudyEpochValue)-[:HAS_CT_TERM {role: "epochType"}]->(CTTerm {submissionValue: "TREATMENT"})
(ProtocolValue)-[:HAS_CT_TERM {role: "phase"}]->(CTTerm {submissionValue: "Phase III"})
```

**Implementation Steps:**
1. On protocol creation, auto-bind to latest CT package
2. On design save, resolve typeCode strings → CTTerm node relationships
3. Add `resolve_ct_term(codelist_conceptId, submission_value)` helper
4. Store both the relationship AND the string property (backward compat)
5. Add API to change CT package binding (upgrade study to newer CT)
6. Add API to show CT diff between packages (what changed)

---

## Phase 4: Audit Trail (StudyAction Nodes)

**Files to create/modify:**
- `backend/app/graph/audit.py` — Audit trail logic
- `backend/app/graph/crud.py` — Inject audit calls on every write
- `backend/app/routers/audit.py` — Audit history API

**New Node Type:**
- `StudyAction` — {actionType, timestamp, authorId, description, entityType, entityUid}

**New Relationships:**
- `(Protocol)-[:HAS_ACTION]->(StudyAction)` — study-scoped audit log
- `(StudyAction)-[:BEFORE]->(OldValue)` — previous state
- `(StudyAction)-[:AFTER]->(NewValue)` — new state
- `(StudyAction)-[:ON_ENTITY]->(Root)` — which entity was changed

**Action Types:**
- CREATE, UPDATE, DELETE, FINALIZE, NEW_VERSION, ROLLBACK

**Implementation Steps:**
1. Create `audit.py` with:
   - `record_action(session, protocol_id, action_type, entity_type, entity_uid, author_id, before_props, after_props)`
   - `get_audit_trail(protocol_id, limit, offset)` — paginated history
   - `get_entity_history(root_uid)` — all changes to one entity
2. Inject audit recording into versioning operations (finalize, new version)
3. Inject audit recording into CRUD operations (create, update, delete)
4. Create `routers/audit.py`:
   - `GET /api/protocols/{id}/audit` — full audit trail
   - `GET /api/protocols/{id}/audit/{entity_uid}` — entity-specific history

---

## Phase 5: Activity Concept Library (Cross-Study Reuse)

**Files to create/modify:**
- `backend/app/graph/library.py` — Library CRUD
- `backend/app/routers/library.py` — Library API
- `backend/app/graph/ct_loader.py` — Extend to load BCs as library concepts

**New Node Types (4):**
- `ActivityGroupLib` — library-level group (Vital Signs, Labs, etc.)
- `ActivitySubGroupLib` — sub-group (Blood Pressure, Hematology)
- `ActivityConceptLib` — reusable concept (Body Weight, Glucose)
- `ActivityInstanceLib` — specific instance (Glucose - Serum, Glucose - Plasma)

**New Relationships:**
- `(ActivityGroupLib)-[:HAS_SUBGROUP]->(ActivitySubGroupLib)`
- `(ActivitySubGroupLib)-[:HAS_CONCEPT]->(ActivityConceptLib)`
- `(ActivityConceptLib)-[:HAS_INSTANCE]->(ActivityInstanceLib)`
- `(ActivityConceptLib)-[:MAPS_TO_BC]->(BiomedicalConcept)` — CDISC link
- `(ActivityConceptLib)-[:HAS_CT_TERM]->(CTTerm)` — coded value link
- `(ActivityInstanceLib)-[:IN_DOMAIN]->(SDTMDomain)` — SDTM mapping
- `(ActivityValue)-[:REFERENCES_CONCEPT]->(ActivityConceptLib)` — study → library

**Implementation Steps:**
1. Build library from existing procedure_library.json + CDISC BC data
2. Create hierarchy: our soaGroups → ActivityGroupLib, activityGroups → SubGroupLib
3. Each procedure becomes an ActivityConceptLib or ActivityInstanceLib
4. Link to BiomedicalConcept and CTTerm nodes
5. Study activities (ActivityValue) get REFERENCES_CONCEPT edge to library
6. Create API for browsing/searching the library
7. Enable cross-study activity reuse via library references

---

## Execution Order & Dependencies

```
Phase 1 (CT Nodes)         ← Foundation, no dependencies
    ↓
Phase 2 (Versioning)       ← Depends on Phase 1 for CT term refs
    ↓
Phase 3 (CT Binding)       ← Depends on Phase 1 + Phase 2
    ↓
Phase 4 (Audit Trail)      ← Depends on Phase 2 (hooks into versioning)
    ↓
Phase 5 (Activity Library)  ← Depends on Phase 1 (CT links) + Phase 2 (versioning)
```

## Summary of New Nodes & Relationships

| Phase | New Node Types | New Relationships | Estimated Nodes |
|-------|---------------|-------------------|-----------------|
| 1 - CT | 7 (CTCatalogue, CTPackage, CTCodelist, CTTerm, BC, DEC, SDTMDomain) | 10 | ~40,000 |
| 2 - Versioning | 24 (12 Root + 12 Value, replacing 12 flat) | 4 (HAS_VERSION, LATEST_*) | Doubles existing |
| 3 - CT Binding | 0 | 2 (USES_CT_PACKAGE, HAS_CT_TERM) | Per-study refs |
| 4 - Audit | 1 (StudyAction) | 3 (HAS_ACTION, BEFORE, AFTER) | Per-change |
| 5 - Library | 4 (GroupLib, SubGroupLib, ConceptLib, InstanceLib) | 6 | ~2,000 |
| **Total** | **36 new** | **25 new** | **~42,000+** |

After implementation: **58 node types, 57 relationship types** (up from 22/32).

## Testing Strategy
- All existing 29 tests must continue passing (SQLite path unchanged)
- New tests for each phase:
  - Phase 1: CT loader creates correct node counts, search works
  - Phase 2: Version lifecycle (create, finalize, new version, rollback)
  - Phase 3: CT binding on protocol creation, term resolution
  - Phase 4: Audit trail recorded on operations
  - Phase 5: Library hierarchy queries, cross-study references

## Frontend Impact (Minimal for backend phases)
- Phase 1: New CT browser component (optional, can browse via API)
- Phase 2: Version selector in header, version history panel
- Phase 3: CT package indicator, term picker replacing free-text dropdowns
- Phase 4: Audit trail viewer panel
- Phase 5: Activity library browser replacing current procedure picker
