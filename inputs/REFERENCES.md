# Protocol Authoring Platform — Data Sources, References & Guidelines

> **Purpose:** This document catalogs every dataset, standard, API, template, guideline,
> and published reference used by the platform. It serves as a single inventory so that
> contributors and reviewers can understand what powers each feature and where to add
> new inputs in the future.
>
> **Last updated:** 2026-02-21

---

## Table of Contents

1. [Terminology & Controlled Vocabulary Files](#1-terminology--controlled-vocabulary-files)
2. [Procedure Library & Burden Metrics](#2-procedure-library--burden-metrics)
3. [Activity Catalog (CDISC COSMoS)](#3-activity-catalog-cdisc-cosmos)
4. [Design Templates](#4-design-templates)
5. [ICH M11 Protocol Template Structure](#5-ich-m11-protocol-template-structure)
6. [External APIs & Data Feeds](#6-external-apis--data-feeds)
7. [Regulatory & ICH Guidelines](#7-regulatory--ich-guidelines)
8. [CDISC Standards](#8-cdisc-standards)
9. [CMS Fee Schedule & Cost Data](#9-cms-fee-schedule--cost-data)
10. [Laboratory & Specimen References](#10-laboratory--specimen-references)
11. [Published Studies & Citations](#11-published-studies--citations)
12. [Response Criteria Systems](#12-response-criteria-systems)
13. [PRO / Clinical Outcome Assessments](#13-pro--clinical-outcome-assessments)
14. [NCI Thesaurus Codes](#14-nci-thesaurus-codes)
15. [Adding New Inputs](#15-adding-new-inputs)

---

## 1. Terminology & Controlled Vocabulary Files

All files live in `backend/app/terminology/`. They are loaded once per process by
`backend/app/services/cdisc_terminology.py` and served via `GET /api/terminology/*`.

| File | Records | Content | Primary Source |
|------|---------|---------|----------------|
| `phases.json` | 7 | Clinical trial phases (Phase 0 – IV, N/A) | NCI Thesaurus C-codes |
| `study_types.json` | 3 | Interventional, Observational, Expanded Access | NCI Thesaurus |
| `epoch_types.json` | 5 | Screening, Run-in, Treatment, Follow-up, Washout | CDISC CT / NCI |
| `arm_types.json` | 5 | Experimental, Placebo/Active Comparator, No Intervention, Sham | CDISC CT / NCI |
| `intervention_models.json` | 5 | Parallel, Crossover, Sequential, Factorial, Single Group | CDISC CT / NCI |
| `blinding_schemas.json` | 4 | Open Label, Single/Double/Triple Blind | CDISC CT / NCI |
| `sdtm_domains.json` | 20 | Standard SDTM domains (DM, AE, LB, VS, etc.) with class | CDISC SDTM v3.4 |
| `oncology_domains.json` | 6 | Oncology SDTM domains (TU, TR, RS, etc.) with typical variables | CDISC SDTM / TAUG Oncology |
| `response_criteria.json` | 2 systems | RECIST 1.1, iRECIST — each with coded response categories | RECIST Working Group / CDISC TAUG |

### How to add a new terminology file

1. Create a JSON file in `backend/app/terminology/` (array of objects or dict).
2. Add an accessor function in `backend/app/services/cdisc_terminology.py`.
3. Add a route in `backend/app/routers/terminology.py`.
4. Add a frontend API function in `frontend/src/api/terminology.js`.
5. Add the field to `frontend/src/store/useTerminologyStore.js` state and `loadAll`.

---

## 2. Procedure Library & Burden Metrics

### 2a. Procedure Library (`procedure_library.json`)

**185 curated procedures** organized by therapeutic area.

| Category | Core | Description |
|----------|------|-------------|
| ADMIN | 8 | Informed consent, demographics, randomization, IE criteria, study completion |
| CLINICAL | 8 | Vital signs, physical exam, height/weight, ECOG, medical history, concomitant meds |
| LABORATORY | 10 | Hematology (CBC), chemistry panel, LFTs, renal function, coagulation, urinalysis |
| SAFETY | 6 | AE monitoring, SAE reporting, 12-lead ECG, DILI assessment, C-SSRS, injection-site reaction |
| TREATMENT | 8 | IP administration, dose modification, infusion monitoring, drug accountability |
| PK | 8 | PK sampling (pre/post-dose, trough, peak), ADA testing, bioanalytical sample |
| IMAGING | 9 | CT, MRI, PET, bone scan, X-ray, ultrasound, DEXA, mammography |
| PRO | 12 | EQ-5D-5L, EORTC QLQ-C30, FACT-G, SF-36, PROMIS, NRS Pain, PHQ-9, GAD-7, BPI, PSQI |

**Therapeutic area expansions (116 TA-specific procedures):**

| Therapeutic Area | Procedures | Examples |
|------------------|------------|----------|
| Oncology | 18 | RECIST 1.1, iRECIST, biopsy, TNM staging, PFS/OS, ECOG/Karnofsky, PD-L1, HER2, BRCA, MSI, ctDNA, TMB, NGS |
| Diabetes | 15 | HbA1c, fasting glucose, OGTT, C-peptide, fructosamine, GAD/islet antibodies, foot/retinal exam |
| Cardiovascular | 14 | Echocardiography, Holter, exercise stress test, BNP/NT-proBNP, troponin, lipid panel, LVEF |
| Neurology | 15 | MoCA, MMSE, MRI brain, lumbar puncture, EEG, movement disorder rating scales |
| Immunology | 12 | Flow cytometry, cytokine panel, complement levels, autoantibody panel |
| Respiratory | 12 | Spirometry, DLCO, 6-minute walk test, ACT |
| Infectious Disease | 10 | Viral load, CD4 count, culture & sensitivity, PCR |
| Psychiatry | 12 | HAM-D, MADRS, PANSS, C-SSRS |
| Rare Disease | 8 | Genetic testing, metabolic panel, enzyme assays |

**Compiled from:** CDISC COSMoS, CDASH, LOINC, NCI Thesaurus, CDISC QRS, FDA/ICH guidelines.

---

### 2b. Procedure Burden Metrics (`procedure_burden.json`)

Per-procedure metrics for **all 185 procedures**:

| Metric | Unit | Source |
|--------|------|--------|
| **Time** | minutes | CMS Physician Time Data + published time-motion studies (PMC8249906, PMC11335779) |
| **Blood Volume** | mL per draw | ARUP Laboratories & Laboratory Alliance specimen collection guides |
| **RVU** (work + PE + malpractice) | relative value units | CMS Physician Fee Schedule 2025 (RVU26A) |
| **Cost** | USD | CMS PFS (conversion factor $32.35) for procedures; CMS CLFS 2025 for lab tests |
| **CPT Code** | — | AMA Current Procedural Terminology |
| **LOINC Code** | — | LOINC v2.77 (42 procedures mapped) |
| **Tube Type** | — | ARUP / LabCorp (46 procedures with blood draws) |
| **Staff Type** | — | phlebotomist, nurse, technician, physician, patient |
| **Fasting Required** | boolean | Clinical practice guidelines |

**Tube types defined:**

| Tube | Color | Default Volume | Additive |
|------|-------|----------------|----------|
| LAVENDER_EDTA | Lavender | 3.0 mL | EDTA |
| GOLD_SST | Gold | 5.0 mL | Clot activator + gel |
| LIGHT_BLUE_CITRATE | Light Blue | 2.7 mL | Sodium citrate |
| GREEN_HEPARIN | Green | 4.0 mL | Lithium heparin |
| GRAY_FLUORIDE | Gray | 3.0 mL | Sodium fluoride |
| RED_SERUM | Red | 7.0 mL | None (plain) |

**Burden analytics formulas (used in SOA Insights tab):**

```
Visit Time         = SUM(procedure.timeMinutes)                           for all scheduled procedures in visit
Visit Blood Volume = SUM over tube_types( MAX(volume per test using that tube) )   ← tube-sharing dedup
Procedure Cost     = Total RVU x $32.35   (or CMS CLFS rate for lab tests)
Total RVU          = Work RVU + Practice Expense RVU + Malpractice RVU
Blood Safety Limit = 550 mL over 8 weeks  (adult, non-pregnant, ≥110 lbs)
```

---

## 3. Activity Catalog (CDISC COSMoS)

**File:** `activity_catalog.json` — **1,819 activities**

Built from the CDISC COSMoS (Concepts for Standardized Observation and Measurement in Science) open-source repository.

| Source | URL |
|--------|-----|
| BC Hierarchy CSV | `https://raw.githubusercontent.com/cdisc-org/COSMoS/main/export/cdisc_biomedical_concepts_hierarchy_latest.csv` |
| SDTM Specializations CSV | `https://raw.githubusercontent.com/cdisc-org/COSMoS/main/export/cdisc_sdtm_dataset_specializations_latest.csv` |

**Build script:** `backend/scripts/build_activity_catalog.py`

**Activity counts by UI category:**

| Category | Count |
|----------|-------|
| CLINICAL | 944 |
| ADMIN | 229 |
| LABORATORY | 266 |
| EFFICACY | 200 |
| SAFETY | 114 |
| PRO | 40 |
| IMAGING | 16 |
| PK | 7 |
| TREATMENT | 3 |

Each activity record includes: `id`, `name`, `nciCode`, `definition`, `cdiscCategories`,
`synonyms`, `sdtmDomain`, `uiCategory`, `hierarchyLevel`, `parentId`, `resultScales`, `source`.

---

## 4. Design Templates

**File:** `frontend/src/components/design/designTemplateData.js`

**11 pre-built trial design configurations:**

### Real-world clinical trial examples

| Template | NCT ID | Phase | Design | Indication |
|----------|--------|-------|--------|------------|
| CheckMate 816 | NCT02998528 | Phase 3 | Open-label, Parallel | Neoadjuvant nivo + chemo in resectable NSCLC (Stage IB–IIIA) |
| LAURA | NCT03521154 | Phase 3 | Double-blind, Parallel 2:1 | Osimertinib maintenance after chemoRT in Stage III EGFR+ NSCLC |
| DeLLphi-301 | NCT05060016 | Phase 2 | Open-label, Single Group | Tarlatamab (BiTE) in relapsed/refractory SCLC |

### Generic design patterns

| Template | Description |
|----------|-------------|
| Parallel 2-Arm | Standard two-arm randomized controlled trial |
| Parallel 3-Arm | Three-arm design (e.g., high dose / low dose / placebo) |
| Crossover 2x2 | Two-period, two-sequence crossover with washout |
| Adaptive Dose-Escalation | Oncology Phase 1 with dose-limiting toxicity rules |
| Multi-Arm Multi-Stage (MAMS) | Platform trial with interim analysis and arm dropping |
| Oncology Cycles | Induction cycles followed by maintenance phase |
| Single Group | Single-arm, open-label study |
| Factorial 2x2 | 2x2 factorial design testing two interventions |

Each template provides: epochs (with CDISC C-codes), arms, intervention model,
blinding schema, description, and therapeutic area tag.

---

## 5. ICH M11 Protocol Template Structure

**File:** `frontend/src/constants/ichM11Sections.js`

Implements the ICH M11 (Clinical Electronic Structured Harmonised Protocol) section structure:

| Section | Title |
|---------|-------|
| — | Title Page |
| — | Protocol Synopsis |
| — | Schedule of Activities (SoA) |
| 1 | Introduction (Background, Benefit-Risk Assessment) |
| 2 | Trial Objectives and Estimands |
| 3 | Trial Design |
| 4 | Trial Population (Inclusion/Exclusion Criteria) |
| 5 | Trial Interventions |
| 6 | Trial Endpoints |
| 7 | Participant Discontinuation and Withdrawal |
| 8 | Trial Procedures |
| 9 | Statistical Considerations |
| 10 | Safety Reporting and Management |
| 11 | Trial Management |

**Source:** ICH M11 Technical Specification — Clinical Trial Protocol Template and Common Protocol Template (2023).

---

## 6. External APIs & Data Feeds

| API | Base URL | Purpose | Config |
|-----|----------|---------|--------|
| **ClinicalTrials.gov API v2** | `https://clinicaltrials.gov/api/v2` | Reference trial data, NCT study fetch | Proxied via `backend/app/routers/ctgov_proxy.py` |
| **CDISC Library API** | `https://api.cdisc.org/api` | Controlled terminology, biomedical concepts | `CDISC_API_KEY` in `backend/app/config.py` |
| **CDISC COSMoS (GitHub)** | `https://github.com/cdisc-org/COSMoS` | Activity catalog source CSVs | Offline build via `build_activity_catalog.py` |
| **TransCelerate SDR** | Configurable (default `http://localhost:5000`) | USDM validation, study definitions | `SDR_BASE_URL` in `backend/app/config.py` |

---

## 7. Regulatory & ICH Guidelines

| Guideline | Title | How Used |
|-----------|-------|----------|
| **ICH M11** | Clinical Electronic Structured Harmonised Protocol | Protocol section structure, section numbering |
| **ICH E6(R3)** | Good Clinical Practice | Informed consent procedure, study conduct standards |
| **ICH E9(R1)** | Statistical Principles — Estimands Addendum | Estimand framework in Objectives module |
| **ICH E14** | Clinical Evaluation of QT/QTc Interval Prolongation | QTc assessment procedure definitions |
| **ICH E2A** | Clinical Safety Data Management | Adverse event classification and reporting |
| **FDA Oncology Endpoints Guidance** | Clinical Trial Endpoints for Approval of Cancer Drugs | PFS, OS assessment procedure definitions |
| **FDA Suicidality Guidance (2012)** | Suicidal Ideation and Behavior Assessment | C-SSRS implementation in safety procedures |
| **FDA DILI Guidance** | Drug-Induced Liver Injury Assessment | Hy's Law, DILI assessment procedure |
| **FDA Companion Diagnostics Guidance** | In Vitro Companion Diagnostic Devices | Biomarker panel procedures in oncology |

---

## 8. CDISC Standards

| Standard | Version | How Used |
|----------|---------|----------|
| **CDISC Controlled Terminology (CT)** | Latest via CDISC Library | All terminology dropdowns (phases, study types, epoch types, etc.) |
| **SDTM** | v3.4 | Domain mappings for activities and procedures |
| **CDASH** | v2.2 | Core data collection procedure definitions |
| **USDM** | v3.0 / v4.0 | Study definition model, protocol structure validation |
| **DDF (Digital Data Flow)** | — | Study definition repository integration |
| **COSMoS (Biomedical Concepts)** | Latest | 1,819 activities in activity catalog |
| **QRS (Questionnaire, Rating, Scale)** | — | PRO instrument metadata (EQ-5D-5L, PHQ-9, GAD-7, etc.) |
| **TAUG: Oncology** | — | Oncology-specific procedures, response criteria, SDTM domains |
| **ODM** | v1.3.2 | Export format for study definitions |

---

## 9. CMS Fee Schedule & Cost Data

| Dataset | Year | Purpose | Reference |
|---------|------|---------|-----------|
| **CMS Physician Fee Schedule (PFS)** | 2025 | Work RVU, Practice Expense RVU, Malpractice RVU per CPT code | RVU26A file |
| **CMS Clinical Lab Fee Schedule (CLFS)** | 2025 | National Limit Amount per CPT code for lab tests | CMS.gov CLFS files |
| **CMS Conversion Factor** | 2025 | $32.35 — converts total RVU to Medicare payment amount | CMS Final Rule |
| **CMS Physician Time Data** | 2025 | Intra-service time per CPT code | PFS Relative Value Files |

**Payment formula:**
`Medicare Payment ($) = Total RVU × Conversion Factor ($32.35)`
`Total RVU = Work RVU + Practice Expense RVU + Malpractice RVU`

---

## 10. Laboratory & Specimen References

| Source | Purpose |
|--------|---------|
| **LOINC v2.77** | Logical Observation Identifiers Names and Codes — 42 lab procedures mapped to LOINC codes |
| **ARUP Laboratories Specimen Collection Guide** | Blood tube types, required volumes, additives, special handling |
| **Laboratory Alliance Specimen Collection Guide** | Supplementary tube volume and specimen requirements |
| **LabCorp Test Menu** | Reference for tube types and draw volumes |
| **CPT (AMA)** | Current Procedural Terminology codes for billing and cost lookup |
| **HCPCS** | Healthcare Common Procedure Coding System — Level II codes |

**Blood volume safety reference:**
- Maximum: **550 mL over 8 weeks** (adult, non-pregnant, ≥110 lbs)
- Source: FDA 21 CFR 640.3 (blood donor requirements, applied conservatively to clinical trials)
- Common institutional limit: 10.5 mL/kg over 8 weeks

---

## 11. Published Studies & Citations

| PMC ID | Title / Topic | How Used |
|--------|--------------|----------|
| **PMC8249906** | Time-motion study of clinical trial procedures | Procedure time estimates (vital signs, physical exam, ECG, etc.) |
| **PMC11335779** | Merck SoA Lean Design methodology | Procedure time calibration, visit burden optimization |
| **NCT02998528** | CheckMate 816 — Nivo + chemo in resectable NSCLC | Real-world design template |
| **NCT03521154** | LAURA — Osimertinib in EGFR+ Stage III NSCLC | Real-world design template |
| **NCT05060016** | DeLLphi-301 — Tarlatamab in R/R SCLC | Real-world design template |

---

## 12. Response Criteria Systems

| System | Applicability | Response Categories |
|--------|--------------|---------------------|
| **RECIST 1.1** | Solid tumors | CR, PR, SD, PD, NE |
| **iRECIST** | Immunotherapy in solid tumors | iCR, iPR, iSD, iUPD, iCPD |
| **Lugano Classification** | Lymphoma (referenced in activity catalog) | CMR, PMR, NMR, PMD |
| **RANO** | CNS tumors (referenced in activity catalog) | CR, PR, SD, PD |

**Source:** RECIST Working Group, iRECIST Working Group, CDISC TAUG Oncology.

---

## 13. PRO / Clinical Outcome Assessments

Instruments included in the procedure library:

| Instrument | Full Name | Source / Copyright |
|------------|-----------|-------------------|
| EQ-5D-5L | EuroQol 5-Dimension 5-Level | EuroQol Research Foundation |
| EORTC QLQ-C30 | European Organisation for Research and Treatment of Cancer Quality of Life Questionnaire | EORTC |
| FACT-G | Functional Assessment of Cancer Therapy — General | FACIT.org |
| SF-36 | 36-Item Short Form Health Survey | RAND / QualityMetric |
| PROMIS | Patient-Reported Outcomes Measurement Information System | NIH / Northwestern |
| NRS Pain | Numeric Rating Scale for Pain | Public domain |
| PHQ-9 | Patient Health Questionnaire — 9 item | Pfizer / CDISC QRS |
| GAD-7 | Generalized Anxiety Disorder — 7 item | Pfizer / CDISC QRS |
| BPI | Brief Pain Inventory | MD Anderson Cancer Center |
| PSQI | Pittsburgh Sleep Quality Index | University of Pittsburgh |
| C-SSRS | Columbia-Suicide Severity Rating Scale | Columbia University |
| HAM-D | Hamilton Depression Rating Scale | Public domain |
| MADRS | Montgomery-Asberg Depression Rating Scale | Public domain |
| PANSS | Positive and Negative Syndrome Scale | MHS Inc. |
| MoCA | Montreal Cognitive Assessment | MoCA Clinic & Institute |
| MMSE | Mini-Mental State Examination | PAR Inc. |
| ACT | Asthma Control Test | QualityMetric |

---

## 14. NCI Thesaurus Codes

NCI C-codes are used throughout the terminology files to provide unambiguous concept identification.

**Examples:**

| Code | Concept |
|------|---------|
| C15600 | Phase I Trial |
| C15601 | Phase II Trial |
| C15602 | Phase III Trial |
| C15603 | Phase IV Trial |
| C49686 | Phase 0 Trial |
| C98388 | Interventional Study |
| C17048 | Observational Study |
| C98779 | Screening Epoch |
| C101526 | Treatment Epoch |
| C99158 | Follow-up Epoch |
| C174267 | Experimental Arm |
| C174266 | Placebo Comparator Arm |
| C82639 | Parallel Assignment |
| C82638 | Crossover Assignment |
| C49656 | Open Label |
| C49658 | Double Blind |

**Source:** NCI Thesaurus (NCIt) — https://ncithesaurus.nci.nih.gov/

---

## 15. Adding New Inputs

### To add a new terminology file:
1. Place JSON in `backend/app/terminology/`
2. Add accessor in `cdisc_terminology.py`
3. Add route in `terminology.py` router
4. Add frontend API + store field

### To add a new therapeutic area to the procedure library:
1. Edit `backend/app/terminology/procedure_library.json`
2. Add TA entry to `therapeuticAreas[]`
3. Add procedures to `taProcedures.YOUR_TA[]`
4. Add burden metrics to `procedure_burden.json` for each new procedure

### To add a new design template:
1. Edit `frontend/src/components/design/designTemplateData.js`
2. Follow the existing template structure (epochs, arms, CDISC codes)

### To add a new reference trial:
1. Use the NCT Reference Picker in the UI — it auto-fetches from ClinicalTrials.gov API v2
2. Data is parsed by `frontend/src/utils/parseCtGovTrial.js`

### To update burden metrics:
1. Edit `backend/app/terminology/procedure_burden.json`
2. Each procedure needs: `timeMinutes`, `bloodVolumeMl`, `tubeType`, `rvu`, `costUsd`, `cptCode`, `loincCode`, `derivation`
3. Include the data source in the `derivation` field for traceability

---

## File Inventory Summary

| Location | Files | Total Lines | Description |
|----------|-------|-------------|-------------|
| `backend/app/terminology/` | 12 JSON | ~40,500 | All controlled vocabulary, procedures, burden metrics, activity catalog |
| `frontend/src/constants/` | 3 JS | ~250 | Activity categories, ICH M11 sections, marker types |
| `frontend/src/components/design/designTemplateData.js` | 1 JS | ~650 | 11 trial design templates |
| `backend/scripts/build_activity_catalog.py` | 1 PY | ~300 | Builds activity catalog from CDISC COSMoS CSVs |

**Total unique data records:**
- 1,819 biomedical concept activities
- 185 curated clinical trial procedures
- 185 procedure burden metric entries
- 42 LOINC-mapped lab tests
- 46 blood-draw procedures with tube specifications
- 6 blood tube type definitions
- 11 trial design templates (3 real-world, 8 generic)
- 11 ICH M11 protocol sections
- 20 standard + 6 oncology SDTM domains
- 2 response criteria systems (10 coded categories)
