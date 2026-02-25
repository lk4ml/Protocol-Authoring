import React from 'react';
import { generateUUID } from '../../utils/uuid';

export default function EligibilityModule({ protocol, onUpdate }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">✅</span>
            Inclusion Criteria
          </h2>
          <button
            onClick={() => onUpdate('inclusionCriteria', [...protocol.inclusionCriteria, { id: generateUUID(), text: '', category: 'General' }])}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Criterion
          </button>
        </div>
        <div className="space-y-3">
          {protocol.inclusionCriteria.map((criterion, idx) => (
            <div key={criterion.id} className="flex gap-3 items-start p-3 bg-green-50 rounded-lg border border-green-100">
              <span className="font-mono text-sm font-bold text-green-700 mt-1">
                I{String(idx + 1).padStart(2, '0')}
              </span>
              <textarea
                value={criterion.text}
                onChange={e => onUpdate('inclusionCriteria', protocol.inclusionCriteria.map(c => c.id === criterion.id ? { ...c, text: e.target.value } : c))}
                rows={2}
                className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm bg-white"
                placeholder="Enter inclusion criterion..."
              />
              <button
                onClick={() => onUpdate('inclusionCriteria', protocol.inclusionCriteria.filter(c => c.id !== criterion.id))}
                className="text-red-500 hover:text-red-600 p-1 mt-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600">❌</span>
            Exclusion Criteria
          </h2>
          <button
            onClick={() => onUpdate('exclusionCriteria', [...protocol.exclusionCriteria, { id: generateUUID(), text: '', category: 'General' }])}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Criterion
          </button>
        </div>
        <div className="space-y-3">
          {protocol.exclusionCriteria.map((criterion, idx) => (
            <div key={criterion.id} className="flex gap-3 items-start p-3 bg-red-50 rounded-lg border border-red-100">
              <span className="font-mono text-sm font-bold text-red-700 mt-1">
                E{String(idx + 1).padStart(2, '0')}
              </span>
              <textarea
                value={criterion.text}
                onChange={e => onUpdate('exclusionCriteria', protocol.exclusionCriteria.map(c => c.id === criterion.id ? { ...c, text: e.target.value } : c))}
                rows={2}
                className="flex-1 px-3 py-2 border border-red-200 rounded-lg text-sm bg-white"
                placeholder="Enter exclusion criterion..."
              />
              <button
                onClick={() => onUpdate('exclusionCriteria', protocol.exclusionCriteria.filter(c => c.id !== criterion.id))}
                className="text-red-500 hover:text-red-600 p-1 mt-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

