import React, { useState, useMemo } from 'react';
import client from '../../../api/client';

/**
 * SOA Group metadata for display (matches ProcedurePicker & SOAModule).
 */
const SOA_GROUP_META = {
  ADMIN:     { name: 'Administrative',                    colorBg: '#F1F5F9', colorText: '#334155', colorBorder: '#CBD5E1' },
  SAFETY:    { name: 'Safety Assessments',                colorBg: '#FEF2F2', colorText: '#991B1B', colorBorder: '#FECACA' },
  EFFICACY:  { name: 'Efficacy Assessments',              colorBg: '#F0FDF4', colorText: '#166534', colorBorder: '#BBF7D0' },
  TREATMENT: { name: 'Study Treatment',                   colorBg: '#ECFEFF', colorText: '#155E75', colorBorder: '#A5F3FC' },
  PK:        { name: 'Pharmacokinetics / Immunogenicity',  colorBg: '#FFF1F2', colorText: '#9F1239', colorBorder: '#FECDD3' },
  PRO:       { name: 'Patient-Reported Outcomes',          colorBg: '#F5F3FF', colorText: '#5B21B6', colorBorder: '#DDD6FE' },
};

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

const SOA_GROUP_ORDER = ['ADMIN', 'SAFETY', 'EFFICACY', 'TREATMENT', 'PK', 'PRO'];

/**
 * TrialImporter — Fetch a real clinical trial by NCT ID, preview the suggested
 * SOA procedures, and import them into the Schedule of Activities.
 */
export default function TrialImporter({ onImport, onClose, addedActivityNames }) {
  const [nctId, setNctId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [importVisits, setImportVisits] = useState(true);

  // ── Fetch SOA suggestion from backend ─────────────────────────────────

  async function handleFetch() {
    const cleaned = nctId.trim().toUpperCase();
    if (!cleaned || !cleaned.startsWith('NCT')) {
      setError('Please enter a valid NCT ID (e.g., NCT02362594)');
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const resp = await client.get(`/ctgov/suggest-soa/${cleaned}`);
      const data = resp.data;
      setSuggestion(data);

      // Pre-select all procedures
      const ids = new Set(
        (data.suggestedProcedures || []).map((p) => p.id).filter(Boolean)
      );
      setSelectedIds(ids);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to fetch trial data';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }

  // ── Group procedures by SOA hierarchy ─────────────────────────────────

  const groupedProcedures = useMemo(() => {
    if (!suggestion?.suggestedProcedures) return [];

    const tree = {};
    suggestion.suggestedProcedures.forEach((proc) => {
      const sg = proc.soaGroupId || 'SAFETY';
      const ag = proc.activityGroupId || 'CLINICAL';
      if (!tree[sg]) tree[sg] = {};
      if (!tree[sg][ag]) tree[sg][ag] = [];
      tree[sg][ag].push(proc);
    });

    return SOA_GROUP_ORDER
      .filter((sgId) => tree[sgId])
      .map((sgId) => ({
        id: sgId,
        meta: SOA_GROUP_META[sgId] || { name: sgId, colorBg: '#F3F4F6', colorText: '#374151', colorBorder: '#D1D5DB' },
        activityGroups: Object.entries(tree[sgId]).map(([agId, procs]) => ({
          id: agId,
          name: ACTIVITY_GROUP_NAMES[agId] || agId,
          procedures: procs,
        })),
      }));
  }, [suggestion]);

  // ── Selection helpers ─────────────────────────────────────────────────

  function toggleProc(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const ids = new Set(
      (suggestion?.suggestedProcedures || []).map((p) => p.id).filter(Boolean)
    );
    setSelectedIds(ids);
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function isAlreadyAdded(proc) {
    if (!addedActivityNames) return false;
    return addedActivityNames.has((proc.name || '').toLowerCase());
  }

  // ── Import handler ────────────────────────────────────────────────────

  function handleImport() {
    if (!suggestion) return;

    const procedures = suggestion.suggestedProcedures
      .filter((p) => selectedIds.has(p.id) && !isAlreadyAdded(p))
      .map((p) => ({
        name: p.name,
        category: p.uiCategory,
        uiCategory: p.uiCategory,
        sdtmDomain: p.sdtmDomain,
        catalogId: p.id,
        nciCode: p.nciCode || null,
        definition: p.definition,
        shortName: p.shortName,
        source: p.source || 'CDISC Library API',
        soaGroupId: p.soaGroupId || null,
        activityGroupId: p.activityGroupId || null,
      }));

    const visits = importVisits
      ? (suggestion.suggestedVisits || []).map((v) => ({
          name: v.name,
          week: v.week,
          studyDay: v.studyDay,
          epochName: v.epoch,
        }))
      : [];

    onImport({
      procedures,
      visits,
      trialInfo: suggestion.trialInfo,
      therapeuticArea: suggestion.therapeuticArea,
    });
  }

  const selectedCount = selectedIds.size;
  const totalCount = suggestion?.suggestedProcedures?.length || 0;
  const alreadyAddedCount = (suggestion?.suggestedProcedures || []).filter((p) => isAlreadyAdded(p)).length;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-4.5 h-4.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Import SOA from ClinicalTrials.gov
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter an NCT ID to auto-generate a Schedule of Activities based on a real clinical trial
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* NCT ID Input */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={nctId}
              onChange={(e) => setNctId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              placeholder="NCT02362594"
              className="w-full pl-4 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleFetch}
            disabled={loading || !nctId.trim()}
            className="inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Analyze Trial
              </>
            )}
          </button>
        </div>

        {/* Quick examples */}
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-[10px] text-gray-400 py-0.5">Try:</span>
          {[
            { id: 'NCT02362594', label: 'KEYNOTE-054 (Melanoma)' },
            { id: 'NCT02578680', label: 'KEYNOTE-189 (NSCLC)' },
            { id: 'NCT01050868', label: 'EMPA-REG (Diabetes)' },
            { id: 'NCT04368728', label: 'RECOVERY (COVID)' },
          ].map((ex) => (
            <button
              key={ex.id}
              onClick={() => { setNctId(ex.id); setSuggestion(null); setError(null); }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {suggestion && (
        <>
          {/* Trial Info Banner */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h5 className="text-sm font-semibold text-gray-900 truncate">
                  {suggestion.trialInfo?.briefTitle || suggestion.trialInfo?.nctId}
                </h5>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                    {suggestion.trialInfo?.nctId}
                  </span>
                  {suggestion.phase && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                      {suggestion.phase}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                    {suggestion.therapeuticArea}
                  </span>
                  {suggestion.isRandomized && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                      Randomized ({suggestion.numberOfArms}-arm)
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {suggestion.trialInfo?.sponsor}
                  </span>
                </div>
                {(suggestion.trialInfo?.conditions || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {suggestion.trialInfo.conditions.map((c, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 ml-4 text-right">
                <div className="text-2xl font-bold text-indigo-600">{totalCount}</div>
                <div className="text-[10px] text-gray-500">procedures</div>
              </div>
            </div>
          </div>

          {/* Selection toolbar */}
          <div className="px-5 py-2 bg-white border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600 font-medium">
                {selectedCount} of {totalCount} selected
                {alreadyAddedCount > 0 && (
                  <span className="text-gray-400 ml-1">({alreadyAddedCount} already in SOA)</span>
                )}
              </span>
              <button onClick={selectAll} className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium">
                Select All
              </button>
              <button onClick={deselectAll} className="text-[10px] text-gray-500 hover:text-gray-700 font-medium">
                Deselect All
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={importVisits}
                onChange={(e) => setImportVisits(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
              />
              Include suggested visits
            </label>
          </div>

          {/* Procedure list grouped by SOA hierarchy */}
          <div className="px-5 pb-3 max-h-[400px] overflow-y-auto">
            <div className="space-y-2 mt-2">
              {groupedProcedures.map((soaGroup) => {
                const { meta } = soaGroup;
                const groupProcs = soaGroup.activityGroups.flatMap((ag) => ag.procedures);
                const groupSelected = groupProcs.filter((p) => selectedIds.has(p.id)).length;

                return (
                  <div
                    key={soaGroup.id}
                    className="rounded-lg overflow-hidden border"
                    style={{ borderColor: meta.colorBorder }}
                  >
                    {/* SOA Group Header */}
                    <div
                      className="flex items-center justify-between px-3 py-2"
                      style={{ backgroundColor: meta.colorBg }}
                    >
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.colorText }}>
                        {meta.name}
                      </span>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: meta.colorBorder, color: meta.colorText }}
                      >
                        {groupSelected}/{groupProcs.length}
                      </span>
                    </div>

                    {/* Activity Groups */}
                    {soaGroup.activityGroups.map((ag) => (
                      <div key={ag.id}>
                        <div
                          className="flex items-center justify-between px-4 py-1 border-t"
                          style={{
                            backgroundColor: `${meta.colorBg}90`,
                            borderColor: `${meta.colorBorder}80`,
                          }}
                        >
                          <span className="text-[11px] font-semibold" style={{ color: meta.colorText }}>
                            {ag.name}
                          </span>
                        </div>

                        {/* Procedure rows */}
                        <div className="divide-y divide-gray-100">
                          {ag.procedures.map((proc) => {
                            const checked = selectedIds.has(proc.id);
                            const alreadyAdded = isAlreadyAdded(proc);

                            return (
                              <label
                                key={proc.id}
                                className={`flex items-center px-4 py-1.5 transition-colors cursor-pointer ${
                                  alreadyAdded
                                    ? 'bg-gray-50 opacity-50'
                                    : checked
                                    ? 'bg-indigo-50/30'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked && !alreadyAdded}
                                  disabled={alreadyAdded}
                                  onChange={() => toggleProc(proc.id)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 mr-3"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-800 font-medium truncate">
                                      {proc.name}
                                    </span>
                                    {proc.sdtmDomain && (
                                      <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                                        {proc.sdtmDomain}
                                      </span>
                                    )}
                                    {alreadyAdded && (
                                      <span className="text-[10px] text-green-600 font-medium flex-shrink-0">
                                        Already added
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {proc._matchReason}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Suggested Visits Preview */}
            {importVisits && suggestion.suggestedVisits?.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h6 className="text-[11px] font-semibold text-gray-600 mb-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  Suggested Visits ({suggestion.suggestedVisits.length})
                </h6>
                <div className="flex flex-wrap gap-1.5">
                  {suggestion.suggestedVisits.map((v, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-gray-200 text-gray-600"
                    >
                      {v.name}
                      {v.week != null && (
                        <span className="ml-1 text-gray-400">W{v.week}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Import button */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              <span className="font-medium">{suggestion.matchStats?.outcomeKeywords?.length || 0}</span> outcome signals detected
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="inline-flex items-center px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Import {selectedCount - alreadyAddedCount} Procedures
                {importVisits && suggestion.suggestedVisits?.length > 0 && (
                  <span className="ml-1 opacity-75">+ {suggestion.suggestedVisits.length} Visits</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
