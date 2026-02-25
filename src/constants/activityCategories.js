/**
 * Activity Categories Configuration
 * These are UI categories for organizing activities
 */
export const ACTIVITY_CATEGORIES = [
  { id: 'ADMIN', name: 'Administrative', icon: '📋', color: 'slate' },
  { id: 'CLINICAL', name: 'Clinical Assessments', icon: '🩺', color: 'blue' },
  { id: 'LABORATORY', name: 'Laboratory', icon: '🧪', color: 'purple' },
  { id: 'IMAGING', name: 'Imaging', icon: '📷', color: 'indigo' },
  { id: 'EFFICACY', name: 'Efficacy', icon: '📊', color: 'green' },
  { id: 'SAFETY', name: 'Safety', icon: '⚠️', color: 'amber' },
  { id: 'PK', name: 'Pharmacokinetics', icon: '💊', color: 'rose' },
  { id: 'TREATMENT', name: 'Study Treatment', icon: '💉', color: 'cyan' },
  { id: 'PRO', name: 'Patient Reported Outcomes', icon: '📝', color: 'teal' },
];

/**
 * Epoch Types Configuration
 */
export const EPOCH_TYPES = [
  { code: 'SCREENING', label: 'Screening', color: 'purple' },
  { code: 'RUN_IN', label: 'Run-in', color: 'indigo' },
  { code: 'TREATMENT', label: 'Treatment', color: 'blue' },
  { code: 'FOLLOW_UP', label: 'Follow-up', color: 'green' },
  { code: 'WASHOUT', label: 'Washout', color: 'amber' },
];

/**
 * Timing Types
 */
export const TIMING_TYPES = [
  { code: 'FIXED', label: 'Fixed', desc: 'Exact study day' },
  { code: 'RELATIVE', label: 'Relative', desc: 'Relative to anchor' },
  { code: 'WINDOW', label: 'Window', desc: 'Study day with window' },
];

