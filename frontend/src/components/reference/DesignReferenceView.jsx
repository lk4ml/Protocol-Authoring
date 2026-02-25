import React, { useState } from 'react';
import useDesignStore from '../../store/useDesignStore';

/**
 * DesignReferenceView — Shows study design data from a reference trial:
 *   • Design parameters (intervention model, allocation, masking)
 *   • Arms with descriptions and linked interventions
 *   • Interventions with arm mappings
 *   • Copy actions to add arms/elements to the user's design
 */
export default function DesignReferenceView({ trial }) {
  const addArm = useDesignStore((s) => s.addArm);
  const addElement = useDesignStore((s) => s.addElement);
  const arms = useDesignStore((s) => s.arms) || [];
  const elements = useDesignStore((s) => s.elements) || [];
  const setInterventionModel = useDesignStore((s) => s.setInterventionModel);
  const setBlindingSchema = useDesignStore((s) => s.setBlindingSchema);

  const [copiedItems, setCopiedItems] = useState(new Set());

  if (!trial) return null;

  const di = trial.designInfo || {};

  function markCopied(key) {
    setCopiedItems((prev) => new Set([...prev, key]));
    setTimeout(() => setCopiedItems((prev) => { const n = new Set(prev); n.delete(key); return n; }), 2000);
  }

  function mapArmType(ctType) {
    const m = {
      'Experimental': 'Experimental Arm',
      'Active Comparator': 'Active Comparator Arm',
      'Placebo Comparator': 'Placebo Comparator Arm',
      'Sham Comparator': 'Sham Comparator Arm',
      'No Intervention': 'No Intervention Arm',
    };
    return m[ctType] || ctType;
  }

  function handleCopyArm(arm) {
    const key = `arm_${arm.label}`;
    addArm({
      name: arm.label,
      type: mapArmType(arm.type),
      description: arm.description,
      order: arms.length + 1,
    });
    markCopied(key);
  }

  function handleCopyIntervention(intervention) {
    const key = `int_${intervention.name}`;
    if (elements.find((el) => el.name === intervention.name)) {
      markCopied(key);
      return;
    }
    const colorMap = {
      Drug: '#4f46e5',
      Biological: '#7c3aed',
      Procedure: '#0891b2',
      Radiation: '#dc2626',
      Behavioral: '#16a34a',
      Device: '#d97706',
      Dietary: '#be185d',
      Other: '#6b7280',
    };
    addElement({
      name: intervention.name,
      color: colorMap[intervention.type] || '#6366f1',
      description: intervention.description,
    });
    markCopied(key);
  }

  function handleCopyDesignParams() {
    if (di.interventionModel) setInterventionModel(di.interventionModel);
    if (di.masking) setBlindingSchema(di.masking);
    markCopied('design_params');
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

  return (
    <div className="space-y-4">
      {/* Design Parameters */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Design Parameters</h4>
          <CopyBtn itemKey="design_params" onClick={handleCopyDesignParams} label="Use Params" />
        </div>
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
          {di.interventionModel && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Model</span>
              <span className="font-medium text-gray-800">{di.interventionModel}</span>
            </div>
          )}
          {di.allocation && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Allocation</span>
              <span className="font-medium text-gray-800">{di.allocation}</span>
            </div>
          )}
          {di.masking && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Masking</span>
              <span className="font-medium text-gray-800">{di.masking}</span>
            </div>
          )}
          {di.primaryPurpose && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Purpose</span>
              <span className="font-medium text-gray-800">{di.primaryPurpose}</span>
            </div>
          )}
          {trial.enrollment && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Enrollment</span>
              <span className="font-medium text-gray-800">n={trial.enrollment}</span>
            </div>
          )}
        </div>
      </div>

      {/* Arms */}
      {trial.arms?.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Arms ({trial.arms.length})
          </h4>
          <div className="space-y-2">
            {trial.arms.map((arm, i) => {
              const key = `arm_${arm.label}`;
              return (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900">{arm.label}</p>
                      {arm.type && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-50 text-indigo-600">
                          {arm.type}
                        </span>
                      )}
                      {arm.description && (
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-3">{arm.description}</p>
                      )}
                      {arm.interventionNames?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {arm.interventionNames.map((name, j) => (
                            <span key={j} className="px-1.5 py-0.5 rounded bg-gray-100 text-[9px] text-gray-600 font-medium">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <CopyBtn itemKey={key} onClick={() => handleCopyArm(arm)} label="Copy Arm" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interventions */}
      {trial.interventions?.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Interventions ({trial.interventions.length})
          </h4>
          <div className="space-y-2">
            {trial.interventions.map((int, i) => {
              const key = `int_${int.name}`;
              return (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900">{int.name}</p>
                      {int.type && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-600">
                          {int.type}
                        </span>
                      )}
                      {int.description && (
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-3">{int.description}</p>
                      )}
                    </div>
                    <CopyBtn itemKey={key} onClick={() => handleCopyIntervention(int)} label="As Element" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
