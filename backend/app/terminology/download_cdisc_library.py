#!/usr/bin/env python3
"""
Download comprehensive data from the official CDISC Library API.
Uses authenticated API access for full biomedical concept details.

API Key: Provided by user (Amgen CDISC Library subscription)
Base URL: https://library.cdisc.org/api
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

BASE_URL = "https://library.cdisc.org/api"
API_KEY = os.environ.get("CDISC_API_KEY", "")
INPUTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "inputs")

if not API_KEY:
    print("ERROR: Set CDISC_API_KEY environment variable before running.")
    print("  export CDISC_API_KEY=your_api_key_here")
    sys.exit(1)

HEADERS = {
    "api-key": API_KEY,
    "Accept": "application/json",
}

def api_get(path, retries=3):
    """Make authenticated GET request to CDISC Library API."""
    url = f"{BASE_URL}{path}" if path.startswith("/") else f"{BASE_URL}/{path}"
    req = urllib.request.Request(url, headers=HEADERS)

    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:  # Rate limit
                wait = 2 ** attempt
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            elif e.code == 404:
                return None
            else:
                print(f"  HTTP {e.code} for {path}")
                if attempt < retries - 1:
                    time.sleep(1)
                else:
                    return None
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                print(f"  Error fetching {path}: {e}")
                return None
    return None


def download_all_bcs():
    """Download all Biomedical Concepts with full details."""
    print("=" * 60)
    print("1. Downloading Biomedical Concepts (BCs)")
    print("=" * 60)

    # Get BC list
    bc_list = api_get("/cosmos/v2/mdr/bc/biomedicalconcepts")
    if not bc_list:
        print("  ERROR: Could not fetch BC list")
        return []

    bc_links = bc_list.get("_links", {}).get("biomedicalConcepts", [])
    print(f"  Found {len(bc_links)} BCs to download")

    # Download each BC's details
    bc_details = []
    errors = 0

    def fetch_bc(link):
        href = link.get("href", "")
        # The BC list returns paths like /mdr/bc/biomedicalconcepts/C105585
        # but the COSMOS v2 API requires /cosmos/v2/mdr/bc/biomedicalconcepts/C105585
        if href.startswith("/mdr/bc/"):
            href = "/cosmos/v2" + href
        elif href.startswith("/mdr/specializations/"):
            href = "/cosmos/v2" + href
        return api_get(href)

    # Use thread pool for parallel downloads (respect rate limits)
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_bc, link): link for link in bc_links}
        done = 0
        for future in as_completed(futures):
            done += 1
            if done % 100 == 0:
                print(f"  Downloaded {done}/{len(bc_links)} BCs...")
            result = future.result()
            if result:
                bc_details.append(result)
            else:
                errors += 1

    print(f"  Downloaded {len(bc_details)} BCs ({errors} errors)")

    # Save to file
    output = os.path.join(INPUTS_DIR, "cdisc_api_bc_details.json")
    with open(output, "w", encoding="utf-8") as f:
        json.dump(bc_details, f, indent=2, ensure_ascii=False)
    print(f"  Saved to {output}")

    return bc_details


def download_sdtm_specializations():
    """Download SDTM Dataset Specializations with details."""
    print("\n" + "=" * 60)
    print("2. Downloading SDTM Dataset Specializations")
    print("=" * 60)

    # Get specialization list
    spec_list = api_get("/cosmos/v2/mdr/specializations/sdtm/datasetspecializations")
    if not spec_list:
        print("  ERROR: Could not fetch specialization list")
        return []

    spec_links = spec_list.get("_links", {}).get("datasetSpecializations", [])
    print(f"  Found {len(spec_links)} specializations")

    # Download each specialization's details
    spec_details = []
    errors = 0

    def fetch_spec(link):
        href = link.get("href", "")
        # Fix paths: /mdr/specializations/... → /cosmos/v2/mdr/specializations/...
        if href.startswith("/mdr/specializations/"):
            href = "/cosmos/v2" + href
        return api_get(href)

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_spec, link): link for link in spec_links}
        done = 0
        for future in as_completed(futures):
            done += 1
            if done % 100 == 0:
                print(f"  Downloaded {done}/{len(spec_links)} specializations...")
            result = future.result()
            if result:
                spec_details.append(result)
            else:
                errors += 1

    print(f"  Downloaded {len(spec_details)} specializations ({errors} errors)")

    # Save
    output = os.path.join(INPUTS_DIR, "cdisc_api_sdtm_spec_details.json")
    with open(output, "w", encoding="utf-8") as f:
        json.dump(spec_details, f, indent=2, ensure_ascii=False)
    print(f"  Saved to {output}")

    return spec_details


def download_sdtmig_domains():
    """Download SDTMIG 3-4 domain definitions with variables."""
    print("\n" + "=" * 60)
    print("3. Downloading SDTMIG 3-4 Domain Definitions")
    print("=" * 60)

    # Get datasets list
    ds_list = api_get("/mdr/sdtmig/3-4/datasets")
    if not ds_list:
        print("  ERROR: Could not fetch datasets")
        return []

    ds_links = ds_list.get("_links", {}).get("datasets", [])
    print(f"  Found {len(ds_links)} SDTMIG domains")

    # Download each domain with variables
    domain_details = []
    for link in ds_links:
        href = link.get("href", "")
        title = link.get("title", "")
        domain_code = href.split("/")[-1]

        data = api_get(href)
        if data:
            data["_domainCode"] = domain_code
            data["_title"] = title
            domain_details.append(data)

    print(f"  Downloaded {len(domain_details)} domain definitions")

    # Save
    output = os.path.join(INPUTS_DIR, "cdisc_api_sdtmig_domain_details.json")
    with open(output, "w", encoding="utf-8") as f:
        json.dump(domain_details, f, indent=2, ensure_ascii=False)
    print(f"  Saved to {output}")

    return domain_details


def download_cdashig_domains():
    """Download CDASHIG 2-2 domain definitions with fields."""
    print("\n" + "=" * 60)
    print("4. Downloading CDASHIG 2-2 Domain Definitions")
    print("=" * 60)

    ds_list = api_get("/mdr/cdashig/2-2/domains")
    if not ds_list:
        print("  ERROR: Could not fetch CDASHIG domains")
        return []

    ds_links = ds_list.get("_links", {}).get("domains", [])
    print(f"  Found {len(ds_links)} CDASHIG domains")

    domain_details = []
    for link in ds_links:
        href = link.get("href", "")
        title = link.get("title", "")
        domain_code = href.split("/")[-1]

        data = api_get(href)
        if data:
            data["_domainCode"] = domain_code
            data["_title"] = title
            domain_details.append(data)

    print(f"  Downloaded {len(domain_details)} CDASHIG domain definitions")

    output = os.path.join(INPUTS_DIR, "cdisc_api_cdashig_domain_details.json")
    with open(output, "w", encoding="utf-8") as f:
        json.dump(domain_details, f, indent=2, ensure_ascii=False)
    print(f"  Saved to {output}")

    return domain_details


def download_ct_package():
    """Download latest SDTM Controlled Terminology package."""
    print("\n" + "=" * 60)
    print("5. Downloading Latest SDTM Controlled Terminology")
    print("=" * 60)

    # Get CT packages list
    ct_list = api_get("/mdr/ct/packages")
    if not ct_list:
        print("  ERROR: Could not fetch CT packages")
        return None

    # Find latest SDTM CT package
    packages = ct_list.get("_links", {}).get("packages", [])
    sdtm_pkgs = [p for p in packages if "sdtmct" in p.get("href", "")]
    if not sdtm_pkgs:
        print("  No SDTM CT packages found")
        return None

    # Sort by date (newest first)
    sdtm_pkgs.sort(key=lambda x: x.get("href", ""), reverse=True)
    latest = sdtm_pkgs[0]
    print(f"  Latest SDTM CT: {latest.get('title', '')} → {latest.get('href', '')}")

    # Download the package
    ct_data = api_get(latest["href"])
    if ct_data:
        output = os.path.join(INPUTS_DIR, "cdisc_api_sdtm_ct_latest.json")
        with open(output, "w", encoding="utf-8") as f:
            json.dump(ct_data, f, indent=2, ensure_ascii=False)
        print(f"  Saved to {output}")

        # Count codelists
        codelists = ct_data.get("_links", {}).get("codelists", [])
        print(f"  Contains {len(codelists)} codelists")
    else:
        print("  ERROR downloading CT package")

    return ct_data


def print_summary(bc_details, spec_details, domain_details, cdash_details):
    """Print download summary."""
    print("\n" + "=" * 60)
    print("DOWNLOAD SUMMARY")
    print("=" * 60)

    print(f"\nBiomedical Concepts: {len(bc_details)}")

    # BC category distribution
    cats = defaultdict(int)
    for bc in bc_details:
        for cat in bc.get("categories", []):
            cats[cat] += 1
    print(f"  Categories: {len(cats)} unique")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1])[:15]:
        print(f"    {cat}: {count}")

    # BCs with parents (hierarchy)
    with_parent = sum(1 for bc in bc_details if bc.get("_links", {}).get("parentBiomedicalConcept"))
    print(f"  With parent BC: {with_parent}")

    print(f"\nSDTM Dataset Specializations: {len(spec_details)}")
    # Spec domains
    spec_domains = defaultdict(int)
    for spec in spec_details:
        domain = spec.get("domain", "?")
        spec_domains[domain] += 1
    print(f"  Domains: {len(spec_domains)}")
    for dom, count in sorted(spec_domains.items(), key=lambda x: -x[1])[:15]:
        print(f"    {dom}: {count}")

    print(f"\nSDTMIG 3-4 Domains: {len(domain_details)}")
    print(f"CDASHIG 2-2 Domains: {len(cdash_details)}")

    # File sizes
    print(f"\nFiles saved to: {INPUTS_DIR}")
    for fn in sorted(os.listdir(INPUTS_DIR)):
        if fn.startswith("cdisc_api_"):
            path = os.path.join(INPUTS_DIR, fn)
            size_mb = os.path.getsize(path) / (1024 * 1024)
            print(f"  {fn}: {size_mb:.1f} MB")


if __name__ == "__main__":
    os.makedirs(INPUTS_DIR, exist_ok=True)

    print("Downloading data from CDISC Library API...")
    print(f"Base URL: {BASE_URL}")
    print(f"Output: {INPUTS_DIR}")
    print()

    bc_details = download_all_bcs()
    spec_details = download_sdtm_specializations()
    domain_details = download_sdtmig_domains()
    cdash_details = download_cdashig_domains()
    ct_data = download_ct_package()

    print_summary(bc_details, spec_details, domain_details, cdash_details)
    print("\n✅ All downloads complete!")
