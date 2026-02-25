import React, { useMemo, useState } from 'react';
import useScheduleStore from '../../../store/useScheduleStore';
import useTerminologyStore from '../../../store/useTerminologyStore';

/**
 * Activity categories for color-mapping (mirrors SOAModule).
 */
const CAT_COLORS = {
  ADMIN: { bar: '#64748b', bg: 'bg-slate-100', text: 'text-slate-700' },
  CLINICAL: { bar: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700' },
  LABORATORY: { bar: '#a855f7', bg: 'bg-purple-100', text: 'text-purple-700' },
  IMAGING: { bar: '#6366f1', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  EFFICACY: { bar: '#22c55e', bg: 'bg-green-100', text: 'text-green-700' },
  SAFETY: { bar: '#f59e0b', bg: 'bg-amber-100', text: 'text-amber-700' },
  PK: { bar: '#f43f5e', bg: 'bg-rose-100', text: 'text-rose-700' },
  TREATMENT: { bar: '#06b6d4', bg: 'bg-cyan-100', text: 'text-cyan-700' },
  PRO: { bar: '#14b8a6', bg: 'bg-teal-100', text: 'text-teal-700' },
};

/**
 * Simple horizontal bar renderer — pure CSS, no library needed.
 */
function HBar({ value, max, color = '#6366f1', label, suffix = '' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-16 text-right shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] font-bold text-gray-700 w-16 shrink-0">
        {typeof value === 'number' ? value.toFixed(1) : value}{suffix}
      </span>
    </div>
  );
}

/**
 * Stacked bar segment for per-visit breakdown.
 */
function StackedBar({ segments, total, height = 120 }) {
  if (total === 0) return <div className="w-full flex items-end justify-center" style={{ height }}><span className="text-[9px] text-gray-300">0</span></div>;
  return (
    <div className="w-full flex flex-col-reverse" style={{ height }}>
      {segments.map((seg, i) => {
        const pct = (seg.value / total) * 100;
        if (pct < 0.5) return null;
        return (
          <div
            key={i}
            className="w-full transition-all duration-300 first:rounded-b last:rounded-t"
            style={{
              height: `${pct}%`,
              backgroundColor: seg.color,
              minHeight: pct > 0 ? 2 : 0,
            }}
            title={`${seg.label}: ${seg.value.toFixed(1)}${seg.suffix || ''}`}
          />
        );
      })}
    </div>
  );
}

/**
 * BurdenAnalytics — SOA Insights dashboard.
 *
 * Computes per-visit and cumulative burden metrics:
 * - Participant Time (minutes) — from CMS physician time data + time-motion studies
 * - Blood Volume (mL) — from specimen collection guides, with tube-sharing dedup
 * - Estimated Cost (USD) — from CMS CLFS (labs) and PFS RVU × conversion factor
 * - Complexity Score (RVU) — from CMS Physician Fee Schedule relative value units
 *
 * All metrics are systematically derived from the procedure_burden.json dataset
 * loaded via the terminology store.
 */
export default function BurdenAnalytics() {
  const encounters = useScheduleStore((s) => s.encounters) || [];
  const activities = useScheduleStore((s) => s.activities) || [];
  const timelines = useScheduleStore((s) => s.timelines) || [];
  const procedureBurden = useTerminologyStore((s) => s.procedureBurden);

  const [expandedVisit, setExpandedVisit] = useState(null);

  // Get scheduled instances from the main timeline
  const instances = useMemo(() => {
    const main = timelines.find((t) => t.mainTimeline) || timelines[0];
    return main?.instances || [];
  }, [timelines]);

  // Build activity lookup: id -> activity object
  const activityMap = useMemo(() => {
    const m = new Map();
    activities.forEach((a) => m.set(a.id, a));
    return m;
  }, [activities]);

  // Build burden lookup from procedure_burden.json
  const burdenMap = useMemo(() => {
    if (!procedureBurden?.procedures) return new Map();
    const m = new Map();
    Object.entries(procedureBurden.procedures).forEach(([key, val]) => {
      m.set(key, val);
    });
    return m;
  }, [procedureBurden]);

  const tubeTypes = procedureBurden?.tubeTypes || {};

  // ── CORE COMPUTATION: Per-Visit Burden ─────────────────────────────────
  const visitMetrics = useMemo(() => {
    if (!encounters.length || !instances.length) return [];

    return encounters.map((enc) => {
      // Find all activities scheduled for this encounter
      const encInstances = instances.filter((inst) => inst.encounterId === enc.id);
      const encActivityIds = new Set();
      encInstances.forEach((inst) => {
        if (inst.activityId) encActivityIds.add(inst.activityId);
        if (Array.isArray(inst.activityIds)) inst.activityIds.forEach((id) => encActivityIds.add(id));
      });

      let totalTime = 0;
      let totalCost = 0;
      let totalRvu = 0;
      const tubeVolumes = {}; // tubeType -> maxVolume needed (for sharing)
      const categoryBreakdown = {};
      const activityDetails = [];

      encActivityIds.forEach((actId) => {
        const activity = activityMap.get(actId);
        if (!activity) return;

        // Try to find burden data by multiple keys
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

          // Tube-sharing: within same tube type, take the max volume
          // (multiple tests from same tube don't require separate draws)
          if (tube && blood > 0) {
            tubeVolumes[tube] = Math.max(tubeVolumes[tube] || 0, blood);
            categoryBreakdown[cat].blood += blood; // raw per-test (detail view)
          }

          activityDetails.push({
            name: activity.name,
            shortName: activity.shortName || activity.name,
            category: cat,
            time, cost, rvu, blood, tube,
            loincCode: burden.loincCode,
            cptCode: burden.cptCode,
            derivation: burden.derivation,
          });
        } else {
          // No burden data — still count as 5 min default for time
          const fallbackTime = 5;
          totalTime += fallbackTime;
          categoryBreakdown[cat].time += fallbackTime;
          activityDetails.push({
            name: activity.name,
            shortName: activity.shortName || activity.name,
            category: cat,
            time: fallbackTime, cost: 0, rvu: 0, blood: 0, tube: null,
            derivation: 'Default estimate (5 min)',
          });
        }
      });

      // Total blood = sum of per-tube-type max volumes (tube sharing)
      const totalBlood = Object.values(tubeVolumes).reduce((s, v) => s + v, 0);

      return {
        encounter: enc,
        activityCount: encActivityIds.size,
        totalTime,
        totalBlood,
        totalCost,
        totalRvu,
        tubeVolumes,
        categoryBreakdown,
        activityDetails,
      };
    });
  }, [encounters, instances, activityMap, burdenMap]);

  // ── AGGREGATE METRICS ──────────────────────────────────────────────────
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

  // ── CATEGORY TOTALS (across all visits) ────────────────────────────────
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

  // ── RENDER ─────────────────────────────────────────────────────────────
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

  return (
    <div className="space-y-6 p-4">
      {/* ── SUMMARY CARDS ──────────────────────────────────────────────── */}
      {aggregates && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Participant Time"
            value={formatDuration(aggregates.cum.time)}
            detail={`${(aggregates.cum.time / visitMetrics.length).toFixed(0)} min avg/visit`}
            icon={<ClockIcon />}
            color="indigo"
          />
          <SummaryCard
            label="Total Blood Volume"
            value={`${aggregates.cum.blood.toFixed(1)} mL`}
            detail={`${(aggregates.cum.blood / visitMetrics.length).toFixed(1)} mL avg/visit`}
            icon={<BloodIcon />}
            color="red"
            alert={aggregates.cum.blood > 450 ? 'Approaches 550 mL safety limit (8 weeks)' : null}
          />
          <SummaryCard
            label="Estimated Total Cost"
            value={`$${aggregates.cum.cost.toFixed(0)}`}
            detail={`$${(aggregates.cum.cost / visitMetrics.length).toFixed(0)} avg/visit`}
            icon={<CostIcon />}
            color="emerald"
          />
          <SummaryCard
            label="Complexity (Total RVU)"
            value={aggregates.cum.rvu.toFixed(1)}
            detail={`${(aggregates.cum.rvu / visitMetrics.length).toFixed(1)} avg/visit`}
            icon={<ComplexityIcon />}
            color="amber"
          />
        </div>
      )}

      {/* ── PER-VISIT STACKED BAR CHARTS ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Per-Visit Burden Breakdown</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Click a visit bar to see procedure-level detail</p>
        </div>

        {/* Four metric rows */}
        {[
          { key: 'totalTime', label: 'Time (min)', suffix: ' min', color: '#6366f1', max: aggregates?.maxTime || 1 },
          { key: 'totalBlood', label: 'Blood (mL)', suffix: ' mL', color: '#ef4444', max: aggregates?.maxBlood || 1 },
          { key: 'totalCost', label: 'Cost ($)', suffix: '', color: '#10b981', max: aggregates?.maxCost || 1, prefix: '$' },
          { key: 'totalRvu', label: 'RVU', suffix: '', color: '#f59e0b', max: aggregates?.maxRvu || 1 },
        ].map((metric) => (
          <div key={metric.key} className="px-5 py-3 border-b border-gray-50 last:border-b-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20">{metric.label}</span>
            </div>
            <div className="flex items-end gap-1" style={{ height: 60 }}>
              {visitMetrics.map((vm, idx) => {
                const val = vm[metric.key];
                const pct = metric.max > 0 ? (val / metric.max) * 100 : 0;
                const isExpanded = expandedVisit === idx;
                return (
                  <div
                    key={vm.encounter.id}
                    className="flex-1 flex flex-col items-center cursor-pointer group"
                    onClick={() => setExpandedVisit(isExpanded ? null : idx)}
                  >
                    <span className="text-[8px] text-gray-400 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {metric.prefix || ''}{val.toFixed(1)}{metric.suffix}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${
                        isExpanded ? 'ring-2 ring-indigo-400' : 'hover:opacity-80'
                      }`}
                      style={{
                        height: `${Math.max(pct, 2)}%`,
                        backgroundColor: metric.color,
                        minHeight: val > 0 ? 3 : 1,
                        opacity: val > 0 ? 1 : 0.15,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Visit labels (show only on first metric row) */}
            {metric.key === 'totalTime' && (
              <div className="flex gap-1 mt-1">
                {visitMetrics.map((vm) => (
                  <div key={vm.encounter.id} className="flex-1 text-center">
                    <span className="text-[8px] text-gray-400 truncate block">
                      {vm.encounter.name || vm.encounter.label || `V${vm.encounter.order || '?'}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── EXPANDED VISIT DETAIL ──────────────────────────────────────── */}
      {expandedVisit !== null && visitMetrics[expandedVisit] && (
        <VisitDetail
          vm={visitMetrics[expandedVisit]}
          tubeTypes={tubeTypes}
          onClose={() => setExpandedVisit(null)}
        />
      )}

      {/* ── CATEGORY BREAKDOWN ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Burden by Activity Category</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Cumulative across all visits</p>
        </div>
        <div className="p-5 space-y-2">
          {Object.entries(categoryTotals)
            .sort((a, b) => b[1].time - a[1].time)
            .map(([cat, vals]) => {
              const catColor = CAT_COLORS[cat] || { bar: '#94a3b8' };
              return (
                <div key={cat} className="grid grid-cols-[120px_1fr_80px_80px_80px] gap-2 items-center">
                  <span className="text-[11px] font-semibold text-gray-700 truncate">{cat}</span>
                  <HBar
                    value={vals.time}
                    max={Math.max(...Object.values(categoryTotals).map((v) => v.time))}
                    color={catColor.bar}
                    label=""
                    suffix=" min"
                  />
                  <span className="text-[10px] text-gray-500 text-right">${vals.cost.toFixed(0)}</span>
                  <span className="text-[10px] text-gray-500 text-right">{vals.rvu.toFixed(1)} RVU</span>
                  <span className="text-[10px] text-gray-500 text-right">{vals.blood.toFixed(1)} mL</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── BLOOD VOLUME SAFETY ───────────────────────────────────────── */}
      {aggregates && aggregates.cum.blood > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Blood Draw Safety Analysis</h3>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1">
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      aggregates.cum.blood > 450 ? 'bg-red-500' : aggregates.cum.blood > 300 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((aggregates.cum.blood / 550) * 100, 100)}%` }}
                  />
                  {/* 550 mL marker */}
                  <div className="absolute top-0 right-0 h-full w-px bg-red-400" style={{ left: '100%' }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-gray-400">0 mL</span>
                  <span className="text-[9px] text-red-400 font-semibold">550 mL (8-week safety limit)</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${
                  aggregates.cum.blood > 450 ? 'text-red-600' : aggregates.cum.blood > 300 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {aggregates.cum.blood.toFixed(1)} mL
                </span>
                <p className="text-[9px] text-gray-400">total cumulative</p>
              </div>
            </div>

            {/* Tube type breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
              {Object.entries(
                visitMetrics.reduce((acc, vm) => {
                  Object.entries(vm.tubeVolumes).forEach(([tube, vol]) => {
                    acc[tube] = (acc[tube] || 0) + vol;
                  });
                  return acc;
                }, {})
              ).map(([tube, vol]) => {
                const tubeInfo = tubeTypes[tube] || {};
                return (
                  <div key={tube} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
                    <div
                      className="w-3 h-8 rounded-sm"
                      style={{ backgroundColor: tubeInfo.color || '#94a3b8' }}
                    />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-700">{tubeInfo.name || tube}</p>
                      <p className="text-[9px] text-gray-500">{vol.toFixed(1)} mL total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── METHODOLOGY / DEFINITIONS ─────────────────────────────────── */}
      <MethodologyPanel conversionFactor={procedureBurden?._meta?.conversionFactor || 32.35} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: find burden data for an activity by trying multiple keys
// ═══════════════════════════════════════════════════════════════════════════
function findBurden(activity, burdenMap) {
  // Try exact ID match first (procedure library ID)
  if (activity.catalogId && burdenMap.has(activity.catalogId)) return burdenMap.get(activity.catalogId);
  if (activity.id && burdenMap.has(activity.id)) return burdenMap.get(activity.id);

  // Try by name match (normalized)
  const normName = (activity.name || '').toLowerCase().trim();
  for (const [key, val] of burdenMap) {
    if (key.toLowerCase() === normName) return val;
    if (val.name && val.name.toLowerCase() === normName) return val;
  }

  // Try shortName match
  if (activity.shortName) {
    for (const [, val] of burdenMap) {
      if (val.shortName && val.shortName.toLowerCase() === activity.shortName.toLowerCase()) return val;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════

function SummaryCard({ label, value, detail, icon, color, alert }) {
  const colorMap = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const iconColor = {
    indigo: 'text-indigo-500',
    red: 'text-red-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.indigo}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`${iconColor[color]} w-5 h-5`}>{icon}</span>
        {alert && (
          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[8px] font-bold animate-pulse">WARNING</span>
        )}
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] opacity-70">{label}</p>
      <p className="text-[9px] opacity-50 mt-0.5">{detail}</p>
      {alert && <p className="text-[9px] text-red-600 font-medium mt-1">{alert}</p>}
    </div>
  );
}

function VisitDetail({ vm, tubeTypes, onClose }) {
  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-indigo-100 bg-indigo-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-indigo-900">
            {vm.encounter.name || vm.encounter.label || 'Visit'} — Procedure Detail
          </h3>
          <p className="text-[10px] text-indigo-500">
            {vm.activityCount} procedures | {vm.totalTime.toFixed(0)} min | {vm.totalBlood.toFixed(1)} mL | ${vm.totalCost.toFixed(0)} | {vm.totalRvu.toFixed(1)} RVU
          </p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded transition-colors">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Procedure</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Category</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">Time (min)</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">Blood (mL)</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">Cost ($)</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">RVU</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Codes</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Source</th>
            </tr>
          </thead>
          <tbody>
            {vm.activityDetails
              .sort((a, b) => b.time - a.time)
              .map((det, i) => {
                const catColor = CAT_COLORS[det.category] || {};
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-1.5 font-medium text-gray-800">{det.name}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${catColor.bg || 'bg-gray-100'} ${catColor.text || 'text-gray-600'}`}>
                        {det.category}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{det.time}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{det.blood > 0 ? det.blood.toFixed(1) : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{det.cost > 0 ? `$${det.cost.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{det.rvu > 0 ? det.rvu.toFixed(2) : '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500">
                      {det.loincCode && <span className="mr-1">LOINC:{det.loincCode}</span>}
                      {det.cptCode && <span>CPT:{det.cptCode}</span>}
                    </td>
                    <td className="px-3 py-1.5 text-gray-400 max-w-[200px] truncate" title={det.derivation}>
                      {det.derivation || '—'}
                    </td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-bold text-gray-800">
              <td className="px-3 py-2" colSpan={2}>TOTAL</td>
              <td className="px-3 py-2 text-right">{vm.totalTime.toFixed(0)}</td>
              <td className="px-3 py-2 text-right">{vm.totalBlood.toFixed(1)}</td>
              <td className="px-3 py-2 text-right">${vm.totalCost.toFixed(0)}</td>
              <td className="px-3 py-2 text-right">{vm.totalRvu.toFixed(1)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function MethodologyPanel({ conversionFactor }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span className="text-sm font-semibold text-gray-700">Methodology & Definitions</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-5 py-4 border-t border-gray-100 space-y-4 text-[11px] text-gray-600 leading-relaxed">
          <div>
            <h4 className="font-bold text-gray-800 text-xs mb-1">Participant Time Burden (minutes)</h4>
            <p>
              Estimated total time a participant spends per visit, computed as the sum of individual procedure
              durations. Procedure times are derived from <strong>CMS physician time data</strong> (pre-service +
              intra-service + post-service minutes from the Medicare PFS) and published <strong>time-and-motion
              studies</strong> (PMC8249906, PMC11335779). For procedures without CMS time data, estimates are based
              on clinical practice standards and Tufts CSDD Work Effort Unit methodology.
            </p>
            <p className="mt-1 font-mono text-[10px] bg-gray-50 p-2 rounded">
              Visit Time = SUM(procedure_time_minutes) for all scheduled activities in that visit
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-800 text-xs mb-1">Blood Volume (mL)</h4>
            <p>
              Total blood draw volume per visit, incorporating <strong>tube-sharing optimization</strong>.
              Per-test volumes come from <strong>ARUP Laboratories</strong> and <strong>Laboratory Alliance</strong>
              specimen collection guides. Multiple lab tests using the same tube type (e.g., CMP + Hepatic
              Panel both use SST Gold) share a single tube draw — the maximum volume for that tube type
              is used rather than summing individual test volumes.
            </p>
            <p className="mt-1 font-mono text-[10px] bg-gray-50 p-2 rounded">
              Visit Blood = SUM over tube_types( MAX(volume per test using that tube) )<br />
              Safety Limit: 550 mL over 8 weeks (adult, non-pregnant, 110+ lbs)
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-800 text-xs mb-1">Estimated Cost (USD)</h4>
            <p>
              Visit cost is the sum of per-procedure costs. <strong>Lab tests</strong> use the <strong>CMS
              Clinical Laboratory Fee Schedule (CLFS) 2025</strong> national rates. <strong>Procedures and
              imaging</strong> use the CMS Physician Fee Schedule formula:
            </p>
            <p className="mt-1 font-mono text-[10px] bg-gray-50 p-2 rounded">
              Procedure Cost = Total RVU x Conversion Factor (${conversionFactor})<br />
              Visit Cost = SUM(procedure_cost) for all scheduled activities
            </p>
            <p className="mt-1">
              Note: These are <strong>Medicare reimbursement rates</strong>, not actual trial site costs.
              Actual costs may vary by geography, institution, and negotiated rates.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-800 text-xs mb-1">Complexity Score (RVU)</h4>
            <p>
              <strong>Relative Value Units</strong> from the <strong>CMS Physician Fee Schedule (PFS) 2025</strong>.
              Each procedure's total RVU comprises three components:
            </p>
            <p className="mt-1 font-mono text-[10px] bg-gray-50 p-2 rounded">
              Total RVU = Work RVU + Practice Expense RVU + Malpractice RVU<br />
              Visit Complexity = SUM(total_rvu) for all scheduled activities
            </p>
            <p className="mt-1">
              <strong>Work RVU</strong> (~51%) reflects physician time and effort.
              <strong> Practice Expense RVU</strong> (~45%) covers facility and equipment.
              <strong> Malpractice RVU</strong> (~4%) covers liability insurance.
              Higher RVU indicates more complex, resource-intensive procedures.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <h4 className="font-bold text-gray-800 text-xs mb-1">Data Sources</h4>
            <ul className="space-y-0.5 list-disc list-inside text-[10px] text-gray-500">
              <li>CMS Physician Fee Schedule RVU Files (2025) — Work, PE, MP RVUs and physician time</li>
              <li>CMS Clinical Laboratory Fee Schedule (2025) — National lab test payment rates</li>
              <li>LOINC v2.77 — Laboratory test identification and specimen type mapping</li>
              <li>ARUP Laboratories & Laboratory Alliance — Specimen collection volume guides</li>
              <li>Published time-motion studies (PMC8249906, PMC11335779) — Procedure duration estimates</li>
              <li>CMS Conversion Factor: ${conversionFactor} (2025)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────
function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function BloodIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C12 2 5 10 5 14.5C5 18.09 8.13 21 12 21s7-2.91 7-6.5C19 10 12 2 12 2z" />
    </svg>
  );
}
function CostIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function ComplexityIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes.toFixed(0)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
