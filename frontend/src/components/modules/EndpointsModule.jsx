import React from 'react';
import useDesignStore from '../../store/useDesignStore';
import ReferenceToggleButton from '../reference/ReferenceToggleButton';

/**
 * Objective level configuration with explicit Tailwind classes.
 */
const OBJECTIVE_LEVELS = [
  { value: 'PRIMARY', label: 'Primary', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', accent: 'border-l-indigo-500' },
  { value: 'SECONDARY', label: 'Secondary', badge: 'bg-blue-100 text-blue-700 border-blue-200', accent: 'border-l-blue-500' },
  { value: 'EXPLORATORY', label: 'Exploratory', badge: 'bg-gray-100 text-gray-600 border-gray-200', accent: 'border-l-gray-400' },
];

/**
 * Endpoint purpose options.
 */
const ENDPOINT_PURPOSES = [
  { value: 'EFFICACY', label: 'Efficacy' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'PK', label: 'Pharmacokinetics' },
];

/**
 * EndpointsModule - Objectives and endpoints editor.
 * Each objective can have nested endpoints.
 */
export default function EndpointsModule() {
  const objectives = useDesignStore((s) => s.objectives) || [];
  const setObjectives = useDesignStore((s) => s.setObjectives);
  const loading = useDesignStore((s) => s.loading);

  function updateObjectives(newObjectives) {
    setObjectives(newObjectives);
  }

  /**
   * Add a new objective.
   */
  function addObjective() {
    const updated = [...objectives];
    updated.push({
      id: `obj_${Date.now()}`,
      level: 'PRIMARY',
      name: '',
      description: '',
      endpoints: [],
    });
    updateObjectives(updated);
  }

  /**
   * Remove an objective.
   */
  function removeObjective(index) {
    const updated = [...objectives];
    updated.splice(index, 1);
    updateObjectives(updated);
  }

  /**
   * Update an objective field.
   */
  function updateObjective(index, field, value) {
    const updated = [...objectives];
    updated[index] = { ...updated[index], [field]: value };
    updateObjectives(updated);
  }

  /**
   * Add a new endpoint to an objective.
   */
  function addEndpoint(objIndex) {
    const updated = [...objectives];
    const obj = { ...updated[objIndex] };
    obj.endpoints = [...(obj.endpoints || [])];
    obj.endpoints.push({
      id: `ep_${Date.now()}`,
      name: '',
      description: '',
      purpose: 'EFFICACY',
    });
    updated[objIndex] = obj;
    updateObjectives(updated);
  }

  /**
   * Remove an endpoint from an objective.
   */
  function removeEndpoint(objIndex, epIndex) {
    const updated = [...objectives];
    const obj = { ...updated[objIndex] };
    obj.endpoints = [...(obj.endpoints || [])];
    obj.endpoints.splice(epIndex, 1);
    updated[objIndex] = obj;
    updateObjectives(updated);
  }

  /**
   * Update an endpoint field.
   */
  function updateEndpoint(objIndex, epIndex, field, value) {
    const updated = [...objectives];
    const obj = { ...updated[objIndex] };
    obj.endpoints = [...(obj.endpoints || [])];
    obj.endpoints[epIndex] = { ...obj.endpoints[epIndex], [field]: value };
    updated[objIndex] = obj;
    updateObjectives(updated);
  }

  /**
   * Extract a display string from a value that may be a string or CDISC coded object.
   */
  function codedValue(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.decode || val.code || '';
    return String(val);
  }

  /**
   * Get style config for a given objective level.
   * Handles both string levels ("PRIMARY") and CDISC coded objects ({decode: "Primary"}).
   */
  function getLevelConfig(level) {
    const label = codedValue(level).toUpperCase();
    return OBJECTIVE_LEVELS.find((l) => l.value === label) || OBJECTIVE_LEVELS[0];
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-gray-500">Loading protocol...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Objectives & Endpoints</h2>
          <p className="text-sm text-gray-500 mt-1">
            Define study objectives and their associated endpoints (ICH M11 Section 2 & 6)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ReferenceToggleButton context="endpoints" />
          <button
            onClick={addObjective}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Objective
          </button>
        </div>
      </div>

      {objectives.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="text-sm text-gray-500 font-medium">No objectives defined yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add your first study objective to define endpoints.</p>
          <button
            onClick={addObjective}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            + Add first objective
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {objectives.map((obj, objIndex) => {
            const levelConfig = getLevelConfig(obj.level);
            return (
              <div
                key={obj.id || objIndex}
                className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden border-l-4 ${levelConfig.accent}`}
              >
                {/* Objective header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${levelConfig.badge}`}>
                      {levelConfig.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      Objective {objIndex + 1}
                    </span>
                  </div>
                  <button
                    onClick={() => removeObjective(objIndex)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove objective"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>

                {/* Objective form */}
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Level
                      </label>
                      <select
                        value={codedValue(obj.level).toUpperCase() || 'PRIMARY'}
                        onChange={(e) => updateObjective(objIndex, 'level', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        {OBJECTIVE_LEVELS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Objective Name
                      </label>
                      <input
                        type="text"
                        value={obj.name || ''}
                        onChange={(e) => updateObjective(objIndex, 'name', e.target.value)}
                        placeholder="e.g., Evaluate overall survival benefit"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Description
                    </label>
                    <textarea
                      value={obj.description || ''}
                      onChange={(e) => updateObjective(objIndex, 'description', e.target.value)}
                      rows={2}
                      placeholder="Detailed description of the objective..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow resize-none"
                    />
                  </div>

                  {/* Endpoints section */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Endpoints
                      </h4>
                      <button
                        onClick={() => addEndpoint(objIndex)}
                        className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Endpoint
                      </button>
                    </div>

                    {(!obj.endpoints || obj.endpoints.length === 0) ? (
                      <div className="py-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <p className="text-xs text-gray-400">No endpoints for this objective.</p>
                        <button
                          onClick={() => addEndpoint(objIndex)}
                          className="mt-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          + Add endpoint
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {obj.endpoints.map((ep, epIndex) => (
                          <div
                            key={ep.id || epIndex}
                            className="p-4 bg-gray-50 rounded-lg border border-gray-200 group"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-xs text-gray-400 font-medium">
                                Endpoint {epIndex + 1}
                              </span>
                              <button
                                onClick={() => removeEndpoint(objIndex, epIndex)}
                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                title="Remove endpoint"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  Endpoint Name
                                </label>
                                <input
                                  type="text"
                                  value={ep.name || ''}
                                  onChange={(e) => updateEndpoint(objIndex, epIndex, 'name', e.target.value)}
                                  placeholder="e.g., Overall Survival (OS)"
                                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  Purpose
                                </label>
                                <select
                                  value={ep.purpose || 'EFFICACY'}
                                  onChange={(e) => updateEndpoint(objIndex, epIndex, 'purpose', e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                >
                                  {ENDPOINT_PURPOSES.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Description
                              </label>
                              <textarea
                                value={ep.description || ''}
                                onChange={(e) => updateEndpoint(objIndex, epIndex, 'description', e.target.value)}
                                rows={2}
                                placeholder="How this endpoint will be measured..."
                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white resize-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
