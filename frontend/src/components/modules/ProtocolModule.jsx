import React from 'react';
import useProtocolStore from '../../store/useProtocolStore';
import useTerminologyStore from '../../store/useTerminologyStore';

/**
 * ProtocolModule - Protocol metadata editor for ICH M11 Title Page fields.
 * Card-based layout with form fields that auto-save via store dirty flags.
 */
export default function ProtocolModule() {
  const protocol = useProtocolStore((s) => s.protocol);
  const updateField = useProtocolStore((s) => s.updateField);
  const phases = useTerminologyStore((s) => s.phases);
  const studyTypes = useTerminologyStore((s) => s.studyTypes);

  if (!protocol) {
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

  // Phase dropdown options
  const phaseOptions = phases?.length
    ? phases
    : [
        { code: 'Phase 1', label: 'Phase 1' },
        { code: 'Phase 1/Phase 2', label: 'Phase 1/Phase 2' },
        { code: 'Phase 2', label: 'Phase 2' },
        { code: 'Phase 2/Phase 3', label: 'Phase 2/Phase 3' },
        { code: 'Phase 3', label: 'Phase 3' },
        { code: 'Phase 4', label: 'Phase 4' },
      ];

  // Study type dropdown options
  const studyTypeOptions = studyTypes?.length
    ? studyTypes
    : [
        { code: 'INTERVENTIONAL', label: 'Interventional' },
        { code: 'OBSERVATIONAL', label: 'Observational' },
        { code: 'EXPANDED_ACCESS', label: 'Expanded Access' },
      ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page heading */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Protocol Information</h2>
        <p className="text-sm text-gray-500 mt-1">
          ICH M11 Title Page and core protocol metadata
        </p>
      </div>

      {/* Card: Protocol Identification */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Protocol Identification
          </h3>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Protocol Number
            </label>
            <input
              type="text"
              value={protocol.protocolNumber || ''}
              onChange={(e) => updateField('protocolNumber', e.target.value)}
              placeholder="e.g., ONCO-2025-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Title
            </label>
            <textarea
              value={protocol.fullTitle || ''}
              onChange={(e) => updateField('fullTitle', e.target.value)}
              rows={3}
              placeholder="A Randomized, Double-Blind, Placebo-Controlled Phase 3 Study of..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Complete, scientifically accurate study title
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Short Title
            </label>
            <input
              type="text"
              value={protocol.shortTitle || ''}
              onChange={(e) => updateField('shortTitle', e.target.value)}
              placeholder="e.g., BEACON-3 Study"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
            />
          </div>
        </div>
      </div>

      {/* Card: Study Classification */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Study Classification
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phase
              </label>
              <select
                value={protocol.phase || ''}
                onChange={(e) => updateField('phase', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="">Select phase...</option>
                {phaseOptions.map((p) => (
                  <option key={p.code || p.label} value={p.code || p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Study Type
              </label>
              <select
                value={protocol.studyType || ''}
                onChange={(e) => updateField('studyType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="">Select type...</option>
                {studyTypeOptions.map((t) => (
                  <option key={t.code || t.label} value={t.code || t.label}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Therapeutic Area
              </label>
              <input
                type="text"
                value={protocol.therapeuticArea || ''}
                onChange={(e) => updateField('therapeuticArea', e.target.value)}
                placeholder="e.g., Oncology, Neurology"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Indication
              </label>
              <input
                type="text"
                value={protocol.indication || ''}
                onChange={(e) => updateField('indication', e.target.value)}
                placeholder="e.g., Non-Small Cell Lung Cancer"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card: Sponsor & Enrollment */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Sponsor & Enrollment
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sponsor Name
              </label>
              <input
                type="text"
                value={protocol.sponsorName || ''}
                onChange={(e) => updateField('sponsorName', e.target.value)}
                placeholder="e.g., Acme Therapeutics, Inc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Planned Sample Size
              </label>
              <input
                type="number"
                value={protocol.sampleSize || ''}
                onChange={(e) => updateField('sampleSize', e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g., 450"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              />
              <p className="text-xs text-gray-400 mt-1">
                Total number of participants planned for enrollment
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
