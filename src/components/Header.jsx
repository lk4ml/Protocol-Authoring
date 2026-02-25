import React from 'react';

export default function Header({ protocol, onValidate, onExport }) {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{protocol.protocolNumber}</h1>
          <p className="text-sm text-slate-500 max-w-2xl truncate">{protocol.shortTitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onValidate}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
          >
            <span>✓</span> Validate
          </button>
          <button
            onClick={onExport}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-lg flex items-center gap-2"
          >
            <span>📤</span> Export
          </button>
        </div>
      </div>
    </header>
  );
}

