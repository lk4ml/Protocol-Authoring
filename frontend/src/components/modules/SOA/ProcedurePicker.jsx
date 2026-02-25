import React, { useState, useMemo } from 'react';

/**
 * CDISC verification badge.
 */
const CdiscBadge = () => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700">
    <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
    CDISC
  </span>
);

/**
 * SOA Group order and display metadata (matches soa_hierarchy.json).
 * Colors use inline styles to match the SOA matrix banners.
 */
const SOA_GROUP_META = {
  ADMIN:     { name: 'Administrative',                    order: 1, colorBg: '#F1F5F9', colorText: '#334155', colorBorder: '#CBD5E1' },
  SAFETY:    { name: 'Safety Assessments',                order: 2, colorBg: '#FEF2F2', colorText: '#991B1B', colorBorder: '#FECACA' },
  EFFICACY:  { name: 'Efficacy Assessments',              order: 3, colorBg: '#F0FDF4', colorText: '#166534', colorBorder: '#BBF7D0' },
  TREATMENT: { name: 'Study Treatment',                   order: 4, colorBg: '#ECFEFF', colorText: '#155E75', colorBorder: '#A5F3FC' },
  PK:        { name: 'Pharmacokinetics / Immunogenicity',  order: 5, colorBg: '#FFF1F2', colorText: '#9F1239', colorBorder: '#FECDD3' },
  PRO:       { name: 'Patient-Reported Outcomes',          order: 6, colorBg: '#F5F3FF', colorText: '#5B21B6', colorBorder: '#DDD6FE' },
};

const SOA_GROUP_ORDER = ['ADMIN', 'SAFETY', 'EFFICACY', 'TREATMENT', 'PK', 'PRO'];

/**
 * Activity Group names (matches soa_hierarchy.json).
 */
const ACTIVITY_GROUP_NAMES = {
  CONSENT: 'Consent & Enrollment',
  DEMOG: 'Demographics & History',
  CLINICAL: 'Clinical Assessments',
  LABS: 'Laboratory Assessments',
  CARDIAC: 'Cardiac Assessments',
  IMAGING_S: 'Safety Imaging',
  AE: 'Adverse Events',
  TUMOR: 'Tumor Assessments',
  DISEASE: 'Disease Activity & Response',
  BIOMARKER: 'Biomarkers',
  IMAGING_E: 'Efficacy Imaging',
  FUNCTION: 'Functional Assessments',
  IP_ADMIN: 'Drug Administration',
  DOSING: 'Dose Management',
  PK_SAMP: 'PK Sampling',
  ADA: 'Immunogenicity',
  QOL: 'Quality of Life',
  SYMPTOM: 'Symptom & Function Scales',
};

/**
 * ProcedurePicker — SOA-hierarchy-based browsing with TA filter, one-click add.
 *
 * Groups procedures by SOA Group → Activity Group, matching the SOA matrix.
 */
export default function ProcedurePicker({
  procedureLibrary,
  procedureTree,
  addedActivityNames,
  onAddProcedure,
  onSwitchToCustom,
  onClose,
  initialCategory,
  soaHierarchy,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTA, setSelectedTA] = useState('ALL');
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(SOA_GROUP_ORDER));
  const [expandedAGs, setExpandedAGs] = useState(() => new Set()); // activity groups that show individual procedures
  const [viewMode, setViewMode] = useState('groups'); // 'groups' shows AG sub-headers, 'flat' shows all

  // Therapeutic areas list
  const therapeuticAreas = procedureLibrary?.therapeuticAreas || [
    { id: 'ALL', name: 'All Therapeutic Areas' },
  ];

  // Build the unified procedure list: core + TA-specific for selected TA
  const allProcedures = useMemo(() => {
    if (!procedureLibrary) {
      if (!procedureTree) return [];
      return procedureTree.flatMap((g) =>
        g.procedures.map((p) => ({
          ...p,
          uiCategory: p.uiCategory || g.category?.id,
          isCore: true,
          therapeuticArea: 'ALL',
          shortName: p.sdtmDomain || '',
          source: p.source || 'CDISC COSMoS',
        }))
      );
    }

    const core = procedureLibrary.coreProcedures || [];
    let taProcs = [];

    if (selectedTA !== 'ALL') {
      taProcs = procedureLibrary.taProcedures?.[selectedTA] || [];
    } else {
      Object.values(procedureLibrary.taProcedures || {}).forEach((procs) => {
        taProcs = taProcs.concat(procs);
      });
    }

    return [...core, ...taProcs];
  }, [procedureLibrary, procedureTree, selectedTA]);

  // Group by SOA Group → Activity Group hierarchy
  const hierarchicalGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // Filter by search
    let filtered = allProcedures;
    if (q) {
      filtered = allProcedures.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.definition || '').toLowerCase().includes(q) ||
          (p.sdtmDomain || '').toLowerCase().includes(q) ||
          (p.shortName || '').toLowerCase().includes(q) ||
          (p.nciCode || '').toLowerCase().includes(q)
      );
    }

    // If initialCategory (soaGroupId) filter is set
    if (initialCategory) {
      filtered = filtered.filter(
        (p) => p.soaGroupId === initialCategory || p.uiCategory === initialCategory
      );
    }

    // Build SOA Group → Activity Group → procedures tree
    const soaTree = {};
    filtered.forEach((proc) => {
      const sgId = proc.soaGroupId || '_UNASSIGNED';
      const agId = proc.activityGroupId || '_UNGROUPED';
      if (!soaTree[sgId]) soaTree[sgId] = {};
      if (!soaTree[sgId][agId]) soaTree[sgId][agId] = [];
      soaTree[sgId][agId].push(proc);
    });

    // Sort procedures within each activity group
    Object.values(soaTree).forEach((ags) => {
      Object.values(ags).forEach((procs) => {
        procs.sort((a, b) => {
          if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
          return (a.name || '').localeCompare(b.name || '');
        });
      });
    });

    // Build ordered result
    const result = [];
    const order = initialCategory ? [initialCategory] : SOA_GROUP_ORDER;

    order.forEach((sgId) => {
      const ags = soaTree[sgId];
      if (!ags) return;

      const meta = SOA_GROUP_META[sgId] || { name: sgId, order: 99, colorBg: '#F3F4F6', colorText: '#374151', colorBorder: '#D1D5DB' };
      const totalCount = Object.values(ags).reduce((sum, procs) => sum + procs.length, 0);

      // Build activity groups with their procedures
      const activityGroupList = Object.entries(ags)
        .map(([agId, procs]) => ({
          id: agId,
          name: ACTIVITY_GROUP_NAMES[agId] || agId,
          procedures: procs,
        }))
        .sort((a, b) => {
          // Sort by predefined order if possible
          const aIdx = Object.keys(ACTIVITY_GROUP_NAMES).indexOf(a.id);
          const bIdx = Object.keys(ACTIVITY_GROUP_NAMES).indexOf(b.id);
          return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });

      result.push({
        id: sgId,
        meta,
        totalCount,
        activityGroups: activityGroupList,
      });
    });

    // Catch unassigned
    if (soaTree['_UNASSIGNED']) {
      const ags = soaTree['_UNASSIGNED'];
      const totalCount = Object.values(ags).reduce((sum, procs) => sum + procs.length, 0);
      result.push({
        id: '_UNASSIGNED',
        meta: { name: 'Unassigned', order: 99, colorBg: '#F3F4F6', colorText: '#374151', colorBorder: '#D1D5DB' },
        totalCount,
        activityGroups: Object.entries(ags).map(([agId, procs]) => ({
          id: agId,
          name: ACTIVITY_GROUP_NAMES[agId] || 'Other',
          procedures: procs,
        })),
      });
    }

    return result;
  }, [allProcedures, searchQuery, initialCategory]);

  const totalCount = hierarchicalGroups.reduce((sum, g) => sum + g.totalCount, 0);

  function toggleGroup(groupId) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function toggleAG(agId) {
    setExpandedAGs((prev) => {
      const next = new Set(prev);
      if (next.has(agId)) next.delete(agId);
      else next.add(agId);
      return next;
    });
  }

  function isAlreadyAdded(proc) {
    if (!addedActivityNames) return false;
    return addedActivityNames.has((proc.name || '').toLowerCase());
  }

  function handleAddProcedure(proc) {
    if (isAlreadyAdded(proc)) return;
    onAddProcedure({
      name: proc.name,
      category: proc.uiCategory,
      uiCategory: proc.uiCategory,
      sdtmDomain: proc.sdtmDomain,
      catalogId: proc.id,
      nciCode: proc.nciCode || null,
      definition: proc.definition,
      shortName: proc.shortName,
      source: proc.source || 'Procedure Library',
      therapeuticArea: proc.therapeuticArea,
      isCore: proc.isCore,
      soaGroupId: proc.soaGroupId || null,
      activityGroupId: proc.activityGroupId || null,
    });
  }

  function addAllInGroup(procedures) {
    procedures.forEach((proc) => {
      if (!isAlreadyAdded(proc)) {
        handleAddProcedure(proc);
      }
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">
            {initialCategory
              ? `Add ${SOA_GROUP_META[initialCategory]?.name || initialCategory} Procedures`
              : 'Add Procedures to Schedule'}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalCount} procedures available
            {selectedTA !== 'ALL' && (
              <span className="ml-1 text-indigo-600 font-medium">
                ({therapeuticAreas.find((t) => t.id === selectedTA)?.name || selectedTA})
              </span>
            )}
            <span className="ml-2 text-gray-400">
              Grouped by SOA hierarchy
            </span>
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onSwitchToCustom}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            or create custom
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* TA Filter Pills + Search */}
      <div className="px-5 pt-3 pb-2 space-y-2">
        {/* Therapeutic Area pills */}
        {!initialCategory && procedureLibrary && (
          <div className="flex flex-wrap gap-1.5">
            {therapeuticAreas.map((ta) => (
              <button
                key={ta.id}
                onClick={() => setSelectedTA(ta.id)}
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedTA === ta.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {ta.icon && <span className="mr-1">{ta.icon}</span>}
                {ta.name}
              </button>
            ))}
          </div>
        )}

        {/* Search bar */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search procedures by name, domain, or keyword..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* SOA Hierarchy Accordion */}
      <div className="px-5 pb-4 max-h-[480px] overflow-y-auto">
        {hierarchicalGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm font-medium">No procedures match your search</p>
            <p className="text-xs mt-1">Try different keywords or change the therapeutic area</p>
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {hierarchicalGroups.map((soaGroup) => {
              const isExpanded = expandedGroups.has(soaGroup.id);
              const { meta } = soaGroup;

              return (
                <div key={soaGroup.id} className="rounded-lg overflow-hidden border" style={{ borderColor: meta.colorBorder }}>
                  {/* SOA Group Header */}
                  <button
                    onClick={() => toggleGroup(soaGroup.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-opacity hover:opacity-90"
                    style={{ backgroundColor: meta.colorBg }}
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        style={{ color: meta.colorText }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.colorText }}>
                        {meta.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: meta.colorBorder, color: meta.colorText }}
                      >
                        {soaGroup.totalCount}
                      </span>
                      {!isExpanded && (
                        <button
                          onClick={(e) => { e.stopPropagation(); addAllInGroup(soaGroup.activityGroups.flatMap(ag => ag.procedures)); }}
                          className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/70 hover:bg-white transition-colors"
                          style={{ color: meta.colorText }}
                          title={`Add all ${soaGroup.totalCount} ${meta.name} procedures`}
                        >
                          + Add All
                        </button>
                      )}
                    </div>
                  </button>

                  {/* Activity Groups & Procedures */}
                  {isExpanded && (
                    <div>
                      {soaGroup.activityGroups.map((ag) => {
                        const isAGExpanded = expandedAGs.has(ag.id) || !!searchQuery.trim();
                        const addedInGroup = ag.procedures.filter((p) => isAlreadyAdded(p)).length;

                        return (
                          <div key={ag.id}>
                            {/* Activity Group sub-header — clickable to expand */}
                            <div
                              onClick={() => toggleAG(ag.id)}
                              className="flex items-center justify-between px-4 py-2 border-t cursor-pointer transition-colors hover:opacity-90"
                              style={{
                                backgroundColor: `${meta.colorBg}90`,
                                borderColor: `${meta.colorBorder}80`,
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <svg
                                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isAGExpanded ? 'rotate-0' : '-rotate-90'}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                  style={{ color: meta.colorText }}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                                <span className="text-[11px] font-semibold" style={{ color: meta.colorText }}>
                                  {ag.name}
                                </span>
                                <span
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                  style={{ backgroundColor: `${meta.colorBorder}60`, color: meta.colorText }}
                                >
                                  {ag.procedures.length}
                                </span>
                                {addedInGroup > 0 && (
                                  <span className="text-[10px] font-medium text-green-600">
                                    {addedInGroup} added
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); addAllInGroup(ag.procedures); }}
                                className="text-[10px] font-medium px-2 py-0.5 rounded hover:bg-white/60 transition-colors opacity-60 hover:opacity-100"
                                style={{ color: meta.colorText }}
                                title={`Add all ${ag.name} procedures`}
                              >
                                + Add Group
                              </button>
                            </div>

                            {/* Procedure rows — shown when AG is expanded */}
                            {isAGExpanded && (
                              <div className="divide-y divide-gray-100">
                                {ag.procedures.map((proc) => {
                                  const added = isAlreadyAdded(proc);

                                  return (
                                    <div
                                      key={proc.id}
                                      className={`flex items-center px-4 py-2 transition-colors ${
                                        added ? 'bg-gray-50 opacity-50' : 'hover:bg-gray-50'
                                      }`}
                                    >
                                      {/* Procedure info */}
                                      <div className="flex-1 min-w-0 pl-5">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-medium text-sm text-gray-900 truncate">
                                            {proc.name}
                                          </span>
                                          {proc.shortName && (
                                            <span
                                              className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                              style={{ backgroundColor: `${meta.colorBg}`, color: meta.colorText }}
                                            >
                                              {proc.shortName}
                                            </span>
                                          )}
                                          {proc.sdtmDomain && (
                                            <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                                              {proc.sdtmDomain}
                                            </span>
                                          )}
                                          {proc.source?.includes('CDISC') && <CdiscBadge />}
                                          {proc.isCore && (
                                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600">
                                              Core
                                            </span>
                                          )}
                                          {proc.therapeuticArea && proc.therapeuticArea !== 'ALL' && (
                                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600">
                                              {proc.therapeuticArea}
                                            </span>
                                          )}
                                        </div>
                                        {proc.definition && (
                                          <p className="text-[11px] text-gray-500 truncate mt-0.5 max-w-lg">
                                            {proc.definition}
                                          </p>
                                        )}
                                      </div>

                                      {/* Add / Added button */}
                                      <div className="flex-shrink-0 ml-3">
                                        {added ? (
                                          <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium text-green-600 bg-green-50">
                                            <svg className="w-3.5 h-3.5 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            Added
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => handleAddProcedure(proc)}
                                            className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                                            title={`Add ${proc.name}`}
                                          >
                                            <svg className="w-3.5 h-3.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                            </svg>
                                            Add
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
