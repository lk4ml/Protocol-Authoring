import React, { useState, useMemo, useRef, useEffect } from 'react';
import useScheduleStore from '../../store/useScheduleStore';
import useDesignStore from '../../store/useDesignStore';
import useTerminologyStore from '../../store/useTerminologyStore';
import ProcedurePicker from './SOA/ProcedurePicker';
import TrialImporter from './SOA/TrialImporter';
import PatternSuggestions from './SOA/PatternSuggestions';
import BurdenAnalytics from './SOA/BurdenAnalytics';
import buildProcedureTree from '../../utils/buildProcedureTree';
import ReferenceToggleButton from '../reference/ReferenceToggleButton';

/**
 * Legacy activity categories (fallback when no hierarchy loaded).
 */
const ACTIVITY_CATEGORIES = [
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
 * Find a scheduled instance at the intersection of activity x encounter.
 */
function getCellDisplay(instances, activityId, encounterId) {
  if (!instances) return null;
  const instance = instances.find((inst) => {
    const matchEnc = inst.encounterId === encounterId;
    const matchAct =
      inst.activityId === activityId ||
      (Array.isArray(inst.activityIds) && inst.activityIds.includes(activityId));
    return matchEnc && matchAct;
  });
  return instance || null;
}

/**
 * Chevron icon with rotation animation.
 */
function ChevronIcon({ collapsed }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '-rotate-90' : 'rotate-0'}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// InlineEditCell -- click-to-edit text cell for column headers
// ---------------------------------------------------------------------------
function InlineEditCell({ value, placeholder, onSave, className = '', inputClassName = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(value || '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== (value || '')) {
      onSave(draft);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setEditing(false); setDraft(value || ''); }
    if (e.key === 'Tab') { commit(); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full bg-white border border-indigo-400 rounded px-1 py-0.5 text-center text-[11px] focus:ring-1 focus:ring-indigo-400 outline-none ${inputClassName}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 rounded px-1 py-0.5 transition-colors inline-block min-w-[24px] ${className}`}
      title="Click to edit"
    >
      {value || <span className="text-gray-300 italic">{placeholder || '\u2014'}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SOAModule
// ---------------------------------------------------------------------------
export default function SOAModule() {
  // Schedule store
  const encounters = useScheduleStore((s) => s.encounters) || [];
  const activities = useScheduleStore((s) => s.activities) || [];
  const timelines = useScheduleStore((s) => s.timelines) || [];
  const soaGroups = useScheduleStore((s) => s.soaGroups) || [];
  const activityGroups = useScheduleStore((s) => s.activityGroups) || [];
  const collapsedGroups = useScheduleStore((s) => s.collapsedGroups) || {};
  const addEncounter = useScheduleStore((s) => s.addEncounter);
  const updateEncounter = useScheduleStore((s) => s.updateEncounter);
  const removeEncounter = useScheduleStore((s) => s.removeEncounter);
  const addActivity = useScheduleStore((s) => s.addActivity);
  const removeActivity = useScheduleStore((s) => s.removeActivity);
  const toggleInstance = useScheduleStore((s) => s.toggleInstance);
  const toggleCollapse = useScheduleStore((s) => s.toggleCollapse);
  const expandAll = useScheduleStore((s) => s.expandAll);
  const collapseAll = useScheduleStore((s) => s.collapseAll);
  const initHierarchyFromTerminology = useScheduleStore((s) => s.initHierarchyFromTerminology);

  // Design & terminology stores
  const epochs = useDesignStore((s) => s.epochs) || [];
  const sdtmDomains = useTerminologyStore((s) => s.sdtmDomains) || [];
  const activityCatalog = useTerminologyStore((s) => s.activityCatalog);
  const procedureLibrary = useTerminologyStore((s) => s.procedureLibrary);
  const soaHierarchy = useTerminologyStore((s) => s.soaHierarchy);

  // Initialize SOA hierarchy from terminology if not yet persisted
  useEffect(() => {
    if (soaHierarchy && soaGroups.length === 0) {
      initHierarchyFromTerminology(soaHierarchy);
    }
  }, [soaHierarchy, soaGroups.length, initHierarchyFromTerminology]);

  // Catalog data
  const catalogActivities = activityCatalog?.activities || [];
  const catalogPatterns = activityCatalog?.schedulingPatterns || [];

  // Procedure tree (for picker)
  const procedureTree = useMemo(
    () => buildProcedureTree(catalogActivities),
    [catalogActivities]
  );

  // Set of already-added activity names (lowercase) for de-duplication
  const addedActivityNames = useMemo(
    () => new Set(activities.map((a) => (a.name || '').toLowerCase())),
    [activities]
  );

  // UI state
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [activityMode, setActivityMode] = useState('browse');
  const [activityForm, setActivityForm] = useState({ name: '', category: '', sdtmDomain: '' });
  const [showPatternSuggestions, setShowPatternSuggestions] = useState(true);
  const [activitySearch, setActivitySearch] = useState('');
  const [activeTab, setActiveTab] = useState('schedule');
  const [pickerCategory, setPickerCategory] = useState(null);
  const [quickRowName, setQuickRowName] = useState('');
  const [showQuickRow, setShowQuickRow] = useState(false);
  const [showTrialImporter, setShowTrialImporter] = useState(false);
  const quickRowRef = useRef(null);

  // Determine if hierarchy is available
  const hasHierarchy = soaGroups.length > 0;

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const sortedEncounters = useMemo(() => {
    return [...encounters].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [encounters]);

  // Build epoch span map for multi-column headers
  const epochSpans = useMemo(() => {
    const sortedEpochs = [...epochs].sort((a, b) => (a.order || 0) - (b.order || 0));
    const result = [];
    let prevEpochId = null;
    sortedEncounters.forEach((enc) => {
      const epoch = sortedEpochs.find((ep) => (ep.id || ep._id) === enc.epochId);
      const epochId = epoch ? (epoch.id || epoch._id) : '__none';
      if (epochId !== prevEpochId) {
        result.push({ epoch, id: epochId, colSpan: 1 });
        prevEpochId = epochId;
      } else {
        result[result.length - 1].colSpan++;
      }
    });
    return result;
  }, [sortedEncounters, epochs]);

  // -----------------------------------------------------------------------
  // HIERARCHICAL rows: SOA Group -> Activity Group -> Activities
  // -----------------------------------------------------------------------
  const hierarchicalRows = useMemo(() => {
    if (!hasHierarchy) return null;

    const q = activitySearch.toLowerCase().trim();
    const sortedSoaGroups = [...soaGroups].sort((a, b) => (a.order || 0) - (b.order || 0));
    const rows = [];

    sortedSoaGroups.forEach((sg) => {
      // Activity groups under this SOA group
      const childAgs = activityGroups
        .filter((ag) => ag.soaGroupId === sg.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      // All activities for this SOA group (for counting and filtering)
      let soaGroupHasVisibleActivities = false;
      const agRows = [];

      childAgs.forEach((ag) => {
        let agActivities = activities.filter((a) => a.activityGroupId === ag.id);
        // Search filter
        if (q) {
          agActivities = agActivities.filter((a) =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.sdtmDomain || '').toLowerCase().includes(q) ||
            (a.definition || '').toLowerCase().includes(q)
          );
        }
        if (agActivities.length === 0) return;
        soaGroupHasVisibleActivities = true;
        agRows.push({ type: 'activityGroup', ag, activityCount: agActivities.length });
        if (!collapsedGroups[ag.id]) {
          agActivities.forEach((act) => {
            agRows.push({ type: 'activity', activity: act, soaGroup: sg, activityGroup: ag });
          });
        }
      });

      // Also catch activities assigned to this SOA group but no activity group
      let ungroupedActivities = activities.filter(
        (a) => a.soaGroupId === sg.id && !a.activityGroupId
      );
      if (q) {
        ungroupedActivities = ungroupedActivities.filter((a) =>
          (a.name || '').toLowerCase().includes(q) ||
          (a.sdtmDomain || '').toLowerCase().includes(q) ||
          (a.definition || '').toLowerCase().includes(q)
        );
      }
      if (ungroupedActivities.length > 0) {
        soaGroupHasVisibleActivities = true;
        ungroupedActivities.forEach((act) => {
          agRows.push({ type: 'activity', activity: act, soaGroup: sg, activityGroup: null });
        });
      }

      if (!soaGroupHasVisibleActivities) return;

      // Count total activities in this SOA group
      const totalActivitiesInGroup = activities.filter((a) => a.soaGroupId === sg.id).length;

      // Push the SOA group banner row
      rows.push({ type: 'soaGroup', sg, totalActivities: totalActivitiesInGroup });

      // If SOA group is collapsed, skip children
      if (!collapsedGroups[sg.id]) {
        agRows.forEach((r) => rows.push(r));
      }
    });

    // Handle unassigned activities (no soaGroupId at all)
    let unassigned = activities.filter((a) => !a.soaGroupId);
    if (q) {
      unassigned = unassigned.filter((a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.sdtmDomain || '').toLowerCase().includes(q) ||
        (a.definition || '').toLowerCase().includes(q)
      );
    }
    if (unassigned.length > 0) {
      rows.push({
        type: 'soaGroup',
        sg: { id: '__UNASSIGNED', name: 'Unassigned', colorBg: '#F3F4F6', colorText: '#374151', colorBorder: '#D1D5DB' },
        totalActivities: unassigned.length,
      });
      if (!collapsedGroups['__UNASSIGNED']) {
        unassigned.forEach((act) => {
          rows.push({ type: 'activity', activity: act, soaGroup: null, activityGroup: null });
        });
      }
    }

    return rows;
  }, [hasHierarchy, soaGroups, activityGroups, activities, collapsedGroups, activitySearch]);

  // -----------------------------------------------------------------------
  // LEGACY flat grouping (when no hierarchy)
  // -----------------------------------------------------------------------
  const activitiesByCategory = useMemo(() => {
    const groups = [];
    ACTIVITY_CATEGORIES.forEach((cat) => {
      const catActivities = activities.filter(
        (a) => (a.uiCategory || a.category) === cat.id
      );
      if (catActivities.length > 0) {
        groups.push({ category: cat, activities: catActivities });
      }
    });
    const uncategorized = activities.filter(
      (a) => !ACTIVITY_CATEGORIES.some((cat) => cat.id === (a.uiCategory || a.category))
    );
    if (uncategorized.length > 0) {
      groups.push({
        category: { id: 'OTHER', name: 'Other', bgHeader: 'bg-gray-100', textHeader: 'text-gray-700', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' },
        activities: uncategorized,
      });
    }
    return groups;
  }, [activities]);

  const filteredByCategory = useMemo(() => {
    if (!activitySearch.trim()) return activitiesByCategory;
    const q = activitySearch.toLowerCase();
    return activitiesByCategory
      .map((group) => ({
        ...group,
        activities: group.activities.filter((a) =>
          (a.name || '').toLowerCase().includes(q) ||
          (a.sdtmDomain || '').toLowerCase().includes(q) ||
          (a.definition || '').toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.activities.length > 0);
  }, [activitiesByCategory, activitySearch]);

  // Collect all instances
  const instances = useMemo(() => {
    const all = [];
    timelines.forEach((tl) => {
      if (tl.instances) tl.instances.forEach((inst) => all.push(inst));
    });
    activities.forEach((act) => {
      if (act.instances) {
        act.instances.forEach((inst) =>
          all.push({ ...inst, activityId: act.id || act._id })
        );
      }
    });
    return all;
  }, [timelines, activities]);

  const addedCatalogIds = useMemo(() => {
    return new Set(activities.map((a) => a.catalogId).filter(Boolean));
  }, [activities]);

  const totalEncounterCols = sortedEncounters.length;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleQuickAddVisit() {
    const nextNum = encounters.length + 1;
    addEncounter({ name: `V${nextNum}`, order: nextNum });
  }

  function handleUpdateEncounterField(encId, field, value) {
    updateEncounter(encId, { [field]: value });
  }

  function handleDeleteEncounter(e, encId) {
    e.preventDefault();
    e.stopPropagation();
    removeEncounter(encId);
  }

  function handleAddActivity(e) {
    e.preventDefault();
    if (!activityForm.name.trim()) return;
    addActivity({ ...activityForm }, soaHierarchy);
    setActivityForm({ name: '', category: '', sdtmDomain: '' });
    setShowActivityPanel(false);
  }

  function handleCellClick(activityId, encounterId) {
    toggleInstance(activityId, encounterId);
  }

  function handleAddSingleProcedure(procData) {
    addActivity(procData, soaHierarchy);
  }

  function openPickerForCategory(categoryId) {
    setPickerCategory(categoryId);
    setShowActivityPanel(true);
    setActivityMode('browse');
  }

  function handleApplyPattern(pattern) {
    if (!pattern.activityIds || pattern.activityIds.length === 0) return;
    const toAdd = catalogActivities
      .filter((a) => pattern.activityIds.includes(a.id))
      .filter((a) => !addedCatalogIds.has(a.id))
      .map((a) => ({
        name: a.name, category: a.uiCategory, uiCategory: a.uiCategory,
        sdtmDomain: a.sdtmDomain, catalogId: a.id, nciCode: a.nciCode,
        definition: a.definition, source: a.source || 'CDISC COSMoS',
        cdiscCategories: a.cdiscCategories, synonyms: a.synonyms,
      }));
    if (toAdd.length > 0) useScheduleStore.getState().addActivities(toAdd, soaHierarchy);
    const allCurrentActivities = useScheduleStore.getState().activities;
    const patternActivityIds = allCurrentActivities
      .filter((a) => pattern.activityIds.includes(a.catalogId))
      .map((a) => a.id);
    const encounterIds = sortedEncounters.map((e) => e.id || e._id);
    if (patternActivityIds.length > 0 && encounterIds.length > 0) {
      useScheduleStore.getState().applyPattern(patternActivityIds, encounterIds, 'mandatory');
    }
  }

  function handleQuickAddRow(e) {
    e.preventDefault();
    if (!quickRowName.trim()) return;
    addActivity({ name: quickRowName.trim(), category: '', sdtmDomain: '' }, soaHierarchy);
    setQuickRowName('');
    setShowQuickRow(false);
  }

  function handleTrialImport({ procedures, visits, trialInfo }) {
    // Import procedures
    if (procedures.length > 0) {
      useScheduleStore.getState().addActivities(procedures, soaHierarchy);
    }

    // Import visits
    if (visits.length > 0) {
      const sortedEpochs = [...epochs].sort((a, b) => (a.order || 0) - (b.order || 0));
      const existingEncounters = useScheduleStore.getState().encounters;
      const existingNames = new Set(existingEncounters.map((e) => (e.name || '').toLowerCase()));

      let orderCounter = existingEncounters.length + 1;
      visits.forEach((visit) => {
        if (existingNames.has((visit.name || '').toLowerCase())) return;
        // Try to find matching epoch by name
        const epoch = sortedEpochs.find((ep) =>
          (ep.name || '').toLowerCase().includes((visit.epochName || '').toLowerCase())
        );
        addEncounter({
          name: visit.name,
          week: visit.week,
          studyDay: visit.studyDay,
          epochId: epoch ? (epoch.id || epoch._id) : undefined,
          order: orderCounter++,
        });
      });
    }

    setShowTrialImporter(false);
  }

  function renderCellContent(activityId, encounterId) {
    const instance = getCellDisplay(instances, activityId, encounterId);
    if (!instance) return null;
    const cond = instance.conditionality || instance.defaultConditionId || 'mandatory';
    if (cond === 'conditional' || instance.condition || instance.type === 'conditional') {
      return 'conditional';
    }
    return 'mandatory';
  }

  useEffect(() => {
    if (showQuickRow) {
      setTimeout(() => quickRowRef.current?.focus(), 50);
    }
  }, [showQuickRow]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  /** Render a single activity row (used by both hierarchy and legacy modes). */
  function renderActivityRow(activity, opts = {}) {
    const activityId = activity.id || activity._id;
    const { indent = 0 } = opts;
    return (
      <tr key={activityId} className="hover:bg-gray-50/50 transition-colors group/row">
        <td
          className="sticky left-0 z-10 bg-white group-hover/row:bg-gray-50/50 px-3 py-2 border-b border-r border-gray-100 min-w-[240px]"
          style={{ paddingLeft: `${12 + indent * 16}px` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <span className="text-sm text-gray-800 font-medium truncate" title={activity.definition || activity.name}>
                {activity.name}
              </span>
              {activity.sdtmDomain && (
                <span className="ml-2 flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium text-indigo-600 bg-indigo-50">
                  {activity.sdtmDomain}
                </span>
              )}
            </div>
            {/* Remove button on hover */}
            <button
              onClick={() => removeActivity(activityId)}
              className="flex-shrink-0 ml-2 w-5 h-5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 hidden group-hover/row:flex items-center justify-center transition-colors"
              title="Remove procedure"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </td>

        {/* Instance cells */}
        {sortedEncounters.map((enc) => {
          const encId = enc.id || enc._id;
          const cellType = renderCellContent(activityId, encId);
          return (
            <td
              key={encId}
              onClick={() => handleCellClick(activityId, encId)}
              className="px-2 py-2 border-b border-r border-gray-100 text-center cursor-pointer transition-colors hover:bg-gray-100 min-w-[72px]"
            >
              {cellType === 'mandatory' && (
                <span className="inline-block w-3.5 h-3.5 rounded-sm bg-indigo-500" title="Required" />
              )}
              {cellType === 'conditional' && (
                <span className="inline-block w-3.5 h-3.5 rounded-sm bg-amber-400" title="Conditional" />
              )}
            </td>
          );
        })}
        <td className="w-10 border-b border-gray-100" />
      </tr>
    );
  }

  /** Render SOA Group banner row */
  function renderSoaGroupBanner(sg, totalActivities) {
    const isCollapsed = collapsedGroups[sg.id];
    return (
      <tr key={`sg-${sg.id}`}>
        <td
          colSpan={totalEncounterCols + 2}
          className="border-b cursor-pointer transition-opacity hover:opacity-90"
          style={{
            backgroundColor: sg.colorBg || '#F1F5F9',
            color: sg.colorText || '#334155',
            borderColor: sg.colorBorder || '#CBD5E1',
          }}
          onClick={() => toggleCollapse(sg.id)}
        >
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <ChevronIcon collapsed={isCollapsed} />
              <span className="text-xs font-bold uppercase tracking-wide">{sg.name}</span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: sg.colorBorder || '#CBD5E1',
                  color: sg.colorText || '#334155',
                }}
              >
                {totalActivities}
              </span>
            </div>
            {isCollapsed && (
              <span className="text-[10px] italic opacity-60">
                {totalActivities} procedure{totalActivities !== 1 ? 's' : ''} hidden
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  }

  /** Render Activity Group sub-header row */
  function renderActivityGroupHeader(ag, activityCount, parentSg) {
    const isCollapsed = collapsedGroups[ag.id];
    // Use a slightly lighter version of the parent SOA group colors
    return (
      <tr key={`ag-${ag.id}`}>
        <td
          colSpan={totalEncounterCols + 2}
          className="border-b cursor-pointer transition-opacity hover:opacity-90"
          style={{
            backgroundColor: parentSg?.colorBg ? `${parentSg.colorBg}80` : '#F9FAFB',
            borderColor: parentSg?.colorBorder || '#E5E7EB',
          }}
          onClick={() => toggleCollapse(ag.id)}
        >
          <div className="flex items-center justify-between px-3 py-1.5 pl-8">
            <div className="flex items-center gap-2">
              <ChevronIcon collapsed={isCollapsed} />
              <span className="text-[11px] font-semibold" style={{ color: parentSg?.colorText || '#4B5563' }}>
                {ag.name}
              </span>
              <span className="text-[10px] text-gray-400">({activityCount})</span>
            </div>
            {isCollapsed && (
              <span className="text-[10px] text-gray-400 italic">collapsed</span>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Schedule of Activities</h2>
        <div className="flex items-center space-x-2">
          <ReferenceToggleButton context="soa" />
          <button
            onClick={() => {
              setShowTrialImporter(!showTrialImporter);
              if (showTrialImporter) return;
              setShowActivityPanel(false);
            }}
            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors ${
              showTrialImporter
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Import from NCT
          </button>
          <button
            onClick={() => {
              setPickerCategory(null);
              setShowActivityPanel(!showActivityPanel);
              if (!showActivityPanel) setActivityMode('browse');
              setShowTrialImporter(false);
            }}
            className="inline-flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Procedure
          </button>
        </div>
      </div>

      {/* Pattern Suggestions */}
      {showPatternSuggestions && catalogPatterns.length > 0 && encounters.length > 0 && (
        <PatternSuggestions
          patterns={catalogPatterns}
          catalogActivities={catalogActivities}
          epochs={epochs}
          encounters={encounters}
          onApplyPattern={handleApplyPattern}
          onDismiss={() => setShowPatternSuggestions(false)}
        />
      )}

      {/* Trial Importer */}
      {showTrialImporter && (
        <TrialImporter
          onImport={handleTrialImport}
          onClose={() => setShowTrialImporter(false)}
          addedActivityNames={addedActivityNames}
        />
      )}

      {/* Procedure Picker */}
      {showActivityPanel && activityMode === 'browse' && (
        <ProcedurePicker
          procedureLibrary={procedureLibrary}
          procedureTree={procedureTree}
          addedActivityNames={addedActivityNames}
          onAddProcedure={handleAddSingleProcedure}
          onSwitchToCustom={() => setActivityMode('custom')}
          onClose={() => { setShowActivityPanel(false); setPickerCategory(null); }}
          initialCategory={pickerCategory}
          soaHierarchy={soaHierarchy}
        />
      )}

      {showActivityPanel && activityMode === 'custom' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Create Custom Procedure</h4>
            <div className="flex items-center space-x-2">
              <button onClick={() => setActivityMode('browse')}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
                or browse CDISC procedures
              </button>
              <button onClick={() => setShowActivityPanel(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <form onSubmit={handleAddActivity} className="flex items-end space-x-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Procedure Name</label>
              <input type="text" value={activityForm.name}
                onChange={(e) => setActivityForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Informed Consent"
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select value={activityForm.category}
                onChange={(e) => setActivityForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                <option value="">Select category...</option>
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-600 mb-1">SDTM Domain</label>
              <select value={activityForm.sdtmDomain}
                onChange={(e) => setActivityForm((p) => ({ ...p, sdtmDomain: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                <option value="">Select domain...</option>
                {sdtmDomains.map((d) => (
                  <option key={d.code || d.id || d.label} value={d.code || d.id || d.label}>
                    {d.code || d.id || d.label} - {d.label || d.name || d.code}
                  </option>
                ))}
                {sdtmDomains.length === 0 && (
                  <>
                    <option value="DM">DM - Demographics</option>
                    <option value="VS">VS - Vital Signs</option>
                    <option value="LB">LB - Laboratory</option>
                    <option value="AE">AE - Adverse Events</option>
                    <option value="CM">CM - Concomitant Meds</option>
                    <option value="MH">MH - Medical History</option>
                    <option value="EX">EX - Exposure</option>
                    <option value="DS">DS - Disposition</option>
                  </>
                )}
              </select>
            </div>
            <button type="submit"
              className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors">Add</button>
            <button type="button" onClick={() => setShowActivityPanel(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </form>
        </div>
      )}

      {/* SOA Grid Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar: Schedule/Insights tabs + Collapse/Expand + Search + Legend */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'schedule'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
              </svg>
              Schedule
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'insights'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Insights
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {/* Collapse / Expand All */}
            {hasHierarchy && activities.length > 0 && activeTab === 'schedule' && (
              <div className="flex items-center space-x-1 border-r border-gray-200 pr-3">
                <button
                  onClick={expandAll}
                  className="text-[11px] text-gray-500 hover:text-indigo-600 font-medium px-1.5 py-1 rounded hover:bg-indigo-50 transition-colors"
                  title="Expand all groups"
                >
                  Expand All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={collapseAll}
                  className="text-[11px] text-gray-500 hover:text-indigo-600 font-medium px-1.5 py-1 rounded hover:bg-indigo-50 transition-colors"
                  title="Collapse all groups"
                >
                  Collapse All
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search procedures..."
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs w-56 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-3 text-[11px] text-gray-500">
              <div className="flex items-center space-x-1">
                <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
                <span>Required</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
                <span>Conditional</span>
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'schedule' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                {/* Row 1: Epoch spanning headers */}
                {epochSpans.length > 0 && epochSpans.some((s) => s.epoch) && (
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 min-w-[240px]" />
                    {epochSpans.map((span, i) => (
                      <th
                        key={span.id || i}
                        colSpan={span.colSpan}
                        className="px-2 py-2 text-center border-r border-gray-200 font-bold text-sm text-gray-800"
                      >
                        {span.epoch?.name || ''}
                        {span.epoch?.duration && (
                          <div className="text-[10px] font-normal text-gray-400">{span.epoch.duration}</div>
                        )}
                      </th>
                    ))}
                    <th className="w-10 bg-gray-50 border-r border-gray-200" />
                  </tr>
                )}

                {/* Row 2: Visit Name */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 min-w-[240px]">
                    Procedure
                  </th>
                  {sortedEncounters.map((enc) => {
                    const encId = enc.id || enc._id;
                    return (
                      <th key={encId} className="px-1 py-2 text-center font-semibold text-gray-700 text-xs border-r border-gray-200 min-w-[72px] relative group/col">
                        <InlineEditCell
                          value={enc.name}
                          placeholder="Visit"
                          onSave={(val) => handleUpdateEncounterField(encId, 'name', val)}
                          className="font-semibold text-gray-700"
                        />
                        <button
                          onClick={(e) => handleDeleteEncounter(e, encId)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold hidden group-hover/col:flex items-center justify-center hover:bg-red-600 z-30"
                          title="Remove visit"
                        >
                          &times;
                        </button>
                      </th>
                    );
                  })}
                  <th className="w-10 px-1 py-2 text-center border-r border-gray-200 bg-gray-50">
                    <button
                      onClick={handleQuickAddVisit}
                      className="w-7 h-7 rounded-lg bg-white border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center mx-auto"
                      title="Add visit column"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  </th>
                </tr>

                {/* Row 3: Week */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="sticky left-0 z-20 bg-gray-50 px-3 py-1 text-right text-[11px] font-medium text-gray-500 border-r border-gray-200 min-w-[240px]">
                    Week
                  </th>
                  {sortedEncounters.map((enc) => {
                    const encId = enc.id || enc._id;
                    return (
                      <th key={encId} className="px-1 py-1 text-center text-[11px] text-gray-600 font-medium border-r border-gray-100">
                        <InlineEditCell
                          value={enc.week != null ? String(enc.week) : ''}
                          placeholder="\u2014"
                          onSave={(val) => handleUpdateEncounterField(encId, 'week', val)}
                        />
                      </th>
                    );
                  })}
                  <th className="w-10 bg-gray-50" />
                </tr>

                {/* Row 4: Day */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="sticky left-0 z-20 bg-gray-50 px-3 py-1 text-right text-[11px] font-medium text-gray-500 border-r border-gray-200 min-w-[240px]">
                    Day
                  </th>
                  {sortedEncounters.map((enc) => {
                    const encId = enc.id || enc._id;
                    return (
                      <th key={encId} className="px-1 py-1 text-center text-[11px] text-gray-600 font-medium border-r border-gray-100">
                        <InlineEditCell
                          value={enc.studyDay != null ? String(enc.studyDay) : ''}
                          placeholder="\u2014"
                          onSave={(val) => handleUpdateEncounterField(encId, 'studyDay', val ? Number(val) : undefined)}
                        />
                      </th>
                    );
                  })}
                  <th className="w-10 bg-gray-50" />
                </tr>

                {/* Row 5: Visit Label */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="sticky left-0 z-20 bg-gray-50 px-3 py-1 text-right text-[11px] font-medium text-gray-500 border-r border-gray-200 min-w-[240px]">
                    Visit Label
                  </th>
                  {sortedEncounters.map((enc) => {
                    const encId = enc.id || enc._id;
                    return (
                      <th key={encId} className="px-1 py-1 text-center text-[11px] text-gray-600 font-normal border-r border-gray-100">
                        <InlineEditCell
                          value={enc.label || ''}
                          placeholder="\u2014"
                          onSave={(val) => handleUpdateEncounterField(encId, 'label', val)}
                        />
                      </th>
                    );
                  })}
                  <th className="w-10 bg-gray-50" />
                </tr>

                {/* Row 6: Window */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 z-20 bg-gray-50 px-3 py-1 text-right text-[11px] font-medium text-gray-500 border-r border-gray-200 min-w-[240px]">
                    Window
                  </th>
                  {sortedEncounters.map((enc) => {
                    const encId = enc.id || enc._id;
                    return (
                      <th key={encId} className="px-1 py-1 text-center text-[11px] text-gray-500 font-normal border-r border-gray-200">
                        <InlineEditCell
                          value={enc.visitWindow || ''}
                          placeholder="\u2014"
                          onSave={(val) => handleUpdateEncounterField(encId, 'visitWindow', val)}
                        />
                      </th>
                    );
                  })}
                  <th className="w-10 bg-gray-50" />
                </tr>
              </thead>

              <tbody>
                {/* Empty state */}
                {activities.length === 0 && sortedEncounters.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-16 text-center">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      <p className="text-sm text-gray-500 font-medium">No Schedule of Activities defined yet.</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Click the <strong>+</strong> button in the header to add visits, then add procedures below.
                      </p>
                    </td>
                  </tr>
                ) : hasHierarchy && hierarchicalRows ? (
                  /* ── Hierarchical mode ─────────────────────────────────── */
                  <>
                    {hierarchicalRows.map((row) => {
                      if (row.type === 'soaGroup') {
                        return renderSoaGroupBanner(row.sg, row.totalActivities);
                      }
                      if (row.type === 'activityGroup') {
                        // Find parent SOA group for coloring
                        const parentSg = soaGroups.find((sg) => sg.id === row.ag.soaGroupId);
                        return renderActivityGroupHeader(row.ag, row.activityCount, parentSg);
                      }
                      if (row.type === 'activity') {
                        return renderActivityRow(row.activity, { indent: row.activityGroup ? 2 : 1 });
                      }
                      return null;
                    })}
                  </>
                ) : (
                  /* ── Legacy flat-category mode ──────────────────────────── */
                  <>
                    {filteredByCategory.map((group) => (
                      <React.Fragment key={group.category.id}>
                        <tr>
                          <td
                            colSpan={totalEncounterCols + 2}
                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${group.category.bgHeader} ${group.category.textHeader} ${group.category.border} border-b cursor-pointer hover:opacity-80 transition-opacity`}
                            onClick={() => openPickerForCategory(group.category.id)}
                            title={`Click to add more ${group.category.name} procedures`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{group.category.name}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-60 hover:opacity-100 transition-opacity">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Add
                              </span>
                            </div>
                          </td>
                        </tr>
                        {group.activities.map((activity) => renderActivityRow(activity))}
                      </React.Fragment>
                    ))}
                  </>
                )}

                {/* Quick add row at bottom */}
                {(activities.length > 0 || sortedEncounters.length > 0) && (
                  <tr>
                    <td colSpan={totalEncounterCols + 2} className="px-3 py-2 border-t border-gray-200">
                      {showQuickRow ? (
                        <form onSubmit={handleQuickAddRow} className="flex items-center gap-2">
                          <input
                            ref={quickRowRef}
                            type="text"
                            value={quickRowName}
                            onChange={(e) => setQuickRowName(e.target.value)}
                            placeholder="Procedure name..."
                            className="flex-1 max-w-xs px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            onKeyDown={(e) => { if (e.key === 'Escape') { setShowQuickRow(false); setQuickRowName(''); } }}
                          />
                          <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors">
                            Add
                          </button>
                          <button type="button" onClick={() => { setShowQuickRow(false); setQuickRowName(''); }}
                            className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-sm transition-colors">
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => setShowQuickRow(true)}
                          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Add Procedure Row
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Insights Tab -- Burden Analytics Dashboard */
          <BurdenAnalytics />
        )}
      </div>
    </div>
  );
}
