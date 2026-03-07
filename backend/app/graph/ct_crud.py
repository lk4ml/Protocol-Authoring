"""
CDISC Controlled Terminology query operations.

Provides read-only access to CT nodes loaded by ct_loader.py,
plus study-level CT binding (USES_CT_PACKAGE, HAS_CT_TERM).
"""

import logging
from neo4j import AsyncSession

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Catalogue & Package queries
# ---------------------------------------------------------------------------

async def list_catalogues(session: AsyncSession) -> list[dict]:
    """List all CT catalogues with their package counts."""
    result = await session.run("""
        MATCH (cat:CTCatalogue)
        OPTIONAL MATCH (cat)-[:HAS_PACKAGE]->(pkg:CTPackage)
        RETURN cat.name AS name,
               cat.description AS description,
               count(pkg) AS packageCount
        ORDER BY cat.name
    """)
    return [dict(r) async for r in result]


async def list_packages(session: AsyncSession, catalogue: str = None) -> list[dict]:
    """List CT packages, optionally filtered by catalogue."""
    if catalogue:
        result = await session.run("""
            MATCH (cat:CTCatalogue {name: $catalogue})-[:HAS_PACKAGE]->(pkg:CTPackage)
            OPTIONAL MATCH (pkg)-[:PRIOR_VERSION]->(prior:CTPackage)
            RETURN pkg.href AS href,
                   pkg.title AS title,
                   pkg.standard AS standard,
                   pkg.effectiveDate AS effectiveDate,
                   prior.href AS priorVersionHref
            ORDER BY pkg.effectiveDate DESC
        """, catalogue=catalogue)
    else:
        result = await session.run("""
            MATCH (pkg:CTPackage)
            OPTIONAL MATCH (cat:CTCatalogue)-[:HAS_PACKAGE]->(pkg)
            OPTIONAL MATCH (pkg)-[:PRIOR_VERSION]->(prior:CTPackage)
            RETURN pkg.href AS href,
                   pkg.title AS title,
                   pkg.standard AS standard,
                   pkg.effectiveDate AS effectiveDate,
                   cat.name AS catalogue,
                   prior.href AS priorVersionHref
            ORDER BY pkg.effectiveDate DESC
        """)
    return [dict(r) async for r in result]


async def get_latest_package(session: AsyncSession,
                             standard: str = "SDTM") -> dict | None:
    """Get the most recent CT package for a given standard."""
    result = await session.run("""
        MATCH (pkg:CTPackage {standard: $standard})
        RETURN pkg.href AS href,
               pkg.title AS title,
               pkg.standard AS standard,
               pkg.effectiveDate AS effectiveDate
        ORDER BY pkg.effectiveDate DESC
        LIMIT 1
    """, standard=standard)
    record = await result.single()
    return dict(record) if record else None


# ---------------------------------------------------------------------------
# Codelist queries
# ---------------------------------------------------------------------------

async def list_codelists(session: AsyncSession,
                         search: str = None,
                         package_href: str = None,
                         limit: int = 50,
                         offset: int = 0) -> list[dict]:
    """List codelists with optional search and package filter."""
    params = {"limit": limit, "offset": offset}

    if package_href and search:
        query = """
            MATCH (pkg:CTPackage {href: $pkgHref})-[:CONTAINS_CODELIST]->(cl:CTCodelist)
            WHERE cl.name CONTAINS $search
               OR cl.submissionValue CONTAINS $search
               OR cl.conceptId CONTAINS $search
            RETURN cl.conceptId AS conceptId,
                   cl.name AS name,
                   cl.submissionValue AS submissionValue,
                   cl.extensible AS extensible,
                   cl.definition AS definition
            ORDER BY cl.name
            SKIP $offset LIMIT $limit
        """
        params["pkgHref"] = package_href
        params["search"] = search
    elif package_href:
        query = """
            MATCH (pkg:CTPackage {href: $pkgHref})-[:CONTAINS_CODELIST]->(cl:CTCodelist)
            RETURN cl.conceptId AS conceptId,
                   cl.name AS name,
                   cl.submissionValue AS submissionValue,
                   cl.extensible AS extensible,
                   cl.definition AS definition
            ORDER BY cl.name
            SKIP $offset LIMIT $limit
        """
        params["pkgHref"] = package_href
    elif search:
        query = """
            MATCH (cl:CTCodelist)
            WHERE cl.name CONTAINS $search
               OR cl.submissionValue CONTAINS $search
               OR cl.conceptId CONTAINS $search
            RETURN cl.conceptId AS conceptId,
                   cl.name AS name,
                   cl.submissionValue AS submissionValue,
                   cl.extensible AS extensible,
                   cl.definition AS definition
            ORDER BY cl.name
            SKIP $offset LIMIT $limit
        """
        params["search"] = search
    else:
        query = """
            MATCH (cl:CTCodelist)
            RETURN cl.conceptId AS conceptId,
                   cl.name AS name,
                   cl.submissionValue AS submissionValue,
                   cl.extensible AS extensible,
                   cl.definition AS definition
            ORDER BY cl.name
            SKIP $offset LIMIT $limit
        """

    result = await session.run(query, **params)
    return [dict(r) async for r in result]


async def get_codelist(session: AsyncSession, concept_id: str) -> dict | None:
    """Get a single codelist with all its terms."""
    result = await session.run("""
        MATCH (cl:CTCodelist {conceptId: $cid})
        OPTIONAL MATCH (cl)-[:HAS_TERM]->(t:CTTerm)
        RETURN cl.conceptId AS conceptId,
               cl.name AS name,
               cl.submissionValue AS submissionValue,
               cl.preferredTerm AS preferredTerm,
               cl.definition AS definition,
               cl.extensible AS extensible,
               cl.synonyms AS synonyms,
               collect({
                   conceptId: t.conceptId,
                   submissionValue: t.submissionValue,
                   preferredTerm: t.preferredTerm,
                   definition: t.definition,
                   synonyms: t.synonyms
               }) AS terms
    """, cid=concept_id)
    record = await result.single()
    if not record:
        return None

    d = dict(record)
    # Filter out null terms (from OPTIONAL MATCH with no results)
    d["terms"] = [t for t in d["terms"] if t.get("conceptId")]
    return d


# ---------------------------------------------------------------------------
# Term queries
# ---------------------------------------------------------------------------

async def search_terms(session: AsyncSession,
                       query: str,
                       codelist_id: str = None,
                       limit: int = 50) -> list[dict]:
    """Search across CT terms by submission value, preferred term, or concept ID."""
    params = {"limit": limit}

    if codelist_id:
        cypher = """
            MATCH (cl:CTCodelist {conceptId: $clId})-[:HAS_TERM]->(t:CTTerm)
            WHERE t.submissionValue CONTAINS $query
               OR t.preferredTerm CONTAINS $query
               OR t.conceptId CONTAINS $query
            RETURN t.conceptId AS conceptId,
                   t.submissionValue AS submissionValue,
                   t.preferredTerm AS preferredTerm,
                   t.definition AS definition,
                   cl.conceptId AS codelistConceptId,
                   cl.name AS codelistName
            ORDER BY t.submissionValue
            LIMIT $limit
        """
        params["clId"] = codelist_id
        params["query"] = query
    else:
        cypher = """
            MATCH (cl:CTCodelist)-[:HAS_TERM]->(t:CTTerm)
            WHERE t.submissionValue CONTAINS $query
               OR t.preferredTerm CONTAINS $query
               OR t.conceptId CONTAINS $query
            RETURN t.conceptId AS conceptId,
                   t.submissionValue AS submissionValue,
                   t.preferredTerm AS preferredTerm,
                   t.definition AS definition,
                   cl.conceptId AS codelistConceptId,
                   cl.name AS codelistName
            ORDER BY t.submissionValue
            LIMIT $limit
        """
        params["query"] = query

    result = await session.run(cypher, **params)
    return [dict(r) async for r in result]


async def get_term(session: AsyncSession, concept_id: str) -> dict | None:
    """Get a single CT term with its parent codelist info."""
    result = await session.run("""
        MATCH (cl:CTCodelist)-[:HAS_TERM]->(t:CTTerm {conceptId: $cid})
        RETURN t.conceptId AS conceptId,
               t.submissionValue AS submissionValue,
               t.preferredTerm AS preferredTerm,
               t.definition AS definition,
               t.synonyms AS synonyms,
               cl.conceptId AS codelistConceptId,
               cl.name AS codelistName,
               cl.submissionValue AS codelistSubmissionValue
    """, cid=concept_id)
    record = await result.single()
    return dict(record) if record else None


# ---------------------------------------------------------------------------
# Biomedical Concept queries
# ---------------------------------------------------------------------------

async def list_biomedical_concepts(session: AsyncSession,
                                   category: str = None,
                                   search: str = None,
                                   limit: int = 50,
                                   offset: int = 0) -> list[dict]:
    """List BCs with optional category and search filters."""
    params = {"limit": limit, "offset": offset}
    where_clauses = []

    if category:
        where_clauses.append("bc.primaryCategory = $category")
        params["category"] = category
    if search:
        where_clauses.append(
            "(bc.shortName CONTAINS $search OR bc.conceptId CONTAINS $search)"
        )
        params["search"] = search

    where = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    result = await session.run(f"""
        MATCH (bc:BiomedicalConcept)
        {where}
        OPTIONAL MATCH (bc)-[:IN_DOMAIN]->(d:SDTMDomain)
        RETURN bc.conceptId AS conceptId,
               bc.shortName AS shortName,
               bc.definition AS definition,
               bc.categories AS categories,
               bc.primaryCategory AS primaryCategory,
               d.code AS sdtmDomain
        ORDER BY bc.shortName
        SKIP $offset LIMIT $limit
    """, **params)
    return [dict(r) async for r in result]


async def get_biomedical_concept(session: AsyncSession,
                                 concept_id: str) -> dict | None:
    """Get a single BC with data elements, parent, and domain."""
    result = await session.run("""
        MATCH (bc:BiomedicalConcept {conceptId: $cid})
        OPTIONAL MATCH (bc)-[:HAS_DATA_ELEMENT]->(dec:DataElementConcept)
        OPTIONAL MATCH (bc)-[:PARENT_BC]->(parent:BiomedicalConcept)
        OPTIONAL MATCH (bc)-[:IN_DOMAIN]->(d:SDTMDomain)
        RETURN bc.conceptId AS conceptId,
               bc.shortName AS shortName,
               bc.definition AS definition,
               bc.categories AS categories,
               bc.resultScales AS resultScales,
               bc.synonyms AS synonyms,
               parent.conceptId AS parentConceptId,
               parent.shortName AS parentShortName,
               d.code AS sdtmDomain,
               d.name AS sdtmDomainName,
               collect(DISTINCT {
                   conceptId: dec.conceptId,
                   shortName: dec.shortName,
                   dataType: dec.dataType,
                   exampleSet: dec.exampleSet
               }) AS dataElements
    """, cid=concept_id)
    record = await result.single()
    if not record:
        return None

    d = dict(record)
    d["dataElements"] = [de for de in d["dataElements"] if de.get("conceptId")]
    return d


async def list_bc_categories(session: AsyncSession) -> list[dict]:
    """List all unique BC categories with counts."""
    result = await session.run("""
        MATCH (bc:BiomedicalConcept)
        WHERE bc.primaryCategory IS NOT NULL AND bc.primaryCategory <> ''
        RETURN bc.primaryCategory AS category,
               count(bc) AS count
        ORDER BY count DESC
    """)
    return [dict(r) async for r in result]


# ---------------------------------------------------------------------------
# SDTM Domain queries
# ---------------------------------------------------------------------------

async def list_sdtm_domains(session: AsyncSession) -> list[dict]:
    """List all SDTM domains with BC counts."""
    result = await session.run("""
        MATCH (d:SDTMDomain)
        OPTIONAL MATCH (bc:BiomedicalConcept)-[:IN_DOMAIN]->(d)
        RETURN d.code AS code,
               d.name AS name,
               d.description AS description,
               count(bc) AS bcCount
        ORDER BY d.code
    """)
    return [dict(r) async for r in result]


# ---------------------------------------------------------------------------
# Study-level CT binding
# ---------------------------------------------------------------------------

async def bind_study_to_ct_package(session: AsyncSession,
                                   protocol_id: str,
                                   package_href: str) -> bool:
    """Bind a study to a specific CT package version."""
    result = await session.run("""
        MATCH (p:Protocol {id: $pid})
        MATCH (pkg:CTPackage {href: $href})
        MERGE (p)-[:USES_CT_PACKAGE]->(pkg)
        RETURN p.id AS pid
    """, pid=protocol_id, href=package_href)
    record = await result.single()
    return record is not None


async def get_study_ct_package(session: AsyncSession,
                               protocol_id: str) -> dict | None:
    """Get the CT package bound to a study."""
    result = await session.run("""
        MATCH (p:Protocol {id: $pid})-[:USES_CT_PACKAGE]->(pkg:CTPackage)
        RETURN pkg.href AS href,
               pkg.title AS title,
               pkg.standard AS standard,
               pkg.effectiveDate AS effectiveDate
    """, pid=protocol_id)
    record = await result.single()
    return dict(record) if record else None


async def resolve_ct_term(session: AsyncSession,
                          codelist_submission_value: str,
                          term_submission_value: str) -> dict | None:
    """Resolve a CT term by codelist + term submission values."""
    result = await session.run("""
        MATCH (cl:CTCodelist {submissionValue: $clSv})-[:HAS_TERM]->(t:CTTerm)
        WHERE t.submissionValue = $tSv
        RETURN t.conceptId AS conceptId,
               t.submissionValue AS submissionValue,
               t.preferredTerm AS preferredTerm,
               cl.conceptId AS codelistConceptId,
               cl.name AS codelistName
        LIMIT 1
    """, clSv=codelist_submission_value, tSv=term_submission_value)
    record = await result.single()
    return dict(record) if record else None


async def link_entity_to_ct_term(session: AsyncSession,
                                 entity_label: str,
                                 entity_id: str,
                                 term_concept_id: str,
                                 role: str) -> bool:
    """Link a study entity to a CT term with a role property.

    Example: link StudyArm to CTTerm with role='armType'
    """
    result = await session.run(f"""
        MATCH (e:{entity_label} {{id: $eid}})
        MATCH (t:CTTerm {{conceptId: $tcid}})
        MERGE (e)-[r:HAS_CT_TERM {{role: $role}}]->(t)
        RETURN e.id AS eid
    """, eid=entity_id, tcid=term_concept_id, role=role)
    record = await result.single()
    return record is not None


# ---------------------------------------------------------------------------
# CT statistics (for health/admin)
# ---------------------------------------------------------------------------

async def get_ct_stats(session: AsyncSession) -> dict:
    """Get counts of all CT node types."""
    result = await session.run("""
        OPTIONAL MATCH (cat:CTCatalogue) WITH count(cat) AS catalogues
        OPTIONAL MATCH (pkg:CTPackage) WITH catalogues, count(pkg) AS packages
        OPTIONAL MATCH (cl:CTCodelist) WITH catalogues, packages, count(cl) AS codelists
        OPTIONAL MATCH (t:CTTerm) WITH catalogues, packages, codelists, count(t) AS terms
        OPTIONAL MATCH (bc:BiomedicalConcept)
        WITH catalogues, packages, codelists, terms, count(bc) AS bcs
        OPTIONAL MATCH (dec:DataElementConcept)
        WITH catalogues, packages, codelists, terms, bcs, count(dec) AS decs
        OPTIONAL MATCH (d:SDTMDomain)
        RETURN catalogues, packages, codelists, terms, bcs, decs, count(d) AS domains
    """)
    record = await result.single()
    if not record:
        return {}
    return dict(record)
