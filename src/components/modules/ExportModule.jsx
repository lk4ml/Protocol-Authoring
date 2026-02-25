import React from 'react';

export default function ExportModule({ protocol, usdmPreview, onExport, onVeevaExport }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">📤</span>
          Export & Publish
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[
            { id: 'usdm', name: 'USDM v4.0 JSON', desc: 'TransCelerate SDR compatible', icon: '🔄', color: 'blue' },
            { id: 'odm', name: 'ODM-XML 1.3.2', desc: 'Universal EDC import format', icon: '📄', color: 'green' },
            { id: 'sdr', name: 'Push to SDR', desc: 'Upload to Study Definitions Repository', icon: '☁️', color: 'purple' },
            { id: 'veeva', name: 'Veeva Vault CDMS', desc: 'Direct EDC configuration', icon: '🏢', color: 'amber' },
          ].map(format => (
            <button
              key={format.id}
              onClick={() => format.id === 'veeva' ? onVeevaExport() : onExport(format.id)}
              className={`p-5 border-2 rounded-xl text-left transition-all hover:shadow-md ${
                format.id === 'veeva'
                  ? 'border-amber-200 hover:border-amber-400 bg-amber-50'
                  : 'border-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{format.icon}</span>
                <span className={`font-semibold text-${format.color}-700`}>{format.name}</span>
              </div>
              <p className="text-sm text-slate-500">{format.desc}</p>
            </button>
          ))}
        </div>
        <div className="p-6 bg-slate-50 rounded-xl">
          <h3 className="font-semibold text-slate-800 mb-4">Digital Data Flow Architecture</h3>
          <div className="font-mono text-xs text-slate-600 whitespace-pre overflow-x-auto">
            {`┌─────────────────────────────────────────────────────────────────┐
│                 PROTOCOL INTELLIGENCE PLATFORM                   │
│                                                                  │
│   Protocol Editor → Activities/SOA → Biomedical Concepts        │
│        │                  │                   │                  │
│        └──────────────────┴───────────────────┘                  │
│                           │                                      │
│                    ┌──────┴──────┐                               │
│                    │ USDM v4.0   │                               │
│                    │ Transformer │                               │
│                    └──────┬──────┘                               │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │TransCelerate│  │  ODM-XML   │  │   Veeva    │
   │    SDR     │  │   Export   │  │ Vault CDMS │
   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
         │               │               │
         ▼               ▼               ▼
   ┌──────────────────────────────────────────┐
   │           DOWNSTREAM SYSTEMS              │
   │   EDC  │  CTMS  │  IWRS  │  eTMF         │
   └──────────────────────────────────────────┘`}
          </div>
        </div>
      </div>
      {protocol.usdmId && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-green-600 text-xl">✓</span>
            <div>
              <div className="font-medium text-green-800">Published to SDR</div>
              <div className="text-sm text-green-600">Study ID: {protocol.usdmId}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

