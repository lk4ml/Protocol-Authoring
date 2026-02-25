import React from 'react';

export default function ProtocolModule({ protocol, onUpdate, cdiscData }) {
  const phases = cdiscData.phases || [];
  const studyTypes = cdiscData.studyTypes || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">📋</span>
          Protocol Information
        </h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Full Protocol Title</label>
            <textarea
              value={protocol.fullTitle}
              onChange={e => onUpdate('fullTitle', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Protocol Number</label>
              <input
                type="text"
                value={protocol.protocolNumber}
                onChange={e => onUpdate('protocolNumber', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Short Title</label>
              <input
                type="text"
                value={protocol.shortTitle}
                onChange={e => onUpdate('shortTitle', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phase</label>
              <select
                value={protocol.phase}
                onChange={e => onUpdate('phase', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                disabled={cdiscData.loading}
              >
                {phases.map(p => (
                  <option key={p.code} value={p.label || p.decode}>
                    {p.label || p.decode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Study Type</label>
              <select
                value={protocol.studyType}
                onChange={e => onUpdate('studyType', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                disabled={cdiscData.loading}
              >
                {studyTypes.map(t => (
                  <option key={t.code} value={t.decode}>
                    {t.decode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sample Size</label>
              <input
                type="text"
                value={protocol.sampleSize}
                onChange={e => onUpdate('sampleSize', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Therapeutic Area</label>
              <input
                type="text"
                value={protocol.therapeuticArea}
                onChange={e => onUpdate('therapeuticArea', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Indication</label>
              <input
                type="text"
                value={protocol.indication}
                onChange={e => onUpdate('indication', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Visits', value: protocol.visits.length, icon: '📅', bg: 'bg-blue-50', text: 'text-blue-600' },
          { label: 'Activities', value: protocol.activities.length, icon: '📝', bg: 'bg-green-50', text: 'text-green-600' },
          { label: 'SDTM Domains', value: [...new Set(protocol.activities.map(a => a.domain))].length, icon: '🧬', bg: 'bg-purple-50', text: 'text-purple-600' },
          { label: 'BC Mappings', value: protocol.activities.reduce((acc, a) => acc + (a.bcIds?.length || 0), 0), icon: '🔗', bg: 'bg-amber-50', text: 'text-amber-600' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`text-2xl font-bold ${stat.text}`}>{stat.value}</span>
            </div>
            <div className="text-sm text-slate-600">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

