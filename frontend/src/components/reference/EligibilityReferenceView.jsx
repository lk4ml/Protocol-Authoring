import React, { useState } from 'react';
import useDesignStore from '../../store/useDesignStore';

/**
 * EligibilityReferenceView — Shows parsed eligibility criteria from a reference trial.
 *   • Parsed inclusion criteria (numbered list)
 *   • Parsed exclusion criteria (numbered list)
 *   • Age range, sex, healthy volunteer status
 *   • Copy actions (individual + bulk)
 */
export default function EligibilityReferenceView({ trial }) {
  const eligibilityCriteria = useDesignStore((s) => s.eligibilityCriteria) || { inclusion: [], exclusion: [] };
  const setEligibilityCriteria = useDesignStore((s) => s.setEligibilityCriteria);

  const [copiedItems, setCopiedItems] = useState(new Set());
  const [showRaw, setShowRaw] = useState(false);

  if (!trial) return null;
  const elig = trial.eligibility || {};

  function markCopied(key) {
    setCopiedItems((prev) => new Set([...prev, key]));
    setTimeout(() => setCopiedItems((prev) => { const n = new Set(prev); n.delete(key); return n; }), 2000);
  }

  function handleCopyCriterion(text, type) {
    const updated = { ...eligibilityCriteria };
    const list = [...(updated[type] || [])];
    // Avoid exact duplicates
    if (list.some((c) => (typeof c === 'string' ? c : c.text) === text)) {
      markCopied(`${type}_${text.slice(0, 30)}`);
      return;
    }
    list.push({ id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text });
    updated[type] = list;
    setEligibilityCriteria(updated);
    markCopied(`${type}_${text.slice(0, 30)}`);
  }

  function handleCopyAll(type) {
    const criteria = type === 'inclusion' ? elig.inclusion : elig.exclusion;
    if (!criteria?.length) return;
    const updated = { ...eligibilityCriteria };
    const existing = [...(updated[type] || [])];
    const existingTexts = new Set(existing.map((c) => (typeof c === 'string' ? c : c.text)));
    criteria.forEach((text) => {
      if (!existingTexts.has(text)) {
        existing.push({ id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text });
      }
    });
    updated[type] = existing;
    setEligibilityCriteria(updated);
    markCopied(`all_${type}`);
  }

  const CopyBtn = ({ itemKey, onClick, label = 'Copy', small = false }) => (
    <button
      onClick={onClick}
      disabled={copiedItems.has(itemKey)}
      className={`shrink-0 rounded font-semibold transition-all ${
        small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'
      } ${
        copiedItems.has(itemKey)
          ? 'bg-green-100 text-green-700'
          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
      }`}
    >
      {copiedItems.has(itemKey) ? '✓' : `+ ${label}`}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Demographics */}
      <div>
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Demographics</h4>
        <div className="flex flex-wrap gap-2">
          {elig.sex && (
            <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-semibold">
              Sex: {elig.sex}
            </span>
          )}
          {elig.minimumAge && (
            <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-semibold">
              Min: {elig.minimumAge}
            </span>
          )}
          {elig.maximumAge && elig.maximumAge !== 'N/A' && (
            <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-semibold">
              Max: {elig.maximumAge}
            </span>
          )}
          <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${
            elig.healthyVolunteers ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {elig.healthyVolunteers ? 'Healthy Volunteers: Yes' : 'Patients Only'}
          </span>
        </div>
      </div>

      {/* Inclusion Criteria */}
      {elig.inclusion?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
              Inclusion Criteria ({elig.inclusion.length})
            </h4>
            <CopyBtn
              itemKey="all_inclusion"
              onClick={() => handleCopyAll('inclusion')}
              label="Copy All"
            />
          </div>
          <div className="space-y-1.5">
            {elig.inclusion.map((criterion, i) => {
              const key = `inclusion_${criterion.slice(0, 30)}`;
              return (
                <div key={i} className="flex items-start gap-2 group">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[9px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-[11px] text-gray-700 leading-relaxed">{criterion}</p>
                  <CopyBtn itemKey={key} onClick={() => handleCopyCriterion(criterion, 'inclusion')} label="" small />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exclusion Criteria */}
      {elig.exclusion?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
              Exclusion Criteria ({elig.exclusion.length})
            </h4>
            <CopyBtn
              itemKey="all_exclusion"
              onClick={() => handleCopyAll('exclusion')}
              label="Copy All"
            />
          </div>
          <div className="space-y-1.5">
            {elig.exclusion.map((criterion, i) => {
              const key = `exclusion_${criterion.slice(0, 30)}`;
              return (
                <div key={i} className="flex items-start gap-2 group">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[9px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-[11px] text-gray-700 leading-relaxed">{criterion}</p>
                  <CopyBtn itemKey={key} onClick={() => handleCopyCriterion(criterion, 'exclusion')} label="" small />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw text fallback */}
      {(!elig.inclusion?.length && !elig.exclusion?.length && elig.rawText) && (
        <div>
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Eligibility Criteria (Raw)
          </h4>
          <p className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">
            {elig.rawText}
          </p>
        </div>
      )}

      {/* Toggle raw text */}
      {(elig.inclusion?.length > 0 || elig.exclusion?.length > 0) && elig.rawText && (
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showRaw ? '▲ Hide raw text' : '▼ Show raw text'}
        </button>
      )}
      {showRaw && elig.rawText && (
        <pre className="text-[10px] text-gray-500 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
          {elig.rawText}
        </pre>
      )}
    </div>
  );
}
