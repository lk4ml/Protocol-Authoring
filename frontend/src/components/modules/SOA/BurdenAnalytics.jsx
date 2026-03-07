import React, { useMemo, useState } from 'react';
import useScheduleStore from '../../../store/useScheduleStore';
import useTerminologyStore from '../../../store/useTerminologyStore';

import { TAB_ACTIVE, ClockIcon, BloodIcon, CostIcon, ComplexityIcon } from './BurdenAnalytics/shared';
import ParticipantTimeTab from './BurdenAnalytics/ParticipantTimeTab';
import BloodVolumeTab from './BurdenAnalytics/BloodVolumeTab';
import CostTab from './BurdenAnalytics/CostTab';
import ComplexityTab from './BurdenAnalytics/ComplexityTab';
import MethodologyPanel from './BurdenAnalytics/MethodologyPanel';

// ═══════════════════════════════════════════════════════════════════════════
// Tab configuration
// ═══════════════════════════════════════════════════════════════════════════
const INSIGHT_TABS = [
  { id: 'time',       label: 'Participant Time', color: 'indigo',  Icon: ClockIcon },
  { id: 'blood',      label: 'Blood Volume',     color: 'red',     Icon: BloodIcon },
  { id: 'cost',       label: 'Cost ($)',          color: 'emerald', Icon: CostIcon },
  { id: 'complexity', label: 'Complexity (RVU)',  color: 'amber',   Icon: ComplexityIcon },
];

// ═══════════════════════════════════════════════════════════════════════════
// Burden data lookup helpers (module-scope for performance)
// ═══════════════════════════════════════════════════════════════════════════
let _aliasIndex = null;
function getAliasIndex(burdenMap) {
  if (_aliasIndex) return _aliasIndex;
  const idx = new Map();
  for (const [, val] of burdenMap) {
    if (val.name) idx.set(val.name.toLowerCase().trim(), val);
    if (Array.isArray(val.nameAliases)) {
      val.nameAliases.forEach((alias) => idx.set(alias.toLowerCase().trim(), val));
    }
  }
  _aliasIndex = idx;
  return idx;
}

function findBurden(activity, burdenMap) {
  if (activity.catalogId && burdenMap.has(activity.catalogId)) return burdenMap.get(activity.catalogId);
  if (activity.id && burdenMap.has(activity.id)) return burdenMap.get(activity.id);
  const normName = (activity.name || '').toLowerCase().trim();
  const aliasIdx = getAliasIndex(burdenMap);
  if (aliasIdx.has(normName)) return aliasIdx.get(normName);
  for (const [key] of burdenMap) {
    if (key.toLowerCase() === normName) return burdenMap.get(key);
  }
  const shortName = (activity.shortName || '').toLowerCase().trim();
  if (shortName && aliasIdx.has(shortName)) return aliasIdx.get(shortName);
  const cat = (activity.uiCategory || activity.categoryCode || '').toUpperCase();
  for (const [, val] of burdenMap) {
    const bCat = (val.category || '').toUpperCase();
    if (bCat && bCat === cat && val.name) {
      const bName = val.name.toLowerCase();
      if (normName.includes(bName) || bName.includes(normName)) return val;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
export default function BurdenAnalytics() {
  const encounters = useScheduleStore((s) => s.encounters) || [];
  const activities = useScheduleStore((s) => s.activities) || [];
  const timelines = useScheduleStore((s) => s.timelines) || [];
  const procedureBurden = useTerminologyStore((s) => s.procedureBurden);

  const [insightTab, setInsightTab] = useState('time');

  // Schedule instances from main timeline
  const instances = useMemo(() => {
    const main = timelines.find((t) => t.mainTimeline) || timelines[0];
    return main?.instances || [];
  }, [timelines]);

  // Activity lookup: id -> activity
  const activityMap = useMemo(() => {
    const m = new Map();
    activities.forEach((a) => m.set(a.id, a));
    return m;
  }, [activities]);

  // Burden lookup from procedure_burden.json
  const burdenMap = useMemo(() => {
    _aliasIndex = null;
    if (!procedureBurden?.procedures) return new Map();
    const m = new Map();
    Object.entries(procedureBurden.procedures).forEach(([key, val]) => {
      m.set(key, val);
    });
    return m;
  }, [procedureBurden]);

  const tubeTypes = procedureBurden?.tubeTypes || {};

  // ── CORE: Per-Visit Burden ─────────────────────────────────────────────
  const visitMetrics = useMemo(() => {
    if (!encounters.length || !instances.length) return [];

    return encounters.map((enc) => {
      const encInstances = instances.filter((inst) => inst.encounterId === enc.id);
      const encActivityIds = new Set();
      encInstances.forEach((inst) => {
        if (inst.activityId) encActivityIds.add(inst.activityId);
        if (Array.isArray(inst.activityIds)) inst.activityIds.forEach((id) => encActivityIds.add(id));
      });

      let totalTime = 0, totalCost = 0, totalRvu = 0;
      const tubeVolumes = {};
      const categoryBreakdown = {};
      const activityDetails = [];

      encActivityIds.forEach((actId) => {
        const activity = activityMap.get(actId);
        if (!activity) return;

        const burden = findBurden(activity, burdenMap);
        const cat = activity.uiCategory || activity.categoryCode || 'OTHER';

        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { time: 0, cost: 0, rvu: 0, blood: 0, count: 0 };
        }
        categoryBreakdown[cat].count++;

        if (burden) {
          const time = burden.timeMinutes || 0;
          const cost = burden.costUsd || 0;
          const rvu = burden.rvu?.total || 0;
          const blood = burden.bloodVolumeMl || 0;
          const tube = burden.tubeType || null;

          totalTime += time;
          totalCost += cost;
          totalRvu += rvu;
          categoryBreakdown[cat].time += time;
          categoryBreakdown[cat].cost += cost;
          categoryBreakdown[cat].rvu += rvu;

          if (tube && blood > 0) {
            tubeVolumes[tube] = Math.max(tubeVolumes[tube] || 0, blood);
            categoryBreakdown[cat].blood += blood;
          }

          activityDetails.push({
            name: activity.name,
            shortName: activity.shortName || activity.name,
            category: cat,
            time, cost, rvu, blood, tube,
            loincCode: burden.loincCode,
            cptCode: burden.cptCode,
            derivation: burden.derivation,
            // RVU sub-components for ComplexityTab
            rvuWork: burden.rvu?.work || 0,
            rvuPE: burden.rvu?.practiceExpense || 0,
            rvuMP: burden.rvu?.malpractice || 0,
          });
        } else {
          const fallbackTime = 5;
          totalTime += fallbackTime;
          categoryBreakdown[cat].time += fallbackTime;
          activityDetails.push({
            name: activity.name,
            shortName: activity.shortName || activity.name,
            category: cat,
            time: fallbackTime, cost: 0, rvu: 0, blood: 0, tube: null,
            derivation: 'Default estimate (5 min)',
            rvuWork: 0, rvuPE: 0, rvuMP: 0,
          });
        }
      });

      const totalBlood = Object.values(tubeVolumes).reduce((s, v) => s + v, 0);

      return {
        encounter: enc,
        activityCount: encActivityIds.size,
        totalTime, totalBlood, totalCost, totalRvu,
        tubeVolumes, categoryBreakdown, activityDetails,
      };
    });
  }, [encounters, instances, activityMap, burdenMap]);

  // ── Aggregates ─────────────────────────────────────────────────────────
  const aggregates = useMemo(() => {
    if (!visitMetrics.length) return null;
    const cum = { time: 0, blood: 0, cost: 0, rvu: 0, activities: 0 };
    let maxTime = 0, maxBlood = 0, maxCost = 0, maxRvu = 0;
    visitMetrics.forEach((vm) => {
      cum.time += vm.totalTime;
      cum.blood += vm.totalBlood;
      cum.cost += vm.totalCost;
      cum.rvu += vm.totalRvu;
      cum.activities += vm.activityCount;
      maxTime = Math.max(maxTime, vm.totalTime);
      maxBlood = Math.max(maxBlood, vm.totalBlood);
      maxCost = Math.max(maxCost, vm.totalCost);
      maxRvu = Math.max(maxRvu, vm.totalRvu);
    });
    return { cum, maxTime, maxBlood, maxCost, maxRvu };
  }, [visitMetrics]);

  // ── Category Totals ────────────────────────────────────────────────────
  const categoryTotals = useMemo(() => {
    const totals = {};
    visitMetrics.forEach((vm) => {
      Object.entries(vm.categoryBreakdown).forEach(([cat, vals]) => {
        if (!totals[cat]) totals[cat] = { time: 0, cost: 0, rvu: 0, blood: 0, count: 0 };
        totals[cat].time += vals.time;
        totals[cat].cost += vals.cost;
        totals[cat].rvu += vals.rvu;
        totals[cat].blood += vals.blood;
        totals[cat].count += vals.count;
      });
    });
    return totals;
  }, [visitMetrics]);

  // ── Empty / Loading states ─────────────────────────────────────────────
  if (!encounters.length || !activities.length) {
    return (
      <div className="p-12 text-center">
        <svg className="w-14 h-14 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-sm text-gray-500">Add activities and encounters to the schedule to see burden analytics.</p>
      </div>
    );
  }

  if (!procedureBurden) {
    return (
      <div className="p-12 text-center">
        <svg className="animate-spin h-8 w-8 text-indigo-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm text-gray-500">Loading burden metrics...</p>
      </div>
    );
  }

  if (!aggregates) return null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 bg-gray-50 rounded-xl border border-gray-200">
        {INSIGHT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setInsightTab(tab.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              insightTab === tab.id
                ? TAB_ACTIVE[tab.color]
                : 'text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm'
            }`}
          >
            <tab.Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Active Tab */}
      {insightTab === 'time' && (
        <ParticipantTimeTab visitMetrics={visitMetrics} aggregates={aggregates} categoryTotals={categoryTotals} />
      )}
      {insightTab === 'blood' && (
        <BloodVolumeTab visitMetrics={visitMetrics} aggregates={aggregates} tubeTypes={tubeTypes} />
      )}
      {insightTab === 'cost' && (
        <CostTab visitMetrics={visitMetrics} aggregates={aggregates} categoryTotals={categoryTotals} />
      )}
      {insightTab === 'complexity' && (
        <ComplexityTab visitMetrics={visitMetrics} aggregates={aggregates} categoryTotals={categoryTotals} />
      )}

      {/* Always visible */}
      <MethodologyPanel conversionFactor={procedureBurden?._meta?.conversionFactor || 32.35} />
    </div>
  );
}
