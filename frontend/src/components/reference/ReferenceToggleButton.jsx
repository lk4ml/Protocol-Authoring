import React from 'react';
import useReferenceStore from '../../store/useReferenceStore';

/**
 * ReferenceToggleButton — Small button to open/close the reference panel.
 * Placed in each module's header area. Shows count of reference trials.
 *
 * @param {string} context — 'design' | 'eligibility' | 'endpoints' | 'soa'
 */
export default function ReferenceToggleButton({ context }) {
  const trials = useReferenceStore((s) => s.trials);
  const panelOpen = useReferenceStore((s) => s.panelOpen);
  const panelContext = useReferenceStore((s) => s.panelContext);
  const togglePanel = useReferenceStore((s) => s.togglePanel);

  if (!trials || trials.length === 0) return null;

  const isActive = panelOpen && panelContext === context;

  return (
    <button
      onClick={() => togglePanel(context)}
      className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm ${
        isActive
          ? 'bg-indigo-100 text-indigo-700 border border-indigo-300 ring-2 ring-indigo-200'
          : 'bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200'
      }`}
      title="Toggle reference trials panel"
    >
      {/* Book icon */}
      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
      References
      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
        isActive
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-200 text-gray-600'
      }`}>
        {trials.length}
      </span>
    </button>
  );
}
