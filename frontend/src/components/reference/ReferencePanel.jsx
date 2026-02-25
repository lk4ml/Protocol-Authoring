import React, { useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import useReferenceStore from '../../store/useReferenceStore';
import DesignReferenceView from './DesignReferenceView';
import EligibilityReferenceView from './EligibilityReferenceView';
import EndpointsReferenceView from './EndpointsReferenceView';
import SOAReferenceView from './SOAReferenceView';

/**
 * ReferencePanel — Slide-out side panel showing reference trial data.
 *
 * Features:
 *   • Trial tabs at top (switch between multiple references)
 *   • Contextual views based on current module route
 *   • Inline "Add Trial" form
 *   • × to remove trials
 */
export default function ReferencePanel() {
  const { id: protocolId } = useParams();
  const location = useLocation();

  const trials = useReferenceStore((s) => s.trials);
  const activeTrialId = useReferenceStore((s) => s.activeTrialId);
  const panelContext = useReferenceStore((s) => s.panelContext);
  const fetchingNct = useReferenceStore((s) => s.fetchingNct);
  const closePanel = useReferenceStore((s) => s.closePanel);
  const setActiveTrialId = useReferenceStore((s) => s.setActiveTrialId);
  const fetchAndAddTrial = useReferenceStore((s) => s.fetchAndAddTrial);
  const removeTrial = useReferenceStore((s) => s.removeTrial);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addNctId, setAddNctId] = useState('');
  const [addError, setAddError] = useState('');
  const inputRef = useRef(null);

  // Auto-detect context from URL if not explicitly set
  const path = location.pathname;
  let effectiveContext = panelContext || 'design';
  if (!panelContext) {
    if (path.includes('/eligibility')) effectiveContext = 'eligibility';
    else if (path.includes('/endpoints')) effectiveContext = 'endpoints';
    else if (path.includes('/soa')) effectiveContext = 'soa';
    else effectiveContext = 'design';
  }

  const activeTrial = trials.find((t) => t.nctId === activeTrialId) || trials[0] || null;

  const contextLabels = {
    design: 'Study Design',
    eligibility: 'Eligibility Criteria',
    endpoints: 'Endpoints & Outcomes',
    soa: 'Schedule of Activities',
  };

  async function handleAddTrial() {
    if (!addNctId.trim()) return;
    setAddError('');
    try {
      await fetchAndAddTrial(addNctId, protocolId);
      setAddNctId('');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err.message || 'Failed to fetch trial.');
    }
  }

  function handleRemoveTrial(nctId) {
    removeTrial(nctId, protocolId);
  }

  // Spinner
  const Spinner = () => (
    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="w-[420px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden shadow-lg">
      {/* ── Panel Header ─────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-gray-50">
        {/* Top bar with title and close */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <h3 className="text-sm font-bold text-gray-800">Reference Trials</h3>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold">
              {trials.length}
            </span>
          </div>
          <button
            onClick={closePanel}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
            title="Close panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Trial tabs */}
        <div className="flex items-center px-3 pb-2 gap-1.5 overflow-x-auto">
          {trials.map((trial) => {
            const isActive = trial.nctId === (activeTrial?.nctId);
            return (
              <div
                key={trial.nctId}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-all whitespace-nowrap group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
                onClick={() => setActiveTrialId(trial.nctId)}
              >
                <span className="truncate max-w-[100px]">{trial.nctId}</span>
                {trial.sponsorName && (
                  <span className={`truncate max-w-[60px] ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>
                    ({trial.sponsorName.split(' ')[0]})
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveTrial(trial.nctId); }}
                  className={`shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
                    isActive
                      ? 'text-indigo-200 hover:text-white hover:bg-indigo-500'
                      : 'text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Add button */}
          <button
            onClick={() => { setShowAddForm(!showAddForm); setTimeout(() => inputRef.current?.focus(), 100); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors text-[10px] font-semibold whitespace-nowrap"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add
          </button>
        </div>

        {/* Inline add form */}
        {showAddForm && (
          <div className="px-3 pb-2.5">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-indigo-200 p-2">
              <input
                ref={inputRef}
                type="text"
                value={addNctId}
                onChange={(e) => setAddNctId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTrial()}
                placeholder="NCT ID, e.g. NCT02998528"
                className="flex-1 px-2 py-1 text-xs border-none outline-none bg-transparent placeholder:text-gray-400"
              />
              <button
                onClick={handleAddTrial}
                disabled={fetchingNct}
                className="px-3 py-1 bg-indigo-600 text-white rounded text-[10px] font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {fetchingNct ? <Spinner /> : 'Fetch'}
              </button>
            </div>
            {addError && (
              <p className="text-[10px] text-red-500 mt-1 px-1">{addError}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Context indicator ───────────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {contextLabels[effectiveContext] || 'Reference'}
        </span>
        {activeTrial && (
          <span className="text-[10px] text-indigo-500 font-medium">
            {activeTrial.nctId}
          </span>
        )}
      </div>

      {/* ── Trial Summary (brief) ───────────────────────────────────── */}
      {activeTrial && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">
            {activeTrial.briefTitle}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {activeTrial.phase && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[9px] font-semibold">
                {activeTrial.phase}
              </span>
            )}
            {activeTrial.sponsorName && (
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px] font-semibold">
                {activeTrial.sponsorName}
              </span>
            )}
            {activeTrial.enrollment && (
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px] font-semibold">
                n={activeTrial.enrollment}
              </span>
            )}
            {activeTrial.overallStatus && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                activeTrial.overallStatus === 'Completed' ? 'bg-green-50 text-green-700' :
                activeTrial.overallStatus === 'Recruiting' ? 'bg-blue-50 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {activeTrial.overallStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Contextual Content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!activeTrial ? (
          <div className="text-center py-12">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <p className="text-xs text-gray-400">No reference trials loaded.</p>
            <p className="text-[10px] text-gray-300 mt-1">Click "+ Add" above to fetch a trial from ClinicalTrials.gov.</p>
          </div>
        ) : (
          <>
            {effectiveContext === 'design' && <DesignReferenceView trial={activeTrial} />}
            {effectiveContext === 'eligibility' && <EligibilityReferenceView trial={activeTrial} />}
            {effectiveContext === 'endpoints' && <EndpointsReferenceView trial={activeTrial} />}
            {effectiveContext === 'soa' && <SOAReferenceView trial={activeTrial} />}
          </>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
        <span className="text-[9px] text-gray-400">Data from ClinicalTrials.gov API v2</span>
        <span className="text-[9px] text-gray-400">Right-click items for details</span>
      </div>
    </div>
  );
}
