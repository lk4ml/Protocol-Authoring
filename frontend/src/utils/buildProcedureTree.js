/**
 * buildProcedureTree.js
 *
 * Transforms the flat CDISC activity catalog (1,819 items) into a categorised
 * procedure tree suitable for the ProcedurePicker component.
 *
 * The catalog contains:
 *   - hierarchyLevel 0  => procedure-level BCs (230 entries, no parent)
 *   - hierarchyLevel 1  => sub-items under a procedure (508 entries, parentId = raw NCI code)
 *   - hierarchyLevel null => SDTM variable-level items (too granular for SOA rows)
 *
 * The output groups level-0 procedures by uiCategory, attaches their level-1
 * children, and sorts alphabetically.
 */

/**
 * Category display metadata — order, colours, and labels.
 * Matches ACTIVITY_CATEGORIES in SOAModule.jsx.
 */
const CATEGORY_META = [
  { id: 'ADMIN', name: 'Administrative', bgHeader: 'bg-slate-100', textHeader: 'text-slate-700', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-700' },
  { id: 'CLINICAL', name: 'Clinical Assessments', bgHeader: 'bg-blue-100', textHeader: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  { id: 'LABORATORY', name: 'Laboratory', bgHeader: 'bg-purple-100', textHeader: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  { id: 'IMAGING', name: 'Imaging', bgHeader: 'bg-indigo-100', textHeader: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
  { id: 'EFFICACY', name: 'Efficacy', bgHeader: 'bg-green-100', textHeader: 'text-green-700', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
  { id: 'SAFETY', name: 'Safety', bgHeader: 'bg-amber-100', textHeader: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  { id: 'PK', name: 'Pharmacokinetics', bgHeader: 'bg-rose-100', textHeader: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
  { id: 'TREATMENT', name: 'Study Treatment', bgHeader: 'bg-cyan-100', textHeader: 'text-cyan-700', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700' },
  { id: 'PRO', name: 'Patient Reported Outcomes', bgHeader: 'bg-teal-100', textHeader: 'text-teal-700', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-700' },
];

/**
 * Build a categorised procedure tree from the flat catalog.
 *
 * @param {Array} activities - The full activities array from activity_catalog.json
 * @returns {Array<{ category: Object, procedures: Array<Object> }>}
 *   Each entry has:
 *     - category: { id, name, bgHeader, textHeader, border, badge }
 *     - procedures: sorted array of level-0 activities, each with a `children` array
 */
export default function buildProcedureTree(activities) {
  if (!activities || activities.length === 0) return [];

  // Index all level-1 children by their parentId (raw NCI code)
  const childrenByParentNci = {};
  activities.forEach((a) => {
    if (a.hierarchyLevel === 1 && a.parentId) {
      if (!childrenByParentNci[a.parentId]) {
        childrenByParentNci[a.parentId] = [];
      }
      childrenByParentNci[a.parentId].push(a);
    }
  });

  // Sort each child group alphabetically
  Object.values(childrenByParentNci).forEach((group) => {
    group.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  });

  // Extract level-0 procedures and attach children
  const procedures = activities
    .filter((a) => a.hierarchyLevel === 0)
    .map((proc) => ({
      ...proc,
      children: childrenByParentNci[proc.nciCode] || [],
    }));

  // Group by uiCategory
  const byCategory = {};
  procedures.forEach((proc) => {
    const cat = proc.uiCategory || 'OTHER';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(proc);
  });

  // Sort each category's procedures alphabetically
  Object.values(byCategory).forEach((group) => {
    group.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  });

  // Build the output array in category display order
  const result = [];
  CATEGORY_META.forEach((meta) => {
    const procs = byCategory[meta.id];
    if (procs && procs.length > 0) {
      result.push({ category: meta, procedures: procs });
    }
  });

  // Catch any uncategorised procedures
  const knownIds = new Set(CATEGORY_META.map((m) => m.id));
  Object.keys(byCategory).forEach((catId) => {
    if (!knownIds.has(catId)) {
      result.push({
        category: { id: catId, name: catId, bgHeader: 'bg-gray-100', textHeader: 'text-gray-700', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' },
        procedures: byCategory[catId],
      });
    }
  });

  return result;
}

export { CATEGORY_META };
