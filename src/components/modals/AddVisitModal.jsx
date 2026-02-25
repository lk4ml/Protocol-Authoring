import React, { useState } from 'react';
import { generateUUID } from '../../utils/uuid';

export default function AddVisitModal({ epochs, timingTypes, onAdd, onCancel }) {
  const [visit, setVisit] = useState({
    name: '',
    label: '',
    epochId: epochs[0]?.id || '',
    timingType: 'WINDOW',
    plannedStudyDay: '',
    windowLabel: '',
    windowLower: '',
    windowUpper: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!visit.name) return;
    onAdd({
      ...visit,
      id: generateUUID(),
      plannedStudyDay: parseInt(visit.plannedStudyDay) || null,
      windowLower: parseInt(visit.windowLower) || null,
      windowUpper: parseInt(visit.windowUpper) || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Add New Visit</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Visit Name</label>
              <input
                type="text"
                value={visit.name}
                onChange={e => setVisit(v => ({ ...v, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="e.g., Week 4"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
              <input
                type="text"
                value={visit.label}
                onChange={e => setVisit(v => ({ ...v, label: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="e.g., V4"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Epoch</label>
              <select
                value={visit.epochId}
                onChange={e => setVisit(v => ({ ...v, epochId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {epochs.map(epoch => (
                  <option key={epoch.id} value={epoch.id}>{epoch.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Timing Type</label>
              <select
                value={visit.timingType}
                onChange={e => setVisit(v => ({ ...v, timingType: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {timingTypes.map(t => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Window Label</label>
            <input
              type="text"
              value={visit.windowLabel}
              onChange={e => setVisit(v => ({ ...v, windowLabel: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g., Day 29 ±3"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Study Day</label>
              <input
                type="number"
                value={visit.plannedStudyDay}
                onChange={e => setVisit(v => ({ ...v, plannedStudyDay: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="29"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Window Lower</label>
              <input
                type="number"
                value={visit.windowLower}
                onChange={e => setVisit(v => ({ ...v, windowLower: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Window Upper</label>
              <input
                type="number"
                value={visit.windowUpper}
                onChange={e => setVisit(v => ({ ...v, windowUpper: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="+3"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Add Visit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

