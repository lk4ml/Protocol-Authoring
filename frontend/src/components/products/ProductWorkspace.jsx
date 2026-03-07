import React from 'react';
import { useNavigate } from 'react-router-dom';
import StudyPicker from './StudyPicker';

/**
 * ProductWorkspace — unified study registration page.
 * Register once → enter the sequential workspace.
 * URL: /workspace
 */
export default function ProductWorkspace() {
  const navigate = useNavigate();

  function handleStudyReady(protocolId) {
    // Go straight to Study Design (first real step after protocol info)
    navigate(`/study/${protocolId}/design`);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">

      {/* ── Sticky top bar ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-950 flex items-center justify-center">
              <svg className="text-white" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <path d="M7 2 C7 6.5, 17 8.5, 17 12 C17 15.5, 7 17.5, 7 22" />
                <path d="M17 2 C17 6.5, 7 8.5, 7 12 C7 15.5, 17 17.5, 17 22" />
                <line x1="9" y1="5.5" x2="15" y2="5.5" strokeOpacity="0.5" />
                <line x1="7.8" y1="9" x2="16.2" y2="9" strokeOpacity="0.5" />
                <line x1="7.5" y1="12" x2="16.5" y2="12" strokeOpacity="0.5" />
                <line x1="7.8" y1="15" x2="16.2" y2="15" strokeOpacity="0.5" />
                <line x1="9" y1="18.5" x2="15" y2="18.5" strokeOpacity="0.5" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">ProtoHelix</span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Home
          </button>
        </div>
      </nav>

      {/* ── Thin accent stripe ─────────────────────────────────────────── */}
      <div className="h-0.5 bg-gradient-to-r from-brand-600 via-purple-600 to-emerald-600" />

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-gray-900">Start a new study or continue where you left off</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Register once, then work through Study Design, SOA, Eligibility Criteria, and Burden Analysis — all in sequence.
          </p>
        </div>

        <StudyPicker
          onStudyCreated={handleStudyReady}
          onStudySelected={handleStudyReady}
          productName="ProtoHelix"
          accentColor="brand"
        />
      </main>

      {/* ── Minimal footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-gray-400">ProtoHelix</span>
          <span className="text-[11px] text-gray-300">USDM v3.0 · ICH M11 · CDISC</span>
        </div>
      </footer>
    </div>
  );
}
