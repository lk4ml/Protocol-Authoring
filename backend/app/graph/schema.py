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
    "CREATE CONSTRAINT soagroup_id IF NOT EXISTS FOR (n:SoaGroup) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT activitygroup_id IF NOT EXISTS FOR (n:ActivityGroup) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT objective_id IF NOT EXISTS FOR (n:Objective) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT endpoint_id IF NOT EXISTS FOR (n:Endpoint) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT estimand_id IF NOT EXISTS FOR (n:Estimand) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT criterion_id IF NOT EXISTS FOR (n:EligibilityCriterion) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT indication_id IF NOT EXISTS FOR (n:Indication) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT intervention_id IF NOT EXISTS FOR (n:InvestigationalIntervention) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT reftrial_nctid IF NOT EXISTS FOR (n:ReferenceTrial) REQUIRE n.nctId IS UNIQUE",
]

# Secondary indexes for frequent query patterns
INDEXES = [
    "CREATE INDEX protocol_status IF NOT EXISTS FOR (n:Protocol) ON (n.status)",
    "CREATE INDEX protocol_updated IF NOT EXISTS FOR (n:Protocol) ON (n.updatedAt)",
    "CREATE INDEX activity_domain IF NOT EXISTS FOR (n:Activity) ON (n.sdtmDomain)",
    "CREATE INDEX activity_name IF NOT EXISTS FOR (n:Activity) ON (n.name)",
    "CREATE INDEX criterion_category IF NOT EXISTS FOR (n:EligibilityCriterion) ON (n.category)",
    "CREATE INDEX encounter_order IF NOT EXISTS FOR (n:Encounter) ON (n.order)",
]


async def ensure_constraints(driver: AsyncDriver):
    """Apply all constraints and indexes. Safe to call on every startup."""
    async with driver.session() as session:
        for stmt in CONSTRAINTS + INDEXES:
            await session.run(stmt)
