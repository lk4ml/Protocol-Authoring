import React, { useState, useMemo } from 'react';
import useDesignStore from '../../store/useDesignStore';
import useReferenceStore from '../../store/useReferenceStore';
import ReferenceToggleButton from '../reference/ReferenceToggleButton';

/**
 * EligibilityModule - Inclusion and Exclusion criteria editor with
 * recommendations from reference NCT trials.
 *
 * Features:
 * - Green/red accented I/E editors (ICH M11 Section 4)
 * - When NCT reference trials are present, a collapsible recommendations
 *   panel shows parsed I/E criteria from each trial with one-click adopt
 * - Demographics summary across reference trials
 * - Bulk "adopt all" from a trial, or cherry-pick individual criteria
 */
export default function EligibilityModule() {
  const eligibilityCriteria = useDesignStore((s) => s.eligibilityCriteria) || { inclusion: [], exclusion: [] };
  const setEligibilityCriteria = useDesignStore((s) => s.setEligibilityCriteria);
  const loading = useDesignStore((s) => s.loading);

  // Reference trials for recommendations
  const trials = useReferenceStore((s) => s.trials);

  const inclusionCriteria = eligibilityCriteria.inclusion || [];
  const exclusionCriteria = eligibilityCriteria.exclusion || [];

  // Recommendations panel state
  const [recsOpen, setRecsOpen] = useState(true);
  const [activeTrialIdx, setActiveTrialIdx] = useState(0);
  const [adoptedKeys, setAdoptedKeys] = useState(new Set());

  // Compute which reference trials have eligibility data
  const trialsWithElig = useMemo(() => {
    return (trials || []).filter(
      (t) =>
        t.eligibility &&
        ((t.eligibility.inclusion?.length > 0) || (t.eligibility.exclusion?.length > 0))
    );
  }, [trials]);

  // Existing criteria texts for dedup
  const existingIncTexts = useMemo(
    () => new Set(inclusionCriteria.map((c) => (typeof c === 'string' ? c : c.text).trim().toLowerCase())),
    [inclusionCriteria]
  );
  const existingExcTexts = useMemo(
    () => new Set(exclusionCriteria.map((c) => (typeof c === 'string' ? c : c.text).trim().toLowerCase())),
    [exclusionCriteria]
  );

  // ── CRUD helpers ──────────────────────────────────────────────────────
  function addCriterion(type) {
    const updated = { ...eligibilityCriteria };
    const list = [...(updated[type] || [])];
    list.push({ id: `${type}_${Date.now()}`, text: '' });
    updated[type] = list;
    setEligibilityCriteria(updated);
  }

  function updateCriterion(type, index, text) {
    const updated = { ...eligibilityCriteria };
    const list = [...(updated[type] || [])];
    list[index] = { ...list[index], text };
    updated[type] = list;
    setEligibilityCriteria(updated);
  }

  function removeCriterion(type, index) {
    const updated = { ...eligibilityCriteria };
    const list = [...(updated[type] || [])];
    list.splice(index, 1);
    updated[type] = list;
    setEligibilityCriteria(updated);
  }

  // ── Adopt from reference trial ────────────────────────────────────────
  function adoptCriterion(text, type) {
    const key = `${type}::${text.slice(0, 60)}`;
    const existingSet = type === 'inclusion' ? existingIncTexts : existingExcTexts;
    if (existingSet.has(text.trim().toLowerCase())) {
      // Already exists — just mark as adopted
      setAdoptedKeys((prev) => new Set([...prev, key]));
      return;
    }
    const updated = { ...eligibilityCriteria };
    const list = [...(updated[type] || [])];
    list.push({
      id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
    });
    updated[type] = list;
    setEligibilityCriteria(updated);
    setAdoptedKeys((prev) => new Set([...prev, key]));
  }

  function adoptAll(type, trialIdx) {
    const trial = trialsWithElig[trialIdx];
    if (!trial) return;
    const criteria = type === 'inclusion' ? trial.eligibility.inclusion : trial.eligibility.exclusion;
    if (!criteria?.length) return;

    const updated = { ...eligibilityCriteria };
    const list = [...(updated[type] || [])];
    const existingSet = type === 'inclusion' ? existingIncTexts : existingExcTexts;
    const newKeys = new Set();

    criteria.forEach((text) => {
      const key = `${type}::${text.slice(0, 60)}`;
      newKeys.add(key);
      if (!existingSet.has(text.trim().toLowerCase())) {
        list.push({
          id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text,
        });
      }
    });

    updated[type] = list;
    setEligibilityCriteria(updated);
    setAdoptedKeys((prev) => new Set([...prev, ...newKeys]));
  }

  function isAdopted(text, type) {
    const key = `${type}::${text.slice(0, 60)}`;
    if (adoptedKeys.has(key)) return true;
    const existingSet = type === 'inclusion' ? existingIncTexts : existingExcTexts;
    return existingSet.has(text.trim().toLowerCase());
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-gray-500">Loading protocol...</p>
        </div>
      </div>
    );
  }

  const activeTrial = trialsWithElig[activeTrialIdx] || null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Eligibility Criteria</h2>
          <p className="text-sm text-gray-500 mt-1">
            Define inclusion and exclusion criteria for trial population (ICH M11 Section 4)
          </p>
        </div>
        <ReferenceToggleButton context="eligibility" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
       *  RECOMMENDATIONS FROM REFERENCE TRIALS
       * ══════════════════════════════════════════════════════════════════ */}
      {trialsWithElig.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
          {/* Header */}
          <button
            onClick={() => setRecsOpen(!recsOpen)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-indigo-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-indigo-900">
                  Recommendations from Reference Trials
                </h3>
                <p className="text-[11px] text-indigo-500">
                  {trialsWithElig.length} reference trial{trialsWithElig.length > 1 ? 's' : ''} with eligibility criteria — click to adopt
                </p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-indigo-400 transition-transform ${recsOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {recsOpen && (
            <div className="border-t border-indigo-200">
              {/* Trial tabs */}
              {trialsWithElig.length > 1 && (
                <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
                  {trialsWithElig.map((t, idx) => (
                    <button
                      key={t.nctId}
                      onClick={() => setActiveTrialIdx(idx)}
                      className={`shrink-0 px-3 py-1.5 rounded-t-lg text-[11px] font-semibold transition-colors ${
                        idx === activeTrialIdx
                          ? 'bg-white text-indigo-700 border border-b-0 border-indigo-200'
                          : 'text-gray-500 hover:text-indigo-600 hover:bg-white/50'
                      }`}
                    >
                      {t.nctId}
                    </button>
                  ))}
                </div>
              )}

              {activeTrial && (
                <div className="px-5 py-4 space-y-4">
                  {/* Trial brief info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">
                        {activeTrial.briefTitle}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {activeTrial.phase && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-semibold">{activeTrial.phase}</span>
                        )}
                        {activeTrial.sponsorName && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px] font-semibold">{activeTrial.sponsorName}</span>
                        )}
                        {activeTrial.enrollment && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px] font-semibold">n={activeTrial.enrollment}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Demographics chips */}
                  {activeTrial.eligibility && (
                    <div className="flex flex-wrap gap-2">
                      {activeTrial.eligibility.sex && activeTrial.eligibility.sex !== 'All' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-semibold">
                          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                          </svg>
                          Sex: {activeTrial.eligibility.sex}
                        </span>
                      )}
                      {activeTrial.eligibility.minimumAge && (
                        <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-semibold">
                          Min Age: {activeTrial.eligibility.minimumAge}
                        </span>
                      )}
                      {activeTrial.eligibility.maximumAge && activeTrial.eligibility.maximumAge !== 'N/A' && (
                        <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-semibold">
                          Max Age: {activeTrial.eligibility.maximumAge}
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${
                        activeTrial.eligibility.healthyVolunteers
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {activeTrial.eligibility.healthyVolunteers ? 'Healthy Volunteers Allowed' : 'Patients Only'}
                      </span>
                    </div>
                  )}

                  {/* Two-column: Inclusion | Exclusion */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Inclusion recommendations */}
                    {activeTrial.eligibility.inclusion?.length > 0 && (
                      <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                        <div className="px-3 py-2 bg-green-50 border-b border-green-200 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">
                            Inclusion ({activeTrial.eligibility.inclusion.length})
                          </span>
                          <button
                            onClick={() => adoptAll('inclusion', activeTrialIdx)}
                            className="px-2 py-0.5 rounded text-[9px] font-bold bg-green-600 text-white hover:bg-green-700 transition-colors"
                          >
                            Adopt All
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                          {activeTrial.eligibility.inclusion.map((criterion, i) => {
                            const adopted = isAdopted(criterion, 'inclusion');
                            return (
                              <div key={i} className="flex items-start gap-2 px-3 py-2 hover:bg-green-50/40 group">
                                <span className="shrink-0 w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[8px] font-bold mt-0.5">
                                  {i + 1}
                                </span>
                                <p className="flex-1 text-[11px] text-gray-700 leading-relaxed">
                                  {criterion}
                                </p>
                                <button
                                  onClick={() => adoptCriterion(criterion, 'inclusion')}
                                  disabled={adopted}
                                  className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                                    adopted
                                      ? 'bg-green-100 text-green-600'
                                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 opacity-0 group-hover:opacity-100'
                                  }`}
                                >
                                  {adopted ? (
                                    <span className="flex items-center gap-0.5">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                      Added
                                    </span>
                                  ) : '+ Adopt'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Exclusion recommendations */}
                    {activeTrial.eligibility.exclusion?.length > 0 && (
                      <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                        <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">
                            Exclusion ({activeTrial.eligibility.exclusion.length})
                          </span>
                          <button
                            onClick={() => adoptAll('exclusion', activeTrialIdx)}
                            className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            Adopt All
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                          {activeTrial.eligibility.exclusion.map((criterion, i) => {
                            const adopted = isAdopted(criterion, 'exclusion');
                            return (
                              <div key={i} className="flex items-start gap-2 px-3 py-2 hover:bg-red-50/40 group">
                                <span className="shrink-0 w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[8px] font-bold mt-0.5">
                                  {i + 1}
                                </span>
                                <p className="flex-1 text-[11px] text-gray-700 leading-relaxed">
                                  {criterion}
                                </p>
                                <button
                                  onClick={() => adoptCriterion(criterion, 'exclusion')}
                                  disabled={adopted}
                                  className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                                    adopted
                                      ? 'bg-red-100 text-red-600'
                                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 opacity-0 group-hover:opacity-100'
                                  }`}
                                >
                                  {adopted ? (
                                    <span className="flex items-center gap-0.5">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                      Added
                                    </span>
                                  ) : '+ Adopt'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tip */}
                  <p className="text-[10px] text-indigo-400 text-center italic">
                    Click individual criteria to adopt, or use "Adopt All" to copy an entire set.
                    Adopted criteria appear in the editor below.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
       *  INCLUSION CRITERIA EDITOR
       * ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-green-200 bg-green-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-8 bg-green-500 rounded-full" />
            <div>
              <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide">
                Inclusion Criteria
              </h3>
              <p className="text-xs text-green-600 mt-0.5">
                Participants must meet all of the following criteria
              </p>
            </div>
          </div>
          <button
            onClick={() => addCriterion('inclusion')}
            className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 shadow-sm transition-colors"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Criterion
          </button>
        </div>

        <div className="p-6">
          {inclusionCriteria.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No inclusion criteria defined yet.</p>
              {trialsWithElig.length > 0 ? (
                <p className="mt-1.5 text-xs text-indigo-500">
                  Use the recommendations panel above to adopt criteria from reference trials
                </p>
              ) : (
                <button
                  onClick={() => addCriterion('inclusion')}
                  className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
                >
                  + Add first inclusion criterion
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {inclusionCriteria.map((criterion, index) => (
                <div
                  key={criterion.id || index}
                  className="flex items-start space-x-3 group"
                >
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-8 bg-green-100 text-green-700 rounded text-xs font-bold mt-1">
                    I{String(index + 1).padStart(2, '0')}
                  </span>
                  <textarea
                    value={criterion.text}
                    onChange={(e) => updateCriterion('inclusion', index, e.target.value)}
                    rows={2}
                    placeholder="Enter inclusion criterion..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-shadow resize-none"
                  />
                  <button
                    onClick={() => removeCriterion('inclusion', index)}
                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all mt-1"
                    title="Remove criterion"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
       *  EXCLUSION CRITERIA EDITOR
       * ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-8 bg-red-500 rounded-full" />
            <div>
              <h3 className="text-sm font-semibold text-red-800 uppercase tracking-wide">
                Exclusion Criteria
              </h3>
              <p className="text-xs text-red-600 mt-0.5">
                Participants will be excluded if they meet any of the following
              </p>
            </div>
          </div>
          <button
            onClick={() => addCriterion('exclusion')}
            className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 shadow-sm transition-colors"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Criterion
          </button>
        </div>

        <div className="p-6">
          {exclusionCriteria.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No exclusion criteria defined yet.</p>
              {trialsWithElig.length > 0 ? (
                <p className="mt-1.5 text-xs text-indigo-500">
                  Use the recommendations panel above to adopt criteria from reference trials
                </p>
              ) : (
                <button
                  onClick={() => addCriterion('exclusion')}
                  className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                >
                  + Add first exclusion criterion
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {exclusionCriteria.map((criterion, index) => (
                <div
                  key={criterion.id || index}
                  className="flex items-start space-x-3 group"
                >
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-8 bg-red-100 text-red-700 rounded text-xs font-bold mt-1">
                    E{String(index + 1).padStart(2, '0')}
                  </span>
                  <textarea
                    value={criterion.text}
                    onChange={(e) => updateCriterion('exclusion', index, e.target.value)}
                    rows={2}
                    placeholder="Enter exclusion criterion..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow resize-none"
                  />
                  <button
                    onClick={() => removeCriterion('exclusion', index)}
                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all mt-1"
                    title="Remove criterion"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
