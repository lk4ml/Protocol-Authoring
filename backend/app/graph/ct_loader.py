"""
Load CDISC Controlled Terminology into Neo4j as graph nodes.

Reads pre-downloaded JSON files from backend/app/terminology/inputs/ and
creates CTCatalogue, CTPackage, CTCodelist, CTTerm, BiomedicalConcept,
DataElementConcept, and SDTMDomain nodes with full relationships.

All operations are idempotent — uses MERGE to avoid duplicates.
Uses UNWIND batching for performance (~40k nodes in <30s).
"""

import json
import logging
import os
from pathlib import Path

from neo4j import AsyncDriver

logger = logging.getLogger(__name__)

INPUTS_DIR = Path(__file__).parent.parent / "terminology" / "inputs"

BATCH_SIZE = 500  # nodes per UNWIND batch


async def load_all_ct(driver: AsyncDriver) -> dict:
    """Load all CDISC CT data into Neo4j. Returns counts."""
    counts = {}

    async with driver.session() as session:
        # Check if CT is already loaded
        result = await session.run("MATCH (n:CTCatalogue) RETURN count(n) AS c")
        record = await result.single()
        if record and record["c"] > 0:
            logger.info("CT data already loaded, skipping (use force_reload=True to overwrite)")
            return {"status": "already_loaded"}

    counts["sdtm_ct"] = await _load_sdtm_ct(driver)
    counts["biomedical_concepts"] = await _load_biomedical_concepts(driver)
    counts["sdtm_domains"] = await _load_sdtm_domains(driver)
    counts["cross_references"] = await _create_cross_references(driver)

    logger.info(f"CT loading complete: {counts}")
    return counts


async def force_reload_ct(driver: AsyncDriver) -> dict:
    """Drop all CT nodes and reload from JSON."""
    async with driver.session() as session:
        for label in ["CTTerm", "CTCodelist", "CTPackage", "CTCatalogue",
                       "DataElementConcept", "BiomedicalConcept", "SDTMDomain"]:
            await session.run(f"MATCH (n:{label}) DETACH DELETE n")
        logger.info("Cleared all CT nodes")

    return await _load_all_ct_unchecked(driver)


async def _load_all_ct_unchecked(driver: AsyncDriver) -> dict:
    """Load without checking if already loaded."""
    counts = {}
    counts["sdtm_ct"] = await _load_sdtm_ct(driver)
    counts["biomedical_concepts"] = await _load_biomedical_concepts(driver)
    counts["sdtm_domains"] = await _load_sdtm_domains(driver)
    counts["cross_references"] = await _create_cross_references(driver)
    logger.info(f"CT loading complete: {counts}")
    return counts


# ---------------------------------------------------------------------------
# SDTM Controlled Terminology (Codelists + Terms)
# ---------------------------------------------------------------------------

async def _load_sdtm_ct(driver: AsyncDriver) -> dict:
    """Load SDTM CT package with codelists and terms."""
    ct_file = INPUTS_DIR / "cdisc_api_sdtm_ct_latest.json"
    if not ct_file.exists():
        logger.warning(f"CT file not found: {ct_file}")
        return {"error": "file_not_found"}

    with open(ct_file, "r", encoding="utf-8") as f:
        ct_data = json.load(f)

    # Extract package metadata
    self_link = ct_data.get("_links", {}).get("self", {})
    prior_link = ct_data.get("_links", {}).get("priorVersion", {})
    pkg_href = self_link.get("href", "")
    pkg_title = self_link.get("title", "")

    codelists = ct_data.get("codelists", [])
    logger.info(f"Loading SDTM CT: {pkg_title} ({len(codelists)} codelists)")

    async with driver.session() as session:
        # Create catalogue + package
        await session.run("""
            MERGE (cat:CTCatalogue {name: 'SDTM CT'})
            SET cat.description = 'CDISC SDTM Controlled Terminology'
            MERGE (pkg:CTPackage {href: $href})
            SET pkg.title = $title,
                pkg.standard = 'SDTM',
                pkg.effectiveDate = $effectiveDate
            MERGE (cat)-[:HAS_PACKAGE]->(pkg)
        """, href=pkg_href, title=pkg_title,
             effectiveDate=_extract_date(pkg_href))

        # Link prior version if exists
        if prior_link.get("href"):
            await session.run("""
                MERGE (pkg:CTPackage {href: $href})
                MERGE (prior:CTPackage {href: $priorHref})
                SET prior.title = $priorTitle,
                    prior.standard = 'SDTM',
                    prior.effectiveDate = $priorDate
                MERGE (pkg)-[:PRIOR_VERSION]->(prior)
                WITH prior
                MATCH (cat:CTCatalogue {name: 'SDTM CT'})
                MERGE (cat)-[:HAS_PACKAGE]->(prior)
            """, href=pkg_href, priorHref=prior_link["href"],
                 priorTitle=prior_link.get("title", ""),
                 priorDate=_extract_date(prior_link.get("href", "")))

        # Batch-load codelists and terms
        codelist_count = 0
        term_count = 0

        for i in range(0, len(codelists), BATCH_SIZE):
            batch = codelists[i:i + BATCH_SIZE]
            cl_params = []
            term_params = []

            for cl in batch:
                cid = cl.get("conceptId", "")
                if not cid:
                    continue
                cl_params.append({
                    "conceptId": cid,
                    "name": cl.get("name", ""),
                    "submissionValue": cl.get("submissionValue", ""),
                    "preferredTerm": cl.get("preferredTerm", ""),
                    "definition": cl.get("definition", ""),
                    "extensible": cl.get("extensible", "false") == "true",
                    "synonyms": cl.get("synonyms", []),
                })

                for term in cl.get("terms", []):
                    tcid = term.get("conceptId", "")
                    if not tcid:
                        continue
                    term_params.append({
                        "conceptId": tcid,
                        "codelistConceptId": cid,
                        "submissionValue": term.get("submissionValue", ""),
                        "preferredTerm": term.get("preferredTerm", ""),
                        "definition": term.get("definition", ""),
                        "synonyms": term.get("synonyms", []),
                    })

            # Create codelists
            if cl_params:
                await session.run("""
                    UNWIND $items AS item
                    MERGE (cl:CTCodelist {conceptId: item.conceptId})
                    SET cl.name = item.name,
                        cl.submissionValue = item.submissionValue,
                        cl.preferredTerm = item.preferredTerm,
                        cl.definition = item.definition,
                        cl.extensible = item.extensible,
                        cl.synonyms = item.synonyms
                    WITH cl, item
                    MATCH (pkg:CTPackage {href: $pkgHref})
                    MERGE (pkg)-[:CONTAINS_CODELIST]->(cl)
                """, items=cl_params, pkgHref=pkg_href)
                codelist_count += len(cl_params)

            # Create terms and link to codelists
            if term_params:
                await session.run("""
                    UNWIND $items AS item
                    MERGE (t:CTTerm {conceptId: item.conceptId})
                    SET t.submissionValue = item.submissionValue,
                        t.preferredTerm = item.preferredTerm,
                        t.definition = item.definition,
                        t.synonyms = item.synonyms
                    WITH t, item
                    MATCH (cl:CTCodelist {conceptId: item.codelistConceptId})
                    MERGE (cl)-[:HAS_TERM]->(t)
                """, items=term_params)
                term_count += len(term_params)

            if (i + BATCH_SIZE) % 2000 == 0:
                logger.info(f"  Loaded {codelist_count} codelists, {term_count} terms...")

    logger.info(f"SDTM CT loaded: {codelist_count} codelists, {term_count} terms")
    return {"codelists": codelist_count, "terms": term_count}


# ---------------------------------------------------------------------------
# Biomedical Concepts
# ---------------------------------------------------------------------------

async def _load_biomedical_concepts(driver: AsyncDriver) -> dict:
    """Load CDISC COSMOS Biomedical Concepts."""
    bc_file = INPUTS_DIR / "cdisc_api_bc_details.json"
    if not bc_file.exists():
        logger.warning(f"BC file not found: {bc_file}")
        return {"error": "file_not_found"}

    with open(bc_file, "r", encoding="utf-8") as f:
        bc_list = json.load(f)

    logger.info(f"Loading {len(bc_list)} Biomedical Concepts")

    bc_count = 0
    dec_count = 0
    parent_links = []

    async with driver.session() as session:
        for i in range(0, len(bc_list), BATCH_SIZE):
            batch = bc_list[i:i + BATCH_SIZE]
            bc_params = []
            dec_params = []

            for bc in batch:
                cid = bc.get("conceptId", "")
                if not cid:
                    continue

                categories = bc.get("categories", [])
                bc_params.append({
                    "conceptId": cid,
                    "shortName": bc.get("shortName", ""),
                    "definition": bc.get("definition", ""),
                    "synonyms": bc.get("synonyms", []),
                    "categories": categories,
                    "primaryCategory": categories[0] if categories else "",
                    "resultScales": bc.get("resultScales", []),
                })

                # Track parent relationships for later
                parent_href = (bc.get("_links", {})
                               .get("parentBiomedicalConcept", {})
                               .get("href", ""))
                if parent_href:
                    parent_cid = parent_href.split("/")[-1]
                    parent_links.append({"child": cid, "parent": parent_cid})

                # Data element concepts
                for dec in bc.get("dataElementConcepts", []):
                    dec_cid = dec.get("conceptId", "")
                    if not dec_cid:
                        continue
                    dec_params.append({
                        "conceptId": dec_cid,
                        "shortName": dec.get("shortName", ""),
                        "dataType": dec.get("dataType", ""),
                        "exampleSet": dec.get("exampleSet", []),
                        "bcConceptId": cid,
                    })

            # Create BCs
            if bc_params:
                await session.run("""
                    UNWIND $items AS item
                    MERGE (bc:BiomedicalConcept {conceptId: item.conceptId})
                    SET bc.shortName = item.shortName,
                        bc.definition = item.definition,
                        bc.synonyms = item.synonyms,
                        bc.categories = item.categories,
                        bc.primaryCategory = item.primaryCategory,
                        bc.resultScales = item.resultScales
                """, items=bc_params)
                bc_count += len(bc_params)

            # Create DECs and link to BCs
            if dec_params:
                await session.run("""
                    UNWIND $items AS item
                    MERGE (dec:DataElementConcept {conceptId: item.conceptId})
                    SET dec.shortName = item.shortName,
                        dec.dataType = item.dataType,
                        dec.exampleSet = item.exampleSet
                    WITH dec, item
                    MATCH (bc:BiomedicalConcept {conceptId: item.bcConceptId})
                    MERGE (bc)-[:HAS_DATA_ELEMENT]->(dec)
                """, items=dec_params)
                dec_count += len(dec_params)

        # Create parent-child BC relationships
        if parent_links:
            for i in range(0, len(parent_links), BATCH_SIZE):
                batch = parent_links[i:i + BATCH_SIZE]
                await session.run("""
                    UNWIND $links AS link
                    MATCH (child:BiomedicalConcept {conceptId: link.child})
                    MATCH (parent:BiomedicalConcept {conceptId: link.parent})
                    MERGE (child)-[:PARENT_BC]->(parent)
                """, links=batch)

    logger.info(f"BCs loaded: {bc_count} concepts, {dec_count} data elements, "
                f"{len(parent_links)} parent links")
    return {"concepts": bc_count, "data_elements": dec_count,
            "parent_links": len(parent_links)}


# ---------------------------------------------------------------------------
# SDTM Domains
# ---------------------------------------------------------------------------

async def _load_sdtm_domains(driver: AsyncDriver) -> dict:
    """Load SDTMIG domain definitions."""
    domain_file = INPUTS_DIR / "cdisc_api_sdtmig_domain_details.json"
    if not domain_file.exists():
        logger.warning(f"Domain file not found: {domain_file}")
        return {"error": "file_not_found"}

    with open(domain_file, "r", encoding="utf-8") as f:
        domains = json.load(f)

    logger.info(f"Loading {len(domains)} SDTM domains")

    async with driver.session() as session:
        params = []
        for d in domains:
            code = d.get("_domainCode", d.get("name", ""))
            if not code:
                continue
            params.append({
                "code": code.upper(),
                "name": d.get("_title", d.get("label", code)),
                "description": d.get("description", ""),
                "structure": d.get("datasetStructure", ""),
            })

        if params:
            await session.run("""
                UNWIND $items AS item
                MERGE (d:SDTMDomain {code: item.code})
                SET d.name = item.name,
                    d.description = item.description,
                    d.structure = item.structure
            """, items=params)

    logger.info(f"SDTM domains loaded: {len(params)}")
    return {"domains": len(params)}


# ---------------------------------------------------------------------------
# Cross-references between CT, BCs, and Domains
# ---------------------------------------------------------------------------

async def _create_cross_references(driver: AsyncDriver) -> dict:
    """Create relationships linking BCs to domains and terms."""
    linked = 0

    async with driver.session() as session:
        # Link BCs to SDTM domains based on categories & SDTM spec data
        # We use the SDTM specializations file to connect BCs to domains
        spec_file = INPUTS_DIR / "cdisc_api_sdtm_spec_details.json"
        if spec_file.exists():
            with open(spec_file, "r", encoding="utf-8") as f:
                specs = json.load(f)

            bc_domain_map = {}
            for spec in specs:
                domain = spec.get("domain", "")
                bc_href = (spec.get("_links", {})
                           .get("parentBiomedicalConcept", {})
                           .get("href", ""))
                if domain and bc_href:
                    bc_cid = bc_href.split("/")[-1]
                    bc_domain_map[bc_cid] = domain.upper()

            if bc_domain_map:
                link_params = [{"bcCid": k, "domain": v}
                               for k, v in bc_domain_map.items()]
                for i in range(0, len(link_params), BATCH_SIZE):
                    batch = link_params[i:i + BATCH_SIZE]
                    result = await session.run("""
                        UNWIND $links AS link
                        MATCH (bc:BiomedicalConcept {conceptId: link.bcCid})
                        MATCH (d:SDTMDomain {code: link.domain})
                        MERGE (bc)-[:IN_DOMAIN]->(d)
                        RETURN count(*) AS cnt
                    """, links=batch)
                    record = await result.single()
                    linked += record["cnt"] if record else 0

    logger.info(f"Cross-references created: {linked} BC-domain links")
    return {"bc_domain_links": linked}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_date(href: str) -> str:
    """Extract date from CT package href like '/mdr/ct/packages/sdtmct-2025-09-26'."""
    if not href:
        return ""
    parts = href.split("-")
    if len(parts) >= 4:
        return "-".join(parts[-3:])
    return ""


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

async def main():
    """Run CT loader from command line."""
    import sys
    from .. import graph

    driver = await graph.get_driver()
    try:
        await graph.verify_connectivity()
    except Exception as e:
        print(f"Cannot connect to Neo4j: {e}")
        sys.exit(1)

    from .schema import ensure_constraints
    await ensure_constraints(driver)

    if len(sys.argv) > 1 and sys.argv[1] == "--force":
        counts = await force_reload_ct(driver)
    else:
        counts = await load_all_ct(driver)

    print(f"\nResults: {json.dumps(counts, indent=2)}")
    await graph.close_driver()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
