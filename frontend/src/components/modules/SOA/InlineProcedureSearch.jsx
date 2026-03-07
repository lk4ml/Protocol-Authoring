import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fuzzySearchProcedures, getSourceBadge } from '../../../utils/fuzzyProcedureSearch';

/**
 * Activity Group display names (mirrors ProcedurePicker).
 */
const ACTIVITY_GROUP_NAMES = {
  CONSENT: 'Consent & Enrollment',
  DEMOG: 'Demographics & History',
  CLINICAL: 'Clinical Assessments',
  LABS: 'Laboratory Assessments',
  CARDIAC: 'Cardiac Assessments',
  IMAGING_S: 'Safety Imaging',
  AE: 'Adverse Events',
  TUMOR: 'Tumor Assessments',
  DISEASE: 'Disease Activity & Response',
  BIOMARKER: 'Biomarkers',
  IMAGING_E: 'Efficacy Imaging',
  FUNCTION: 'Functional Assessments',
  IP_ADMIN: 'Drug Administration',
  DOSING: 'Dose Management',
  PK_SAMP: 'PK Sampling',
  ADA: 'Immunogenicity',
  QOL: 'Quality of Life',
  SYMPTOM: 'Symptom & Function Scales',
};

/**
 * InlineProcedureSearch — renders as a <tr> in the SOA grid table.
 *
 * Provides an inline autocomplete search field with fuzzy matching against
 * the CDISC procedure library.  Results are grouped into "In this category"
 * and "Other categories", with source badges (CDISC / Company / Custom).
 */
export default function InlineProcedureSearch({
  activityGroupId,
  soaGroupId,
  parentSgColors,
  procedureLibrary,
  addedActivityNames,
  onAddProcedure,
  onCreateCustom,
  onClose,
  totalEncounterCols,
}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  const categoryName = ACTIVITY_GROUP_NAMES[activityGroupId] || activityGroupId;

  // Build flat procedure list from library
  const allProcedures = useMemo(() => {
    if (!procedureLibrary) return [];
    const core = procedureLibrary.coreProcedures || [];
    let taProcs = [];
    Object.values(procedureLibrary.taProcedures || {}).forEach((procs) => {
      taProcs = taProcs.concat(procs);
    });
    return [...core, ...taProcs];
  }, [procedureLibrary]);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Debounce query input (150ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setHighlightIdx(-1);
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Click-outside-to-close
  useEffect(() => {
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Fuzzy search results
  const results = useMemo(() => {
    return fuzzySearchProcedures(debouncedQuery, allProcedures, {
      targetActivityGroupId: activityGroupId,
      addedNames: addedActivityNames,
      limit: 20,
    });
  }, [debouncedQuery, allProcedures, activityGroupId, addedActivityNames]);

  // Split results into "in category" and "other"
  const { inCategory, otherCategory } = useMemo(() => {
    const inCat = results.filter((r) => r.isInCategory);
    const other = results.filter((r) => !r.isInCategory);
    return { inCategory: inCat, otherCategory: other };
  }, [results]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => [...inCategory, ...otherCategory], [inCategory, otherCategory]);

  // Handle procedure add
  const handleAdd = useCallback(
    (proc) => {
      if (addedActivityNames.has((proc.name || '').toLowerCase())) return;
      onAddProcedure({
        name: proc.name,
        category: proc.uiCategory,
        uiCategory: proc.uiCategory,
        sdtmDomain: proc.sdtmDomain,
        catalogId: proc.id || proc.catalogId,
        nciCode: proc.nciCode || null,
        definition: proc.definition,
        shortName: proc.shortName,
        source: proc.source || 'Procedure Library',
        therapeuticArea: proc.therapeuticArea,
        isCore: proc.isCore,
        soaGroupId: soaGroupId || proc.soaGroupId || null,
        activityGroupId: activityGroupId || proc.activityGroupId || null,
      });
    },
    [onAddProcedure, addedActivityNames, soaGroupId, activityGroupId]
  );

  // Keyboard navigation
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, flatResults.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < flatResults.length) {
        const r = flatResults[highlightIdx];
        if (!r.isAdded) handleAdd(r.procedure);
      } else if (debouncedQuery.trim()) {
        // Enter with no selection = create custom
        onCreateCustom({
          name: debouncedQuery.trim(),
          activityGroupId,
          soaGroupId,
        });
        onClose();
      }
      return;
    }
  }

  const showDropdown = results.length > 0 || debouncedQuery.trim().length > 0;

  return (
    <tr>
      <td
        colSpan={totalEncounterCols + 2}
        className="border-b border-gray-200 p-0"
        style={{ backgroundColor: parentSgColors?.colorBg ? `${parentSgColors.colorBg}40` : '#FAFAFA' }}
      >
        <div ref={containerRef} className="relative px-4 py-2 pl-10">
          {/* Search input */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Search procedures to add to ${categoryName}...`}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                         bg-white shadow-sm"
            />
            <button
              onClick={onClose}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400
                         hover:text-gray-600 transition-colors rounded"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Results dropdown */}
          {showDropdown && (
            <div className="absolute left-4 right-4 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg
                            max-h-72 overflow-y-auto z-50">
              {/* "In this category" section */}
              {inCategory.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 sticky top-0">
                    In {categoryName}
                  </div>
                  {inCategory.map((r, idx) => (
                    <ResultRow
                      key={r.procedure.id || r.procedure.name}
                      result={r}
                      isHighlighted={idx === highlightIdx}
                      onAdd={() => handleAdd(r.procedure)}
                    />
                  ))}
                </>
              )}

              {/* "Other categories" section */}
              {otherCategory.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 border-t sticky top-0">
                    Other Categories
                  </div>
                  {otherCategory.map((r, idx) => (
                    <ResultRow
                      key={r.procedure.id || r.procedure.name}
                      result={r}
                      isHighlighted={inCategory.length + idx === highlightIdx}
                      onAdd={() => handleAdd(r.procedure)}
                    />
                  ))}
                </>
              )}

              {/* No results state */}
              {results.length === 0 && debouncedQuery.trim().length > 0 && (
                <div className="px-3 py-4 text-center text-sm text-gray-400">
                  No procedures match "{debouncedQuery}"
                </div>
              )}

              {/* Create custom fallback */}
              {debouncedQuery.trim().length > 0 && (
                <button
                  onClick={() => {
                    onCreateCustom({
                      name: debouncedQuery.trim(),
                      activityGroupId,
                      soaGroupId,
                    });
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50
                             border-t border-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>
                    Create "<span className="font-medium">{debouncedQuery.trim()}</span>" as custom procedure
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Single result row in the inline autocomplete dropdown.
 */
function ResultRow({ result, isHighlighted, onAdd }) {
  const { procedure: proc, isAdded } = result;
  const badge = getSourceBadge(proc);

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0 ${
        isHighlighted ? 'bg-indigo-50' : 'hover:bg-gray-50'
      } ${isAdded ? 'opacity-50' : ''}`}
      onClick={() => { if (!isAdded) onAdd(); }}
      title={proc.definition || proc.name}
    >
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${isAdded ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {proc.name}
          </span>
          {/* SDTM domain badge */}
          {proc.sdtmDomain && (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 text-gray-500">
              {proc.sdtmDomain}
            </span>
          )}
          {/* Source badge */}
          <span className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.bgClass} ${badge.textClass}`}>
            {badge.label === 'CDISC' && (
              <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {badge.label}
          </span>
        </div>
        {/* Definition snippet */}
        {proc.definition && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5 max-w-lg">
            {proc.definition}
          </p>
        )}
      </div>

      {/* Add button or added indicator */}
      <div className="flex-shrink-0">
        {isAdded ? (
          <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-0.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Added
          </span>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100
                       flex items-center justify-center transition-colors"
            title="Add to schedule"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
