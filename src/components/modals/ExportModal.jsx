import React from 'react';

export default function ExportModal({ onExport, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Export Protocol</h3>
        <div className="space-y-3 mb-6">
          {[
            { id: 'usdm', name: 'USDM v4.0 JSON', desc: 'For SDR storage and DDF systems' },
            { id: 'odm', name: 'ODM-XML 1.3.2', desc: 'Universal EDC import format' },
            { id: 'sdr', name: 'Push to SDR', desc: 'Upload to Study Definitions Repository' },
          ].map(format => (
            <button
              key={format.id}
              onClick={() => {
                onExport(format.id);
                onCancel();
              }}
              className="w-full p-4 border border-slate-200 rounded-xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="font-medium text-slate-800">{format.name}</div>
              <div className="text-sm text-slate-500">{format.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

