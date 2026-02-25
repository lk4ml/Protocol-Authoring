import React, { useState } from 'react';

/**
 * PatternSuggestions - Suggests scheduling patterns based on study epochs.
 *
 * Shows a collapsible banner recommending standard activity bundles
 * (e.g., "Standard Screening Visit") based on the protocol's epoch types.
 */
export default function PatternSuggestions({
  patterns,
  catalogActivities,
  epochs,
  encounters,
  onApplyPattern,
  onDismiss,
}) {
  const [expandedPattern, setExpandedPattern] = useState(null);

  if (!patterns || patterns.length === 0) return null;
  if (!epochs || epochs.length === 0) return null;

  // Extract epoch types (handle CDISC coded objects)
  const epochTypes = new Set();
  epochs.forEach((e) => {
    const type = e.type;
    if (!type) return;
    if (typeof type === 'string') {
      epochTypes.add(type.toUpperCase());
    } else if (typeof type === 'object') {
      const decoded = (type.decode || type.code || '').toUpperCase();
      if (decoded) epochTypes.add(decoded);
    }
  });

  // Filter patterns to those matching current epoch types
  const relevantPatterns = patterns.filter((p) => {
    const patternEpoch = (p.epochType || '').toUpperCase();
    // Match if any epoch type contains the pattern epoch type
    return [...epochTypes].some(
      (et) => et.includes(patternEpoch) || patternEpoch.includes(et)
    );
  });

  // If no patterns match, show all patterns as suggestions
  const displayPatterns = relevantPatterns.length > 0 ? relevantPatterns : patterns;

  // Build a lookup map for catalog activities by ID
  const activityMap = new Map();
  if (catalogActivities) {
    catalogActivities.forEach((a) => activityMap.set(a.id, a));
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-indigo-900">
              Suggested Activity Patterns
            </h4>
            <p className="text-[10px] text-indigo-600 mt-0.5">
              Quick-add standard activity bundles based on CDISC standards
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-indigo-400 hover:text-indigo-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {displayPatterns.map((pattern) => {
          const isExpanded = expandedPattern === pattern.id;
          const patternActivities = (pattern.activityIds || [])
            .map((id) => activityMap.get(id))
            .filter(Boolean);

          return (
            <div key={pattern.id} className="bg-white border border-indigo-200 rounded-lg overflow-hidden">
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-900">
                    {pattern.name}
                  </span>
                  <span className="text-[10px] font-medium text-indigo-600">
                    {pattern.activityIds?.length || 0} activities
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mb-2">{pattern.description}</p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onApplyPattern(pattern)}
                    className="inline-flex items-center px-2.5 py-1 bg-indigo-600 text-white rounded text-[10px] font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Apply
                  </button>
                  {patternActivities.length > 0 && (
                    <button
                      onClick={() => setExpandedPattern(isExpanded ? null : pattern.id)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      {isExpanded ? 'Hide' : 'Preview'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded preview of activities in pattern */}
              {isExpanded && patternActivities.length > 0 && (
                <div className="border-t border-indigo-100 bg-indigo-50 px-3 py-2">
                  <div className="space-y-1">
                    {patternActivities.map((act) => (
                      <div key={act.id} className="flex items-center space-x-1.5 text-[10px]">
                        <span className="w-6 text-center font-semibold text-indigo-600">
                          {act.sdtmDomain || '—'}
                        </span>
                        <span className="text-gray-700">{act.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
