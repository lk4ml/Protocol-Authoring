/**
 * Fuzzy procedure search utility for the SOA inline autocomplete.
 *
 * Scores procedures against a user query using multiple matching strategies:
 *   - Name prefix / substring matching
 *   - Levenshtein word-level fuzzy matching
 *   - SDTM domain / NCI code exact matching
 *   - Definition substring matching
 *
 * Results are boosted for procedures in the target Activity Group and
 * for CDISC-sourced procedures.  Already-added procedures sort last.
 */

/**
 * Simple Levenshtein distance (no external dep).
 * Computes the minimum edit distance between two strings.
 */
function levenshtein(a, b) {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Use a single-row DP approach for memory efficiency
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

/**
 * Search procedures with fuzzy matching and category-aware scoring.
 *
 * @param {string} query — user input (e.g. "creatine")
 * @param {Array}  procedures — flat list of procedure objects from the library
 * @param {Object} options
 * @param {string} [options.targetActivityGroupId] — Activity Group to prioritize
 * @param {Set}    [options.addedNames] — lowercase names already in the schedule
 * @param {number} [options.limit=15] — max results to return
 * @returns {Array<{ procedure, score, matchField, isInCategory, isAdded }>}
 */
export function fuzzySearchProcedures(query, procedures, options = {}) {
  const {
    targetActivityGroupId = null,
    addedNames = new Set(),
    limit = 15,
  } = options;

  if (!procedures || procedures.length === 0) return [];

  // Empty query: return all procedures in target category, sorted alphabetically
  if (!query || query.trim().length === 0) {
    if (targetActivityGroupId) {
      return procedures
        .filter((p) => p.activityGroupId === targetActivityGroupId)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .slice(0, limit)
        .map((p) => ({
          procedure: p,
          score: 50,
          matchField: 'category',
          isInCategory: true,
          isAdded: addedNames.has((p.name || '').toLowerCase()),
        }));
    }
    return [];
  }

  const q = query.toLowerCase().trim();
  const scored = [];

  for (const proc of procedures) {
    const name = (proc.name || '').toLowerCase();
    const definition = (proc.definition || '').toLowerCase();
    const domain = (proc.sdtmDomain || '').toLowerCase();
    const nci = (proc.nciCode || '').toLowerCase();
    const shortName = (proc.shortName || '').toLowerCase();

    let score = 0;
    let matchField = '';

    // 1. Exact prefix on name (highest priority)
    if (name.startsWith(q)) {
      score = 100;
      matchField = 'name-prefix';
    }
    // 2. Substring in name
    else if (name.includes(q)) {
      score = 80;
      matchField = 'name-substring';
    }
    // 3. Levenshtein on individual words in the name
    else {
      const queryWords = q.split(/\s+/);
      const nameWords = name.split(/\s+/);
      let bestWordScore = 0;

      for (const qw of queryWords) {
        if (qw.length < 2) continue; // skip very short query words
        for (const nw of nameWords) {
          if (nw.length < 2) continue;
          const dist = levenshtein(qw, nw);
          const maxLen = Math.max(qw.length, nw.length);
          const similarity = 1 - dist / maxLen;
          if (similarity >= 0.6) {
            // At least 60% similar
            const wordScore = Math.round(70 * similarity);
            if (wordScore > bestWordScore) bestWordScore = wordScore;
          }
        }
      }
      if (bestWordScore > 0) {
        score = bestWordScore;
        matchField = 'name-fuzzy';
      }
    }

    // 4. Synonym match (if available)
    if (score < 60 && Array.isArray(proc.synonyms)) {
      for (const syn of proc.synonyms) {
        if ((syn || '').toLowerCase().includes(q)) {
          score = Math.max(score, 60);
          matchField = 'synonym';
          break;
        }
      }
    }

    // 5. Short name / SDTM domain / NCI code exact match
    if (score < 40 && (domain === q || nci === q || shortName.startsWith(q))) {
      score = Math.max(score, 40);
      matchField = 'code';
    }

    // 6. Definition substring
    if (score < 30 && definition.includes(q)) {
      score = Math.max(score, 30);
      matchField = 'definition';
    }

    // Threshold: discard low-quality matches
    if (score < 25) continue;

    // Category boost: +20 if in the target Activity Group
    const isInCategory = proc.activityGroupId === targetActivityGroupId;
    if (isInCategory) score += 20;

    // CDISC source boost: +5 for standards-aligned procedures
    if ((proc.source || '').includes('CDISC')) score += 5;

    const isAdded = addedNames.has((proc.name || '').toLowerCase());

    scored.push({ procedure: proc, score, matchField, isInCategory, isAdded });
  }

  // Sort: non-added first, then by score desc, then alphabetically
  scored.sort((a, b) => {
    if (a.isAdded !== b.isAdded) return a.isAdded ? 1 : -1;
    if (a.score !== b.score) return b.score - a.score;
    return (a.procedure.name || '').localeCompare(b.procedure.name || '');
  });

  return scored.slice(0, limit);
}

/**
 * Classify a procedure's source for badge display.
 *
 * @param {Object} proc — procedure object
 * @returns {{ label: string, bgClass: string, textClass: string }}
 */
export function getSourceBadge(proc) {
  if (proc.nciCode && (proc.source || '').includes('CDISC')) {
    return { label: 'CDISC', bgClass: 'bg-indigo-100', textClass: 'text-indigo-700' };
  }
  if (
    (proc.source || '').includes('Company') ||
    (proc.therapeuticArea && proc.therapeuticArea !== 'ALL')
  ) {
    return { label: 'Company', bgClass: 'bg-amber-100', textClass: 'text-amber-700' };
  }
  return { label: 'Custom', bgClass: 'bg-gray-100', textClass: 'text-gray-600' };
}
