import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useProtocolStore from '../../store/useProtocolStore';
import useDesignStore from '../../store/useDesignStore';
import useScheduleStore from '../../store/useScheduleStore';

/**
 * Header - Top bar showing protocol info, save status, and export actions.
 */
export default function Header() {
  const { id: protocolId } = useParams();
  const protocol = useProtocolStore((s) => s.protocol);
  const protocolDirty = useProtocolStore((s) => s.dirty);
  const designDirty = useDesignStore((s) => s.dirty);
  const scheduleDirty = useScheduleStore((s) => s.dirty);

  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  const isDirty = protocolDirty || designDirty || scheduleDirty;
  const protocolNumber = protocol?.protocolNumber || '';
  const shortTitle = protocol?.shortTitle || '';

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Manually trigger save on all dirty stores.
   */
  async function handleSave() {
    setSaving(true);
    try {
      if (protocolDirty) await useProtocolStore.getState().saveProtocol();
      if (designDirty) await useDesignStore.getState().saveDesign(protocolId);
      if (scheduleDirty) await useScheduleStore.getState().saveSchedule(protocolId);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Trigger a file download from an API endpoint.
   */
  function handleExport(format) {
    setExportOpen(false);
    const baseUrl = 'http://localhost:8001/api';
    if (format === 'usdm') {
      window.open(`${baseUrl}/protocols/${protocolId}/export/usdm`, '_blank');
    } else if (format === 'ich-m11') {
      window.open(`${baseUrl}/protocols/${protocolId}/export/ich-m11`, '_blank');
    }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: Protocol identification */}
      <div className="flex items-center space-x-3 min-w-0">
        <h1 className="text-sm font-semibold text-gray-900 truncate">
          {protocolNumber}
        </h1>
        {shortTitle && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500 truncate max-w-md">
              {shortTitle}
            </span>
          </>
        )}
        {isDirty && (
          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
            Unsaved changes
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-3">
        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={`inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium transition-colors ${
            saving || !isDirty
              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
          }`}
        >
          {saving ? (
            <>
              <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save
            </>
          )}
        </button>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="inline-flex items-center px-3 py-1.5 border border-indigo-300 rounded-md text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Export
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-1 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1">
                <button
                  onClick={() => handleExport('usdm')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium">USDM v3.0 JSON</span>
                  <span className="block text-xs text-gray-500">TransCelerate DDF format</span>
                </button>
                <button
                  onClick={() => handleExport('ich-m11')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium">ICH M11 Document</span>
                  <span className="block text-xs text-gray-500">Protocol template document</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
