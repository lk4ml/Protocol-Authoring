"""
Neo4j schema initialization — constraints and indexes.

All statements use IF NOT EXISTS so they are idempotent and safe
to run on every application startup.
"""

from neo4j import AsyncDriver

# Uniqueness constraints on every node type's primary key
CONSTRAINTS = [
    "CREATE CONSTRAINT protocol_id IF NOT EXISTS FOR (n:Protocol) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT protocol_number IF NOT EXISTS FOR (n:Protocol) REQUIRE n.protocolNumber IS UNIQUE",
    "CREATE CONSTRAINT arm_id IF NOT EXISTS FOR (n:StudyArm) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT epoch_id IF NOT EXISTS FOR (n:StudyEpoch) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT element_id IF NOT EXISTS FOR (n:StudyElement) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT cell_id IF NOT EXISTS FOR (n:StudyCell) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT marker_id IF NOT EXISTS FOR (n:StudyMarker) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT flowoverride_id IF NOT EXISTS FOR (n:StudyFlowOverride) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT encounter_id IF NOT EXISTS FOR (n:Encounter) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT activity_id IF NOT EXISTS FOR (n:Activity) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT procedure_id IF NOT EXISTS FOR (n:Procedure) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT timeline_id IF NOT EXISTS FOR (n:ScheduleTimeline) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT instance_id IF NOT EXISTS FOR (n:ScheduledActivityInstance) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT timing_id IF NOT EXISTS FOR (n:Timing) REQUIRE n.id IS UNIQUE",
    # SoaGroup and ActivityGroup have non-unique IDs (e.g. "ADMIN", "SAFETY")
    # shared across protocols, so no uniqueness constraints on them.
    "CREATE CONSTRAINT objective_id IF NOT EXISTS FOR (n:Objective) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT endpoint_id IF NOT EXISTS FOR (n:Endpoint) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT estimand_id IF NOT EXISTS FOR (n:Estimand) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT criterion_id IF NOT EXISTS FOR (n:EligibilityCriterion) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT indication_id IF NOT EXISTS FOR (n:Indication) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT intervention_id IF NOT EXISTS FOR (n:InvestigationalIntervention) REQUIRE n.id IS UNIQUE",
    # ReferenceTrial nctId is not globally unique (multiple protocols may reference the same trial)
    # --- CDISC Controlled Terminology layer ---
    "CREATE CONSTRAINT ct_catalogue_name IF NOT EXISTS FOR (n:CTCatalogue) REQUIRE n.name IS UNIQUE",
    "CREATE CONSTRAINT ct_package_href IF NOT EXISTS FOR (n:CTPackage) REQUIRE n.href IS UNIQUE",
    "CREATE CONSTRAINT ct_codelist_cid IF NOT EXISTS FOR (n:CTCodelist) REQUIRE n.conceptId IS UNIQUE",
    "CREATE CONSTRAINT ct_term_cid IF NOT EXISTS FOR (n:CTTerm) REQUIRE n.conceptId IS UNIQUE",
    "CREATE CONSTRAINT bc_cid IF NOT EXISTS FOR (n:BiomedicalConcept) REQUIRE n.conceptId IS UNIQUE",
    "CREATE CONSTRAINT dec_cid IF NOT EXISTS FOR (n:DataElementConcept) REQUIRE n.conceptId IS UNIQUE",
    "CREATE CONSTRAINT sdtm_domain_code IF NOT EXISTS FOR (n:SDTMDomain) REQUIRE n.code IS UNIQUE",
    # --- Versioning layer ---
    "CREATE CONSTRAINT study_action_id IF NOT EXISTS FOR (n:StudyAction) REQUIRE n.id IS UNIQUE",
    # Root nodes for entity versioning (Root-Value pattern)
    "CREATE CONSTRAINT protocol_root_uid IF NOT EXISTS FOR (n:ProtocolRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT encounter_root_uid IF NOT EXISTS FOR (n:EncounterRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT activity_root_uid IF NOT EXISTS FOR (n:ActivityRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT soagroup_root_uid IF NOT EXISTS FOR (n:SoaGroupRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT activitygroup_root_uid IF NOT EXISTS FOR (n:ActivityGroupRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT scheduletimeline_root_uid IF NOT EXISTS FOR (n:ScheduleTimelineRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT studyarm_root_uid IF NOT EXISTS FOR (n:StudyArmRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT studyepoch_root_uid IF NOT EXISTS FOR (n:StudyEpochRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT studyelement_root_uid IF NOT EXISTS FOR (n:StudyElementRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT studycell_root_uid IF NOT EXISTS FOR (n:StudyCellRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT studymarker_root_uid IF NOT EXISTS FOR (n:StudyMarkerRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT studyflowoverride_root_uid IF NOT EXISTS FOR (n:StudyFlowOverrideRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT objective_root_uid IF NOT EXISTS FOR (n:ObjectiveRoot) REQUIRE n.uid IS UNIQUE",
    "CREATE CONSTRAINT eligibilitycriterion_root_uid IF NOT EXISTS FOR (n:EligibilityCriterionRoot) REQUIRE n.uid IS UNIQUE",
    # --- Activity Library layer ---
    "CREATE CONSTRAINT act_group_lib_id IF NOT EXISTS FOR (n:ActivityGroupLib) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT act_subgroup_lib_id IF NOT EXISTS FOR (n:ActivitySubGroupLib) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT act_concept_lib_id IF NOT EXISTS FOR (n:ActivityConceptLib) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT act_instance_lib_id IF NOT EXISTS FOR (n:ActivityInstanceLib) REQUIRE n.id IS UNIQUE",
]

# Secondary indexes for frequent query patterns
INDEXES = [
    "CREATE INDEX protocol_status IF NOT EXISTS FOR (n:Protocol) ON (n.status)",
    "CREATE INDEX protocol_updated IF NOT EXISTS FOR (n:Protocol) ON (n.updatedAt)",
    "CREATE INDEX activity_domain IF NOT EXISTS FOR (n:Activity) ON (n.sdtmDomain)",
    "CREATE INDEX activity_name IF NOT EXISTS FOR (n:Activity) ON (n.name)",
    "CREATE INDEX criterion_category IF NOT EXISTS FOR (n:EligibilityCriterion) ON (n.category)",
    "CREATE INDEX encounter_order IF NOT EXISTS FOR (n:Encounter) ON (n.order)",
    # --- CT indexes ---
    "CREATE INDEX ct_codelist_name IF NOT EXISTS FOR (n:CTCodelist) ON (n.name)",
    "CREATE INDEX ct_codelist_subval IF NOT EXISTS FOR (n:CTCodelist) ON (n.submissionValue)",
    "CREATE INDEX ct_term_subval IF NOT EXISTS FOR (n:CTTerm) ON (n.submissionValue)",
    "CREATE INDEX ct_term_prefterm IF NOT EXISTS FOR (n:CTTerm) ON (n.preferredTerm)",
    "CREATE INDEX bc_shortname IF NOT EXISTS FOR (n:BiomedicalConcept) ON (n.shortName)",
    "CREATE INDEX bc_category IF NOT EXISTS FOR (n:BiomedicalConcept) ON (n.primaryCategory)",
    "CREATE INDEX sdtm_domain_name IF NOT EXISTS FOR (n:SDTMDomain) ON (n.name)",
    # --- Library indexes ---
    "CREATE INDEX act_concept_lib_name IF NOT EXISTS FOR (n:ActivityConceptLib) ON (n.name)",
    "CREATE INDEX act_concept_lib_nci IF NOT EXISTS FOR (n:ActivityConceptLib) ON (n.nciCode)",
]


async def ensure_constraints(driver: AsyncDriver):
    """Apply all constraints and indexes. Safe to call on every startup."""
    async with driver.session() as session:
        for stmt in CONSTRAINTS + INDEXES:
            await session.run(stmt)
