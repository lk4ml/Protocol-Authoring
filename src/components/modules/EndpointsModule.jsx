import React from 'react';
import { generateUUID } from '../../utils/uuid';

export default function EndpointsModule({ protocol, onUpdate }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">🎯</span>
          Objectives & Endpoints
        </h2>
        <button
          onClick={() => onUpdate('objectives', [...protocol.objectives, { id: generateUUID(), text: '', level: 'Secondary', levelCode: 'C98773', endpoints: [] }])}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Add Objective
        </button>
      </div>
      {protocol.objectives.map((objective, objIdx) => (
        <div key={objective.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className={`px-4 py-3 border-b flex items-center justify-between ${objective.level === 'Primary' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <select
                value={objective.level}
                onChange={e => onUpdate('objectives', protocol.objectives.map(o => o.id === objective.id ? { ...o, level: e.target.value, levelCode: e.target.value === 'Primary' ? 'C98772' : 'C98773' } : o))}
                className={`px-3 py-1 rounded-lg text-sm font-medium border-none ${objective.level === 'Primary' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}
              >
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
                <option value="Exploratory">Exploratory</option>
              </select>
              <span className="font-medium text-slate-700">Objective {objIdx + 1}</span>
            </div>
            <button
              onClick={() => onUpdate('objectives', protocol.objectives.filter(o => o.id !== objective.id))}
              className="text-red-500 hover:text-red-600"
            >
              ✕
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Objective Statement</label>
              <textarea
                value={objective.text}
                onChange={e => onUpdate('objectives', protocol.objectives.map(o => o.id === objective.id ? { ...o, text: e.target.value } : o))}
                rows={2}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm"
                placeholder="Enter objective..."
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Endpoints</label>
                <button
                  onClick={() => onUpdate('objectives', protocol.objectives.map(o => o.id === objective.id ? { ...o, endpoints: [...(o.endpoints || []), { id: generateUUID(), text: '', purpose: 'Efficacy' }] } : o))}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add Endpoint
                </button>
              </div>
              <div className="space-y-2">
                {(objective.endpoints || []).map((endpoint, epIdx) => (
                  <div key={endpoint.id} className="flex gap-2 items-start">
                    <span className="text-xs text-slate-400 mt-2.5 font-mono">EP{epIdx + 1}</span>
                    <textarea
                      value={endpoint.text}
                      onChange={e => onUpdate('objectives', protocol.objectives.map(o => o.id === objective.id ? { ...o, endpoints: o.endpoints.map(ep => ep.id === endpoint.id ? { ...ep, text: e.target.value } : ep) } : o))}
                      rows={2}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      placeholder="Enter endpoint..."
                    />
                    <select
                      value={endpoint.purpose}
                      onChange={e => onUpdate('objectives', protocol.objectives.map(o => o.id === objective.id ? { ...o, endpoints: o.endpoints.map(ep => ep.id === endpoint.id ? { ...ep, purpose: e.target.value } : ep) } : o))}
                      className="px-2 py-2 border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="Efficacy">Efficacy</option>
                      <option value="Safety">Safety</option>
                      <option value="PK">PK</option>
                    </select>
                    <button
                      onClick={() => onUpdate('objectives', protocol.objectives.map(o => o.id === objective.id ? { ...o, endpoints: o.endpoints.filter(ep => ep.id !== endpoint.id) } : o))}
                      className="text-red-500 hover:text-red-600 p-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

