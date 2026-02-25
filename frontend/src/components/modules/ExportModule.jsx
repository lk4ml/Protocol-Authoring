import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useProtocolStore from '../../store/useProtocolStore';
import { exportUSDM, exportICHM11 } from '../../api/exportApi';

/**
 * ExportModule - Export panel for USDM JSON and ICH M11 Document.
 * Shows a preview of USDM JSON and provides download buttons.
 */
export default function ExportModule() {
  const { id: protocolId } = useParams();
  const protocol = useProtocolStore((s) => s.protocol);

  const [usdmJson, setUsdmJson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportingIch, setExportingIch] = useState(false);

  /**
   * Fetch the USDM JSON preview from the API.
   */
  async function fetchUsdmPreview() {
    if (!protocolId) return;
    setLoading(true);
    setError('');
    try {
      const data = await exportUSDM(protocolId);
      setUsdmJson(data);
    } catch (err) {
      setError(err.message || 'Failed to load USDM export.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsdmPreview();
  }, [protocolId]);

  /**
   * Download the USDM JSON file.
   */
  function handleDownloadUsdm() {
    if (!usdmJson) return;
    const blob = new Blob([JSON.stringify(usdmJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${protocol?.protocolNumber || 'protocol'}_usdm_v3.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Trigger ICH M11 document download from API.
   */
  async function handleDownloadIchM11() {
    setExportingIch(true);
    try {
      const blob = await exportICHM11(protocolId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${protocol?.protocolNumber || 'protocol'}_ich_m11.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to export ICH M11 document.');
    } finally {
      setExportingIch(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page heading */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Export & Preview</h2>
        <p className="text-sm text-gray-500 mt-1">
          Export protocol in USDM v3.0 JSON or ICH M11 document format
        </p>
      </div>

      {/* Export actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* USDM JSON Export Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">USDM v3.0 JSON</h3>
              <p className="text-xs text-gray-500 mt-1">
                TransCelerate Digital Data Flow (DDF) Unified Study Definitions Model format.
                Machine-readable, standards-compliant.
              </p>
              <button
                onClick={handleDownloadUsdm}
                disabled={!usdmJson || loading}
                className="mt-3 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download USDM JSON
              </button>
            </div>
          </div>
        </div>

        {/* ICH M11 Document Export Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">ICH M11 Document</h3>
              <p className="text-xs text-gray-500 mt-1">
                Clinical trial protocol template per ICH M11 guideline.
                Human-readable document for regulatory submission.
              </p>
              <button
                onClick={handleDownloadIchM11}
                disabled={exportingIch}
                className="mt-3 inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                {exportingIch ? (
                  <>
                    <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download ICH M11 Doc
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status indicator */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={fetchUsdmPreview}
            className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* USDM JSON Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              USDM v3.0 JSON Preview
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              TransCelerate DDF output for digital data flow
            </p>
          </div>
          <button
            onClick={fetchUsdmPreview}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-6 w-6 text-indigo-500 mr-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-gray-500">Generating USDM export...</span>
            </div>
          ) : usdmJson ? (
            <pre className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto text-xs leading-relaxed max-h-[600px] overflow-y-auto font-mono">
              {JSON.stringify(usdmJson, null, 2)}
            </pre>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">
                {error ? 'Failed to load preview. Click Refresh to retry.' : 'No preview available.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
