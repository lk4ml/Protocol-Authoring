import React from 'react';

/**
 * DesignToolbar — Toolbar above the design canvas.
 *
 * Controls for templates, zoom, fit-to-view.
 *
 * Props:
 *   zoom            - Current zoom level (0.5 to 1.5)
 *   onZoomChange    - (newZoom) => void
 *   onFitToView     - () => void
 *   onShowTemplates - () => void
 */
export default function DesignToolbar({ zoom, onZoomChange, onFitToView, onShowTemplates }) {
  return (
    <div className="px-4 py-2.5 border-b border-gray-200 bg-white flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Trial Schema
        </h3>
        <span className="text-[10px] text-gray-400">
          Drag elements from the palette into cells
        </span>
      </div>

      <div className="flex items-center space-x-3">
        {/* Template Button */}
        <button
          onClick={onShowTemplates}
          className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          <svg className="w-3.5 h-3.5 mr-1.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Templates
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200" />

        {/* Zoom Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onZoomChange(Math.max(0.5, (zoom || 1) - 0.1))}
            className="w-6 h-6 flex items-center justify-center bg-white border border-gray-300 rounded text-gray-500 hover:bg-gray-50 text-xs transition-colors"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-[10px] text-gray-500 font-mono w-10 text-center">
            {Math.round((zoom || 1) * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(1.5, (zoom || 1) + 0.1))}
            className="w-6 h-6 flex items-center justify-center bg-white border border-gray-300 rounded text-gray-500 hover:bg-gray-50 text-xs transition-colors"
            title="Zoom in"
          >
            +
          </button>
        </div>

        {/* Fit to View */}
        <button
          onClick={onFitToView}
          className="inline-flex items-center px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
          title="Fit to view"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
