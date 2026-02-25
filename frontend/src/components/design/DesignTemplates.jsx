import React, { useState } from 'react';
import useDesignStore from '../../store/useDesignStore';
import { DESIGN_TEMPLATES } from './designTemplateData';

/**
 * DesignTemplates — Template picker for common trial designs.
 *
 * Displayed when the design is empty or when the user clicks "Templates"
 * in the toolbar. Shows a grid of template cards that auto-populate
 * the arms, epochs, elements, and cells when selected.
 *
 * Props:
 *   onClose() — Dismiss the template picker
 *   isOverlay — If true, renders as a modal overlay (when existing design present)
 */
export default function DesignTemplates({ onClose, isOverlay = false }) {
  const arms = useDesignStore((s) => s.arms) || [];
  const loadTemplate = useDesignStore((s) => s.loadTemplate);
  const [confirmTemplate, setConfirmTemplate] = useState(null);

  function handleSelect(template) {
    // If there's an existing design, confirm before overwriting
    if (arms.length > 0) {
      setConfirmTemplate(template);
    } else {
      loadTemplate(template);
      if (onClose) onClose();
    }
  }

  function handleConfirm() {
    if (confirmTemplate) {
      loadTemplate(confirmTemplate);
      setConfirmTemplate(null);
      if (onClose) onClose();
    }
  }

  const wrapperClass = isOverlay
    ? 'fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-8'
    : '';

  const cardContainerClass = isOverlay
    ? 'bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-4xl w-full max-h-[80vh] overflow-hidden'
    : 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden';

  return (
    <div className={wrapperClass} onClick={isOverlay ? onClose : undefined}>
      <div className={cardContainerClass} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              Choose a Trial Design Template
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Start with a pre-configured design or build from scratch
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Start from Scratch
            </button>
            {isOverlay && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Template Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Section: Real-world oncology trials */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
              Real-World Oncology Protocols
            </h4>
            <p className="text-[10px] text-gray-400 mb-3">Based on actual Phase 2-3 clinical trials</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {DESIGN_TEMPLATES.filter(t => ['checkmate-816','laura-trial','dellphi-301'].includes(t.meta.id)).map((template) => {
              const meta = template.meta;
              return (
                <button
                  key={meta.id}
                  onClick={() => handleSelect(template)}
                  className="text-left p-4 rounded-xl border-2 border-indigo-100 hover:border-indigo-400 hover:shadow-md bg-indigo-50/30 transition-all group"
                >
                  <div className="text-2xl mb-2">{meta.icon}</div>
                  <h4 className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">
                    {meta.name}
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{meta.description}</p>
                  <div className="flex items-center space-x-3 mt-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium">
                      {template.arms.length} {template.arms.length === 1 ? 'Arm' : 'Arms'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-medium">
                      {template.epochs.length} Epochs
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Section: Standard design templates */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Standard Design Templates
            </h4>
            <p className="text-[10px] text-gray-400 mb-3">Generic trial design patterns for any therapeutic area</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DESIGN_TEMPLATES.filter(t => !['checkmate-816','laura-trial','dellphi-301'].includes(t.meta.id)).map((template) => {
              const meta = template.meta;
              return (
                <button
                  key={meta.id}
                  onClick={() => handleSelect(template)}
                  className="text-left p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:shadow-md bg-white transition-all group"
                >
                  {/* Icon */}
                  <div className="text-2xl mb-2">{meta.icon}</div>

                  {/* Name */}
                  <h4 className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">
                    {meta.name}
                  </h4>

                  {/* Description */}
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                    {meta.description}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center space-x-3 mt-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium">
                      {template.arms.length} {template.arms.length === 1 ? 'Arm' : 'Arms'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-medium">
                      {template.epochs.length} Epochs
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-medium">
                      {template.elements.length} Elements
                    </span>
                  </div>

                  {/* Tags */}
                  {meta.tags && meta.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {meta.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Confirmation Dialog */}
        {confirmTemplate && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-md mx-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Replace Current Design?</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Loading the <strong>{confirmTemplate.meta.name}</strong> template will replace your current
                    design ({arms.length} arms). This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-5">
                <button
                  onClick={() => setConfirmTemplate(null)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                >
                  Keep Current
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
                >
                  Replace Design
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
