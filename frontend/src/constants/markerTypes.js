/**
 * Shared marker type definitions used by both Schema View (DesignCanvas)
 * and Graph Builder (GraphDesigner).
 *
 * Each marker type has visual config (color, shape) and metadata (label, description).
 * The key is UPPER_SNAKE (e.g. RANDOMIZATION), the `id` is lower_snake (e.g. randomization).
 */

export const MARKER_TYPES = {
  RANDOMIZATION: {
    id: 'randomization',
    shortLabel: 'R',
    fullLabel: 'Randomization',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
    shape: 'circle',
    description: 'Randomization point — patients are randomly assigned to arms',
  },
  INTERIM_ANALYSIS: {
    id: 'interim_analysis',
    shortLabel: 'IA',
    fullLabel: 'Interim Analysis',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#c4b5fd',
    shape: 'diamond',
    description: 'Interim analysis — data reviewed, arms may be dropped',
  },
  DECISION_POINT: {
    id: 'decision_point',
    shortLabel: 'D',
    fullLabel: 'Decision Point',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
    shape: 'hexagon',
    description: 'Decision point — adaptive dose escalation or response-based allocation',
  },
  STRATIFICATION: {
    id: 'stratification',
    shortLabel: 'S',
    fullLabel: 'Stratification',
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#67e8f9',
    shape: 'circle',
    description: 'Stratification — patients grouped by prognostic factor before randomization',
  },
};

/**
 * Look up marker type config by lowercase type id string.
 * Falls back to RANDOMIZATION if type not found.
 */
export function getMarkerType(typeId) {
  const key = (typeId || '').toUpperCase();
  return MARKER_TYPES[key] || MARKER_TYPES.RANDOMIZATION;
}

/**
 * All marker types as an ordered array (for toolbars / pickers).
 */
export const MARKER_TYPE_LIST = Object.values(MARKER_TYPES);
