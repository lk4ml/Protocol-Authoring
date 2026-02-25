import React, { useState } from 'react';

export default function AddActivityModal({ cdiscData, activityCategories, onAdd, onCancel }) {
  const [useTemplate, setUseTemplate] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [activity, setActivity] = useState({
    name: '',
    category: 'CLINICAL',
    domain: 'VS',
    formType: '',
    description: '',
    bcIds: []
  });

  const sdtmDomains = cdiscData.sdtmDomains || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activity.name) return;
    onAdd(activity);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Add New Activity</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => setUseTemplate(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${useTemplate ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
            >
              Use Template
            </button>
            <button
              type="button"
              onClick={() => setUseTemplate(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${!useTemplate ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
            >
              Custom Activity
            </button>
          </div>
          {useTemplate ? (
            <div className="max-h-64 overflow-y-auto space-y-2">
              <p className="text-sm text-slate-500 mb-2">Select from activity templates</p>
              {/* Template selection UI would go here */}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Activity Name</label>
                <input
                  type="text"
                  value={activity.name}
                  onChange={e => setActivity(a => ({ ...a, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Enter activity name"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={activity.category}
                    onChange={e => setActivity(a => ({ ...a, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    {activityCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SDTM Domain</label>
                  <select
                    value={activity.domain}
                    onChange={e => setActivity(a => ({ ...a, domain: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    disabled={cdiscData.loading}
                  >
                    {sdtmDomains.map(d => (
                      <option key={d.id} value={d.id}>{d.id} - {d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Form Type</label>
                <input
                  type="text"
                  value={activity.formType}
                  onChange={e => setActivity(a => ({ ...a, formType: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="e.g., VS, LB, AE"
                />
              </div>
            </>
          )}
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
              disabled={!activity.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Add Activity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

