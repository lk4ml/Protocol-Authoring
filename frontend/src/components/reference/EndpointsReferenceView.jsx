import React, { useState } from 'react';
import useDesignStore from '../../store/useDesignStore';

/**
 * EndpointsReferenceView — Shows outcomes/endpoints from a reference trial.
 *   • Primary outcomes (no cap)
 *   • Secondary outcomes (full list)
 *   • Other / exploratory outcomes
 *   • Copy actions to add as objectives+endpoints
 */
export default function EndpointsReferenceView({ trial }) {
  const objectives = useDesignStore((s) => s.objectives) || [];
  const setObjectives = useDesignStore((s) => s.setObjectives);

  const [copiedItems, setCopiedItems] = useState(new Set());

  if (!trial) return null;
  const outcomes = trial.outcomes || {};

  function markCopied(key) {
    setCopiedItems((prev) => new Set([...prev, key]));
    setTimeout(() => setCopiedItems((prev) => { const n = new Set(prev); n.delete(key); return n; }), 2000);
  }

  function handleCopyOutcome(outcome, level) {
    const key = `${level}_${outcome.measure?.slice(0, 30)}`;
    const updated = [...objectives];

    // Find or create an objective group for this level
    let objIndex = updated.findIndex(
      (o) => (o.level || '').toUpperCase() === level.toUpperCase()
    );

    if (objIndex === -1) {
      const levelLabels = {
        PRIMARY: 'Primary Objective',
        SECONDARY: 'Secondary Objective',
        OTHER: 'Exploratory Objective',
      };
      updated.push({
        id: `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        level: level.toUpperCase(),
        name: levelLabels[level.toUpperCase()] || 'Objective',
        description: '',
        endpoints: [],
      });
      objIndex = updated.length - 1;
    }

    // Avoid duplicate endpoints
    const existingEps = updated[objIndex].endpoints || [];
    if (existingEps.some((ep) => ep.name === outcome.measure)) {
      markCopied(key);
      return;
    }

    updated[objIndex] = {
      ...updated[objIndex],
      endpoints: [
        ...existingEps,
        {
          id: `ep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: outcome.measure,
          description: outcome.description || '',
          timeFrame: outcome.timeFrame || '',
          purpose: 'EFFICACY',
        },
      ],
    };

    setObjectives(updated);
    markCopied(key);
  }

  function handleCopyAllOutcomes(outcomeList, level) {
    if (!outcomeList?.length) return;
    outcomeList.forEach((o) => handleCopyOutcome(o, level));
    markCopied(`all_${level}`);
  }

  const CopyBtn = ({ itemKey, onClick, label = 'Copy' }) => (
    <button
      onClick={onClick}
      disabled={copiedItems.has(itemKey)}
      className={`shrink-0 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
        copiedItems.has(itemKey)
          ? 'bg-green-100 text-green-700'
          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
      }`}
    >
      {copiedItems.has(itemKey) ? '✓ Copied' : `+ ${label}`}
    </button>
  );

  function OutcomeSection({ title, items, level, color }) {
    if (!items?.length) return null;
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>
            {title} ({items.length})
          </h4>
          {items.length > 1 && (
            <CopyBtn
              itemKey={`all_${level}`}
              onClick={() => handleCopyAllOutcomes(items, level)}
              label="Copy All"
            />
          )}
        </div>
        <div className="space-y-2">
          {items.map((outcome, i) => {
            const key = `${level}_${outcome.measure?.slice(0, 30)}`;
            return (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900">{outcome.measure}</p>
                    {outcome.description && (
                      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-3">
                        {outcome.description}
                      </p>
                    )}
                    {outcome.timeFrame && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[10px] text-gray-500">{outcome.timeFrame}</span>
                      </div>
                    )}
                  </div>
                  <CopyBtn itemKey={key} onClick={() => handleCopyOutcome(outcome, level)} label="Copy" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-2">
        <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-semibold">
          {outcomes.primary?.length || 0} Primary
        </span>
        <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-semibold">
          {outcomes.secondary?.length || 0} Secondary
        </span>
        <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-semibold">
          {outcomes.other?.length || 0} Other
        </span>
      </div>

      <OutcomeSection
        title="Primary Endpoints"
        items={outcomes.primary}
        level="PRIMARY"
        color="text-amber-600"
      />

      <OutcomeSection
        title="Secondary Endpoints"
        items={outcomes.secondary}
        level="SECONDARY"
        color="text-blue-600"
      />

      <OutcomeSection
        title="Other / Exploratory"
        items={outcomes.other}
        level="OTHER"
        color="text-gray-500"
      />

      {!outcomes.primary?.length && !outcomes.secondary?.length && !outcomes.other?.length && (
        <div className="text-center py-6">
          <p className="text-xs text-gray-400">No endpoints data available for this trial.</p>
        </div>
      )}
    </div>
  );
}
