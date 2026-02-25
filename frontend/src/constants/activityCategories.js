/**
 * Activity Categories Configuration
 * These are UI categories for organizing activities in the SOA grid
 */
export const ACTIVITY_CATEGORIES = [
  { id: 'ADMIN', name: 'Administrative', icon: 'clipboard', color: 'slate' },
  { id: 'CLINICAL', name: 'Clinical Assessments', icon: 'stethoscope', color: 'blue' },
  { id: 'LABORATORY', name: 'Laboratory', icon: 'flask', color: 'purple' },
  { id: 'IMAGING', name: 'Imaging', icon: 'camera', color: 'indigo' },
  { id: 'EFFICACY', name: 'Efficacy', icon: 'chart', color: 'green' },
  { id: 'SAFETY', name: 'Safety', icon: 'shield', color: 'amber' },
  { id: 'PK', name: 'Pharmacokinetics', icon: 'pill', color: 'rose' },
  { id: 'TREATMENT', name: 'Study Treatment', icon: 'syringe', color: 'cyan' },
  { id: 'PRO', name: 'Patient Reported Outcomes', icon: 'document', color: 'teal' },
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
