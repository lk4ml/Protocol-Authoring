import React, { useState, useMemo } from 'react';
import useScheduleStore from '../../store/useScheduleStore';

/**
 * SOAReferenceView — Infers SOA-relevant procedures from a reference trial.
 *
 * CT.gov does not provide a structured SOA table, but we can infer:
 *   • Assessments needed from outcome measures
 *   • Treatment procedures from interventions
 *   • Screening procedures from eligibility criteria
 */
export default function SOAReferenceView({ trial }) {
  const addActivity = useScheduleStore((s) => s.addActivity);
  const activities = useScheduleStore((s) => s.activities) || [];

  const [copiedItems, setCopiedItems] = useState(new Set());

  if (!trial) return null;

  function markCopied(key) {
    setCopiedItems((prev) => new Set([...prev, key]));
    setTimeout(() => setCopiedItems((prev) => { const n = new Set(prev); n.delete(key); return n; }), 2000);
  }

  // ── Infer activities from trial data ──────────────────────────────────
  const inferred = useMemo(() => {
    const items = [];

    // From outcomes → assessments
    const outcomes = trial.outcomes || {};
    [...(outcomes.primary || []), ...(outcomes.secondary || [])].forEach((o) => {
      if (!o.measure) return;
      // Simplify measure names for SOA activities
      const name = o.measure.length > 60
        ? o.measure.slice(0, 57) + '...'
        : o.measure;
      items.push({
        source: 'outcome',
        name,
        fullName: o.measure,
        description: o.description || '',
        timeFrame: o.timeFrame || '',
        category: 'Assessment',
        icon: '📊',
      });
    });

    // From interventions → treatment procedures
    (trial.interventions || []).forEach((int) => {
      if (!int.name) return;
      const desc = int.description || '';
      // Try to extract dosing info from description
      const dosingMatch = desc.match(/(\d+\s*(?:mg|mcg|ml|iu|units?)[\s/]*(?:day|dose|kg|m2)?)/i);
      const routeMatch = desc.match(/(intravenous|IV|oral|subcutaneous|SC|IM|intramuscular|topical)/i);

      items.push({
        source: 'intervention',
        name: int.name,
        fullName: int.name,
        description: [
          int.type,
          dosingMatch?.[1],
          routeMatch?.[1],
          int.description?.slice(0, 100),
        ].filter(Boolean).join(' · '),
        timeFrame: '',
        category: int.type === 'Drug' || int.type === 'Biological'
          ? 'Drug Administration'
          : int.type === 'Procedure'
            ? 'Procedure'
            : 'Treatment',
        icon: int.type === 'Drug' ? '💊' : int.type === 'Biological' ? '🧬' : '🔬',
      });
    });

    // From eligibility → screening procedures (common patterns)
    const elig = trial.eligibility || {};
    const eligText = (elig.rawText || '').toLowerCase();
    const screeningProcs = [];

    if (eligText.includes('ecog') || eligText.includes('performance status')) {
      screeningProcs.push({ name: 'ECOG Performance Status', category: 'Screening' });
    }
    if (eligText.includes('histolog') || eligText.includes('patholog') || eligText.includes('biopsy')) {
      screeningProcs.push({ name: 'Histology / Pathology Confirmation', category: 'Screening' });
    }
    if (eligText.includes('ct scan') || eligText.includes('mri') || eligText.includes('imaging') || eligText.includes('measurable disease')) {
      screeningProcs.push({ name: 'Baseline Imaging (CT/MRI)', category: 'Screening' });
    }
    if (eligText.includes('hemoglobin') || eligText.includes('platelet') || eligText.includes('neutrophil') || eligText.includes('cbc') || eligText.includes('complete blood count')) {
      screeningProcs.push({ name: 'CBC / Hematology Panel', category: 'Screening' });
    }
    if (eligText.includes('creatinine') || eligText.includes('ast') || eligText.includes('alt') || eligText.includes('bilirubin') || eligText.includes('liver function') || eligText.includes('renal function')) {
      screeningProcs.push({ name: 'Chemistry / Organ Function Panel', category: 'Screening' });
    }
    if (eligText.includes('ecg') || eligText.includes('electrocardiogram') || eligText.includes('qtc')) {
      screeningProcs.push({ name: 'ECG / Electrocardiogram', category: 'Screening' });
    }
    if (eligText.includes('pregnancy') || eligText.includes('contraception')) {
      screeningProcs.push({ name: 'Pregnancy Test', category: 'Screening' });
    }
    if (eligText.includes('consent')) {
      screeningProcs.push({ name: 'Informed Consent', category: 'Screening' });
    }

    screeningProcs.forEach((proc) => {
      items.push({
        source: 'eligibility',
        name: proc.name,
        fullName: proc.name,
        description: 'Inferred from eligibility criteria',
        timeFrame: 'Screening',
        category: proc.category,
        icon: '🏥',
      });
    });

    return items;
  }, [trial]);

  function handleAddActivity(item) {
    const key = `${item.source}_${item.name}`;
    // Check for duplicate by name
    if (activities.find((a) => a.name === item.name || a.name === item.fullName)) {
      markCopied(key);
      return;
    }
    addActivity({
      name: item.fullName || item.name,
      category: item.category,
      description: item.description,
      sdtmDomain: '',
    });
    markCopied(key);
  }

  const CopyBtn = ({ itemKey, onClick }) => (
    <button
      onClick={onClick}
      disabled={copiedItems.has(itemKey)}
      className={`shrink-0 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
        copiedItems.has(itemKey)
          ? 'bg-green-100 text-green-700'
          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
      }`}
    >
      {copiedItems.has(itemKey) ? '✓ Added' : '+ Add'}
    </button>
  );

  // Group by source
  const outcomes = inferred.filter((i) => i.source === 'outcome');
  const interventions = inferred.filter((i) => i.source === 'intervention');
  const screening = inferred.filter((i) => i.source === 'eligibility');

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
        <p className="text-[10px] text-amber-800 leading-relaxed">
          <span className="font-semibold">Note:</span> ClinicalTrials.gov does not provide a structured Schedule of Activities.
          The items below are <span className="font-semibold">inferred</span> from the trial's outcomes, interventions, and eligibility criteria.
        </p>
      </div>

      {/* From Outcomes */}
      {outcomes.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">
            From Outcomes — Assessments Needed ({outcomes.length})
          </h4>
          <div className="space-y-1.5">
            {outcomes.map((item, i) => {
              const key = `outcome_${item.name}`;
              return (
                <div key={i} className="flex items-start gap-2 bg-white rounded-lg border border-gray-200 p-2.5">
                  <span className="text-sm mt-0.5">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-gray-900 leading-snug">{item.name}</p>
                    {item.timeFrame && (
                      <p className="text-[10px] text-gray-400 mt-0.5">TimeFrame: {item.timeFrame}</p>
                    )}
                  </div>
                  <CopyBtn itemKey={key} onClick={() => handleAddActivity(item)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* From Interventions */}
      {interventions.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">
            From Interventions — Treatment Procedures ({interventions.length})
          </h4>
          <div className="space-y-1.5">
            {interventions.map((item, i) => {
              const key = `intervention_${item.name}`;
              return (
                <div key={i} className="flex items-start gap-2 bg-white rounded-lg border border-gray-200 p-2.5">
                  <span className="text-sm mt-0.5">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-gray-900">{item.name}</p>
                    {item.description && (
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <CopyBtn itemKey={key} onClick={() => handleAddActivity(item)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* From Eligibility */}
      {screening.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2">
            From Eligibility — Screening Procedures ({screening.length})
          </h4>
          <div className="space-y-1.5">
            {screening.map((item, i) => {
              const key = `eligibility_${item.name}`;
              return (
                <div key={i} className="flex items-start gap-2 bg-white rounded-lg border border-gray-200 p-2.5">
                  <span className="text-sm mt-0.5">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-gray-900">{item.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{item.description}</p>
                  </div>
                  <CopyBtn itemKey={key} onClick={() => handleAddActivity(item)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {inferred.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-gray-400">No SOA data could be inferred from this trial.</p>
        </div>
      )}
    </div>
  );
}
