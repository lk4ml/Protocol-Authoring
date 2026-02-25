import React from 'react';

export default function BCBrowserModal({ activity, cdiscData, onSelectBC, onDeselectBC, onClose }) {
  const biomedicalConcepts = cdiscData.biomedicalConcepts || [];
  const filteredBCs = biomedicalConcepts.filter(
    bc => bc.domain === activity.domain || !activity.domain
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Map Biomedical Concepts</h3>
            <p className="text-sm text-slate-500">Activity: {activity.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {cdiscData.loading ? (
            <div className="text-center py-8">
              <div className="animate-spin text-4xl mb-4">⟳</div>
              <p className="text-slate-500">Loading biomedical concepts...</p>
            </div>
          ) : filteredBCs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No biomedical concepts available for domain {activity.domain}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredBCs.map(bc => {
                const isSelected = activity.bcIds?.includes(bc.id);
                return (
                  <div
                    key={bc.id}
                    onClick={() => isSelected ? onDeselectBC(bc.id) : onSelectBC(bc.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-slate-800">{bc.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-mono">
                            {bc.domain}
                          </span>
                          <span className="text-xs text-slate-500">{bc.category}</span>
                        </div>
                      </div>
                      {isSelected && <span className="text-purple-600 text-xl">✓</span>}
                    </div>
                    {bc.dataElements && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {bc.dataElements.slice(0, 3).map(de => (
                          <span key={de.name} className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {de.name}
                          </span>
                        ))}
                        {bc.dataElements.length > 3 && (
                          <span className="text-xs text-slate-400">+{bc.dataElements.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

