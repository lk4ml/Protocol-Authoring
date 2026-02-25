import React from 'react';

export default function USDMPreviewModule({ usdmPreview, odmPreview, validationResults, onExport }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">🔄 USDM v4.0 JSON</h3>
            <button
              onClick={() => onExport('usdm')}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              Download
            </button>
          </div>
          <div className="p-4 max-h-[600px] overflow-auto">
            <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap">
              {usdmPreview ? JSON.stringify(usdmPreview, null, 2) : 'Loading...'}
            </pre>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">📄 ODM-XML</h3>
            <button
              onClick={() => onExport('odm')}
              className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
            >
              Download
            </button>
          </div>
          <div className="p-4 max-h-[600px] overflow-auto">
            <pre className="text-xs font-mono text-blue-600 whitespace-pre-wrap">
              {odmPreview || 'Loading...'}
            </pre>
          </div>
        </div>
      </div>
      {validationResults && (
        <div className={`bg-white rounded-2xl shadow-sm border p-6 ${validationResults.valid ? 'border-green-200' : 'border-red-200'}`}>
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            {validationResults.valid ? (
              <span className="text-green-600">✓</span>
            ) : (
              <span className="text-red-600">✗</span>
            )}
            USDM Conformance Validation
          </h3>
          {validationResults.errors?.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-medium text-red-700 mb-2">
                Errors ({validationResults.errors.length})
              </div>
              <ul className="space-y-1">
                {validationResults.errors.map((err, idx) => (
                  <li key={idx} className="text-sm text-red-600">
                    • <strong>{err.field}:</strong> {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {validationResults.warnings?.length > 0 && (
            <div>
              <div className="text-sm font-medium text-amber-700 mb-2">
                Warnings ({validationResults.warnings.length})
              </div>
              <ul className="space-y-1">
                {validationResults.warnings.map((warn, idx) => (
                  <li key={idx} className="text-sm text-amber-600">
                    • <strong>{warn.field}:</strong> {warn.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {validationResults.valid && validationResults.errors?.length === 0 && (
            <p className="text-green-600 text-sm">✓ Protocol conforms to USDM v4.0 specification</p>
          )}
        </div>
      )}
    </div>
  );
}

