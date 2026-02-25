import React from 'react';
import { generateUUID } from '../../utils/uuid';

export default function DesignModule({ protocol, onUpdate, cdiscData, epochTypes }) {
  const interventionModels = cdiscData.interventionModels || [];
  const blindingSchemas = cdiscData.blindingSchemas || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">🔬</span>
          Study Design Configuration
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Intervention Model</label>
            <select
              value={protocol.interventionModel}
              onChange={e => onUpdate('interventionModel', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              disabled={cdiscData.loading}
            >
              {interventionModels.map(m => (
                <option key={m.code} value={m.decode}>
                  {m.decode}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Blinding</label>
            <select
              value={protocol.blinding}
              onChange={e => onUpdate('blinding', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
              disabled={cdiscData.loading}
            >
              {blindingSchemas.map(b => (
                <option key={b.code} value={b.decode}>
                  {b.decode}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Sponsor</label>
            <input
              type="text"
              value={protocol.sponsorName}
              onChange={e => onUpdate('sponsorName', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
          </div>
        </div>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-800">Study Arms</h3>
            <button
              onClick={() => onUpdate('arms', [...protocol.arms, { id: generateUUID(), name: 'New Arm', description: '', type: 'Experimental Arm', typeCode: 'C174267' }])}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add Arm
            </button>
          </div>
          <div className="space-y-2">
            {protocol.arms.map(arm => (
              <div key={arm.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <input
                  type="text"
                  value={arm.name}
                  onChange={e => onUpdate('arms', protocol.arms.map(a => a.id === arm.id ? { ...a, name: e.target.value } : a))}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded text-sm"
                  placeholder="Arm Name"
                />
                <input
                  type="text"
                  value={arm.description}
                  onChange={e => onUpdate('arms', protocol.arms.map(a => a.id === arm.id ? { ...a, description: e.target.value } : a))}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded text-sm"
                  placeholder="Description"
                />
                <button
                  onClick={() => onUpdate('arms', protocol.arms.filter(a => a.id !== arm.id))}
                  className="text-red-500 hover:text-red-600 p-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-800">Study Epochs</h3>
            <button
              onClick={() => onUpdate('epochs', [...protocol.epochs, { id: generateUUID(), name: 'New Epoch', type: 'Treatment', typeCode: 'TREATMENT' }])}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add Epoch
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {protocol.epochs.map(epoch => {
              const epochType = epochTypes.find(e => e.code === epoch.typeCode);
              return (
                <div
                  key={epoch.id}
                  className={`px-4 py-2 rounded-lg border bg-${epochType?.color || 'slate'}-50 border-${epochType?.color || 'slate'}-200 flex items-center gap-2`}
                >
                  <input
                    type="text"
                    value={epoch.name}
                    onChange={e => onUpdate('epochs', protocol.epochs.map(ep => ep.id === epoch.id ? { ...ep, name: e.target.value } : ep))}
                    className="bg-transparent border-none text-sm font-medium w-24 focus:ring-0"
                  />
                  <select
                    value={epoch.typeCode}
                    onChange={e => {
                      const type = epochTypes.find(t => t.code === e.target.value);
                      onUpdate('epochs', protocol.epochs.map(ep => ep.id === epoch.id ? { ...ep, typeCode: e.target.value, type: type?.label } : ep));
                    }}
                    className="text-xs bg-transparent border-none focus:ring-0"
                  >
                    {epochTypes.map(t => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onUpdate('epochs', protocol.epochs.filter(e => e.id !== epoch.id))}
                    className="text-slate-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

