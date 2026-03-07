import React, { useState, useEffect } from 'react';
import useProtocolStore from '../../store/useProtocolStore';
import useReferenceStore from '../../store/useReferenceStore';
import { parseCtGovResponse } from '../../utils/parseCtGovTrial';
import * as referencesApi from '../../api/references';

/* ─── Spinner ──────────────────────────────────────────────────────────── */
const Spinner = ({ className = 'h-4 w-4 text-white' }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

/**
 * StudyPicker — compact study creation / selection.
 *
 * Props:
 *  - onStudyCreated(protocolId)
 *  - onStudySelected(protocolId)
 *  - productName
 *  - accentColor
 */
export default function StudyPicker({ onStudyCreated, onStudySelected, productName, accentColor = 'brand' }) {
  const protocols = useProtocolStore((s) => s.protocols);
  const loadProtocols = useProtocolStore((s) => s.loadProtocols);
  const createProtocol = useProtocolStore((s) => s.createProtocol);

  const [mode, setMode] = useState('new');
  const [studyName, setStudyName] = useState('');
  const [phase, setPhase] = useState('');
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [nctId, setNctId] = useState('');
  const [nctLoading, setNctLoading] = useState(false);
  const [nctPreviews, setNctPreviews] = useState([]);
  const [nctError, setNctError] = useState('');

  useEffect(() => { useReferenceStore.getState().reset(); }, []);
  useEffect(() => { loadProtocols(); }, [loadProtocols]);

  /* ── Handlers ────────────────────────────────────────────────────────── */
  async function handleQuickCreate(e) {
    e.preventDefault();
    if (!studyName.trim()) { setError('Please enter a study name.'); return; }
    setError('');
    setCreating(true);
    try {
      const newProtocol = await createProtocol({
        protocolNumber: studyName.trim(),
        shortTitle: studyName.trim(),
        fullTitle: '',
        phase,
        therapeuticArea,
        sponsorName: '',
        template: 'blank',
      });
      const pid = newProtocol._id || newProtocol.id;
      onStudyCreated?.(pid);
    } catch (err) {
      setError(err.message || 'Failed to create study.');
    } finally { setCreating(false); }
  }

  async function handleNctFetch() {
    const cleaned = nctId.trim().toUpperCase();
    if (!cleaned) { setNctError('Please enter an NCT ID (e.g., NCT02998528).'); return; }
    if (nctPreviews.some((p) => p.nctId === cleaned)) {
      setNctError(`${cleaned} is already in your reference list.`);
      return;
    }
    setNctError('');
    setNctLoading(true);
    try {
      const json = await referencesApi.fetchStudyFromCtGov(cleaned);
      const parsed = parseCtGovResponse(json, cleaned);
      setNctPreviews((prev) => [...prev, parsed]);
      setNctId('');
    } catch (err) {
      setNctError(err.message || 'Failed to fetch trial data.');
    } finally { setNctLoading(false); }
  }

  function handleRemovePreview(nctIdToRemove) {
    setNctPreviews((prev) => prev.filter((p) => p.nctId !== nctIdToRemove));
  }

  async function handleCreateWithReferences() {
    if (nctPreviews.length === 0) return;
    setCreating(true);
    setError('');
    try {
      const first = nctPreviews[0];
      const newProtocol = await createProtocol({
        protocolNumber: studyName.trim() || first.nctId,
        shortTitle: studyName.trim() || first.briefTitle,
        fullTitle: first.officialTitle || '',
        phase: first.phase || '',
        therapeuticArea: first.conditions?.join(', ') || '',
        sponsorName: first.sponsorName || '',
        template: 'blank',
      });
      const protocolId = newProtocol._id || newProtocol.id;
      for (const trial of nctPreviews) {
        try { await referencesApi.addReference(protocolId, trial); } catch { /* dup ok */ }
      }
      onStudyCreated?.(protocolId);
    } catch (err) {
      setError(err.message || 'Failed to create study.');
    } finally { setCreating(false); }
  }

  function phaseColor(p) {
    if (!p) return 'bg-gray-100 text-gray-600';
    const lc = p.toLowerCase();
    if (lc.includes('1')) return 'bg-blue-50 text-blue-700';
    if (lc.includes('2')) return 'bg-purple-50 text-purple-700';
    if (lc.includes('3')) return 'bg-brand-50 text-brand-700';
    if (lc.includes('4')) return 'bg-green-50 text-green-700';
    return 'bg-gray-100 text-gray-600';
  }

  const studyCount = protocols?.length || 0;
  const ctaLabel = productName ? `Open ${productName}` : 'Create & Open';

  /* ═══════════════════════════════════════════════════════════════════════
   *  RENDER
   * ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">

      {/* ── Create Card ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Mode tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          {[
            { key: 'new', label: 'New Study', icon: (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )},
            { key: 'nct', label: 'Import from ClinicalTrials.gov', icon: (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
            )},
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setMode(tab.key); setNctError(''); setError(''); }}
              className={`flex-1 px-4 py-3 text-xs font-semibold transition-all relative flex items-center justify-center gap-1.5 ${
                mode === tab.key
                  ? 'text-brand-700 bg-white'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {mode === tab.key && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-brand-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {/* ── NEW STUDY ─────────────────────────────────────── */}
          {mode === 'new' && (
            <form onSubmit={handleQuickCreate} className="space-y-4">
              {error && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Study Name / Protocol Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={studyName}
                  onChange={(e) => setStudyName(e.target.value)}
                  placeholder="e.g., BEACON-3 or ONCO-2025-001"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow placeholder:text-gray-300 bg-gray-50/50 focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phase</label>
                  <select
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-gray-50/50 focus:bg-white"
                  >
                    <option value="">Select phase...</option>
                    <option value="Phase 1">Phase 1</option>
                    <option value="Phase 1/Phase 2">Phase 1/2</option>
                    <option value="Phase 2">Phase 2</option>
                    <option value="Phase 2/Phase 3">Phase 2/3</option>
                    <option value="Phase 3">Phase 3</option>
                    <option value="Phase 4">Phase 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Therapeutic Area</label>
                  <input
                    type="text"
                    value={therapeuticArea}
                    onChange={(e) => setTherapeuticArea(e.target.value)}
                    placeholder="e.g., Oncology"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow placeholder:text-gray-300 bg-gray-50/50 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {creating ? (
                  <><Spinner className="h-4 w-4 text-white" /> Creating...</>
                ) : (
                  <>
                    {ctaLabel}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── NCT IMPORT ────────────────────────────────────── */}
          {mode === 'nct' && (
            <div className="space-y-4">
              {(nctError || error) && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {nctError || error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fetch Reference Trials</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={nctId}
                      onChange={(e) => setNctId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNctFetch()}
                      placeholder="Enter NCT ID, e.g. NCT02998528"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow placeholder:text-gray-300 bg-gray-50/50 focus:bg-white"
                    />
                    <svg className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                  <button
                    type="button"
                    onClick={handleNctFetch}
                    disabled={nctLoading}
                    className="px-5 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-all shadow-sm min-w-[80px] flex items-center justify-center"
                  >
                    {nctLoading ? <Spinner /> : 'Fetch'}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-gray-400">Try:</span>
                  {['NCT02998528', 'NCT03521154', 'NCT05060016'].map((id) => (
                    <button
                      key={id}
                      onClick={() => setNctId(id)}
                      className="text-[11px] text-brand-500 hover:text-brand-700 font-medium hover:underline transition-colors px-1.5 py-0.5 rounded hover:bg-brand-50"
                    >
                      {id}
                    </button>
                  ))}
                  {nctPreviews.length > 0 && (
                    <span className="ml-auto text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {nctPreviews.length} trial{nctPreviews.length > 1 ? 's' : ''} loaded
                    </span>
                  )}
                </div>
              </div>

              {/* Protocol name override */}
              {nctPreviews.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Your Protocol Name <span className="text-gray-300 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={studyName}
                    onChange={(e) => setStudyName(e.target.value)}
                    placeholder={nctPreviews[0]?.nctId || 'Leave blank to use NCT ID'}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow placeholder:text-gray-300 bg-gray-50/50 focus:bg-white"
                  />
                </div>
              )}

              {/* Preview cards */}
              {nctPreviews.length > 0 && (
                <div className="space-y-2">
                  {nctPreviews.map((trial) => (
                    <div key={trial.nctId} className="rounded-lg border border-gray-200 bg-gray-50/60 overflow-hidden hover:border-brand-200 transition-colors">
                      <div className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold text-brand-600">{trial.nctId}</span>
                            {trial.sponsorName && (
                              <span className="text-[11px] text-gray-400">· {trial.sponsorName}</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">
                            {trial.briefTitle}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {trial.phase && (
                              <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold">{trial.phase}</span>
                            )}
                            {trial.designInfo?.interventionModel && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-medium">{trial.designInfo.interventionModel}</span>
                            )}
                            {trial.enrollment && (
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">n={trial.enrollment}</span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-medium">
                              {trial.arms?.length || 0} arms
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-medium">
                              {(trial.outcomes?.primary?.length || 0) + (trial.outcomes?.secondary?.length || 0)} endpoints
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemovePreview(trial.nctId)}
                          className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* 3-column preview */}
                      <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-white/60">
                        {[
                          { label: 'Arms', items: trial.arms?.map(a => a.label) },
                          { label: 'Interventions', items: trial.interventions?.map(i => i.name) },
                          { label: 'Primary Endpoints', items: trial.outcomes?.primary?.map(o => o.measure) },
                        ].map((col) => (
                          <div key={col.label} className="px-3 py-2">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{col.label}</p>
                            {col.items?.slice(0, 3).map((item, i) => (
                              <p key={i} className="text-[11px] text-gray-600 truncate">{item}</p>
                            ))}
                            {(col.items?.length || 0) > 3 && (
                              <p className="text-[9px] text-gray-400">+{col.items.length - 3} more</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleCreateWithReferences}
                    disabled={creating}
                    className="w-full px-5 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <><Spinner className="h-4 w-4 text-white" /> Creating...</>
                    ) : (
                      <>
                        Create Protocol with {nctPreviews.length} Reference{nctPreviews.length > 1 ? 's' : ''}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Empty state */}
              {nctPreviews.length === 0 && !nctLoading && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    Import trials from ClinicalTrials.gov as references
                  </p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    See how other sponsors designed their arms, endpoints, and eligibility. Use them as a starting point.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
       *  YOUR STUDIES
       * ═══════════════════════════════════════════════════════════════════ */}
      {studyCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {productName ? 'Select a Study' : 'Your Studies'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {productName
                  ? `Click any study to open it in ${productName}`
                  : `${studyCount} ${studyCount === 1 ? 'study' : 'studies'} saved`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {protocols.map((p) => {
              const id = p._id || p.id;
              return (
                <button
                  key={id}
                  onClick={() => onStudySelected?.(id)}
                  className="group text-left bg-white rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all duration-200">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    </div>

                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-brand-700 transition-colors truncate">
                      {p.protocolNumber || 'Untitled Study'}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {p.shortTitle || p.fullTitle || 'No title provided'}
                    </p>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.phase && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${phaseColor(p.phase)}`}>
                          {p.phase}
                        </span>
                      )}
                      {p.therapeuticArea && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                          {p.therapeuticArea}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state only when no studies */}
      {studyCount === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">No studies yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first study above to get started.</p>
        </div>
      )}
    </div>
  );
}
