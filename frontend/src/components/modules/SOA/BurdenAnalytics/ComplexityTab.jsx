import React, { useState, useMemo } from 'react';
import { CAT_COLORS, HeroCard, SectionCard, ComplexityIcon, visitLabel, polarToCartesian } from './shared';
import VisitDetailTable from './VisitDetailTable';

/** Large gauge meter for overall complexity. */
function OverallGauge({ value, max }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const angle = pct * 180;
  const needleTip = polarToCartesian(100, 95, 70, -180 + angle);
  const color = pct > 0.75 ? '#dc2626' : pct > 0.5 ? '#d97706' : pct > 0.25 ? '#f59e0b' : '#22c55e';

  return (
    <svg viewBox="0 0 200 110" className="w-40 h-20">
      {/* Track */}
      <path d="M 15 95 A 85 85 0 0 1 185 95" fill="none" stroke="#f3f4f6" strokeWidth={10} strokeLinecap="round" />
      {/* Green */}
      <path
        d={`M 15 95 A 85 85 0 0 1 ${polarToCartesian(100, 95, 85, -180 + 45).x} ${polarToCartesian(100, 95, 85, -180 + 45).y}`}
        fill="none" stroke="#22c55e" strokeWidth={10} strokeLinecap="round"
      />
      {/* Amber */}
      <path
        d={`M ${polarToCartesian(100, 95, 85, -180 + 45).x} ${polarToCartesian(100, 95, 85, -180 + 45).y} A 85 85 0 0 1 ${polarToCartesian(100, 95, 85, -180 + 90).x} ${polarToCartesian(100, 95, 85, -180 + 90).y}`}
        fill="none" stroke="#fbbf24" strokeWidth={10}
      />
      {/* Orange */}
      <path
        d={`M ${polarToCartesian(100, 95, 85, -180 + 90).x} ${polarToCartesian(100, 95, 85, -180 + 90).y} A 85 85 0 0 1 ${polarToCartesian(100, 95, 85, -180 + 135).x} ${polarToCartesian(100, 95, 85, -180 + 135).y}`}
        fill="none" stroke="#f59e0b" strokeWidth={10}
      />
      {/* Red */}
      <path
        d={`M ${polarToCartesian(100, 95, 85, -180 + 135).x} ${polarToCartesian(100, 95, 85, -180 + 135).y} A 85 85 0 0 1 185 95`}
        fill="none" stroke="#ef4444" strokeWidth={10} strokeLinecap="round"
      />
      {/* Needle */}
      <line x1={100} y1={95} x2={needleTip.x} y2={needleTip.y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={100} cy={95} r={4} fill={color} />
      {/* Labels */}
      <text x={15} y={104} fontSize={7} fill="#9ca3af">Low</text>
      <text x={185} y={104} fontSize={7} fill="#ef4444" textAnchor="end">High</text>
      <text x={100} y={85} textAnchor="middle" fontSize={16} fontWeight={700} fill="#92400e">
        {value.toFixed(1)}
      </text>
      <text x={100} y={95} textAnchor="middle" fontSize={7} fill="#b45309">RVU</text>
    </svg>
  );
}

/** Small per-visit gauge. */
function VisitGauge({ value, max, label, onClick, isSelected }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = 28;
  const circ = Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct > 0.75 ? '#d97706' : pct > 0.4 ? '#f59e0b' : '#fbbf24';

  return (
    <div
      className={`flex flex-col items-center cursor-pointer rounded-lg px-2 py-1.5 transition-all ${isSelected ? 'bg-amber-50 ring-1 ring-amber-300' : 'hover:bg-gray-50'}`}
      onClick={onClick}
    >
      <svg viewBox="0 0 68 40" className="w-16 h-10">
        <path d="M 6 36 A 28 28 0 0 1 62 36" fill="none" stroke="#f3f4f6" strokeWidth={5} strokeLinecap="round" />
        <path
          d="M 6 36 A 28 28 0 0 1 62 36"
          fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        <text x={34} y={32} textAnchor="middle" fontSize={10} fontWeight={700} fill="#92400e">
          {value.toFixed(1)}
        </text>
      </svg>
      <span className="text-[8px] text-gray-500 leading-tight">{label}</span>
    </div>
  );
}

export default function ComplexityTab({ visitMetrics, aggregates, categoryTotals }) {
  const [selectedVisit, setSelectedVisit] = useState(null);

  const avgRvu = visitMetrics.length > 0 ? aggregates.cum.rvu / visitMetrics.length : 0;

  // Aggregate RVU sub-components
  const rvuComponents = useMemo(() => {
    let work = 0, pe = 0, mp = 0;
    visitMetrics.forEach((vm) => {
      vm.activityDetails.forEach((d) => {
        work += d.rvuWork || 0;
        pe += d.rvuPE || 0;
        mp += d.rvuMP || 0;
      });
    });
    const total = work + pe + mp;
    return { work, pe, mp, total };
  }, [visitMetrics]);

  // Top procedures by RVU
  const topProcedures = useMemo(() => {
    const map = {};
    visitMetrics.forEach((vm) => {
      vm.activityDetails.forEach((d) => {
        if ((d.rvu || 0) <= 0) return;
        if (!map[d.name]) map[d.name] = { name: d.name, category: d.category, totalRvu: 0, cptCode: d.cptCode };
        map[d.name].totalRvu += d.rvu || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.totalRvu - a.totalRvu).slice(0, 6);
  }, [visitMetrics]);

  // Reasonable max for gauge scaling (use the maxRvu * visits for total gauge, or a nice upper bound)
  const gaugeMax = Math.max(aggregates.cum.rvu * 1.5, 10);

  return (
    <div className="space-y-3">
      {/* Hero with overall gauge */}
      <HeroCard
        value={aggregates.cum.rvu.toFixed(1)}
        label="Total Complexity (RVU)"
        detail={{ value: avgRvu.toFixed(1), label: 'avg / visit' }}
        icon={<ComplexityIcon className="w-5 h-5 text-amber-600" />}
        colorClass="bg-amber-50 border-amber-200 text-amber-900"
      >
        <div className="flex justify-center mt-1">
          <OverallGauge value={aggregates.cum.rvu} max={gaugeMax} />
        </div>
      </HeroCard>

      {/* RVU Component Summary — compact inline */}
      {rvuComponents.total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Work', value: rvuComponents.work, color: 'text-amber-800 bg-amber-100 border-amber-200' },
            { label: 'Practice Expense', value: rvuComponents.pe, color: 'text-amber-700 bg-amber-50 border-amber-200' },
            { label: 'Malpractice', value: rvuComponents.mp, color: 'text-orange-700 bg-orange-50 border-orange-200' },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border px-3 py-2 text-center ${c.color}`}>
              <p className="text-lg font-bold leading-tight">{c.value.toFixed(2)}</p>
              <p className="text-[9px] font-medium opacity-75">{c.label}</p>
              <p className="text-[8px] opacity-50">
                {rvuComponents.total > 0 ? ((c.value / rvuComponents.total) * 100).toFixed(0) : 0}%
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Per-Visit Gauges — main visualization */}
      <SectionCard title="Complexity by Visit" subtitle="Click a gauge for procedure detail">
        <div className="flex flex-wrap justify-center gap-2">
          {visitMetrics.map((vm, i) => (
            <VisitGauge
              key={vm.encounter.id}
              value={vm.totalRvu}
              max={aggregates.maxRvu || 1}
              label={visitLabel(vm.encounter)}
              isSelected={selectedVisit === i}
              onClick={() => setSelectedVisit(selectedVisit === i ? null : i)}
            />
          ))}
        </div>
      </SectionCard>

      {/* Top Procedures — compact */}
      {topProcedures.length > 0 && (
        <SectionCard title="Top Procedures by RVU" subtitle="Highest complexity procedures">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-1 text-left font-semibold text-gray-500 w-5">#</th>
                <th className="py-1 text-left font-semibold text-gray-500">Procedure</th>
                <th className="py-1 text-left font-semibold text-gray-500">Category</th>
                <th className="py-1 text-right font-semibold text-gray-500">RVU</th>
                <th className="py-1 text-right font-semibold text-gray-500">CPT</th>
              </tr>
            </thead>
            <tbody>
              {topProcedures.map((p, i) => {
                const catColor = CAT_COLORS[p.category] || {};
                return (
                  <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-1 text-gray-400">{i + 1}</td>
                    <td className="py-1 font-medium text-gray-800">{p.name}</td>
                    <td className="py-1">
                      <span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${catColor.bg || 'bg-gray-100'} ${catColor.text || 'text-gray-600'}`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="py-1 text-right font-bold text-amber-700">{p.totalRvu.toFixed(2)}</td>
                    <td className="py-1 text-right text-gray-500">{p.cptCode || '\u2014'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>
      )}

      {/* Selected Visit Detail */}
      {selectedVisit !== null && visitMetrics[selectedVisit] && (
        <VisitDetailTable
          vm={visitMetrics[selectedVisit]}
          onClose={() => setSelectedVisit(null)}
          sortBy="rvu"
        />
      )}
    </div>
  );
}
