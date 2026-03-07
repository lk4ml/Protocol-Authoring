import React, { useState, useMemo } from 'react';
import { CAT_COLORS, HeroCard, SectionCard, CostIcon, visitLabel, computeYTicks } from './shared';
import VisitDetailTable from './VisitDetailTable';

/** Row of dollar signs as visual infographic. */
function DollarRow({ amount, quantum }) {
  const count = Math.round(amount / quantum);
  if (count <= 0) return null;
  return (
    <div className="flex items-center gap-[2px] flex-wrap mt-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-[9px] font-bold text-emerald-500">$</span>
      ))}
    </div>
  );
}

export default function CostTab({ visitMetrics, aggregates, categoryTotals }) {
  const [hovered, setHovered] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);

  const avgCost = visitMetrics.length > 0 ? aggregates.cum.cost / visitMetrics.length : 0;
  const yTicks = useMemo(() => computeYTicks(aggregates.maxCost, 4), [aggregates.maxCost]);
  const yMax = yTicks[yTicks.length - 1] || 1;
  const quantum = Math.max(Math.ceil(aggregates.maxCost / 6), 20);

  // Compact SVG vertical bar chart
  const marginL = 42, marginR = 16, marginT = 14, marginB = 32;
  const barW = 28;
  const gap = Math.max(8, Math.min(20, 240 / visitMetrics.length));
  const chartW = visitMetrics.length * (barW + gap) + gap;
  const chartH = 160;
  const svgW = marginL + chartW + marginR;
  const svgH = marginT + chartH + marginB;

  // Top procedures by cost (deduplicated, summed)
  const topProcedures = useMemo(() => {
    const map = {};
    visitMetrics.forEach((vm) => {
      vm.activityDetails.forEach((d) => {
        if (d.cost <= 0) return;
        if (!map[d.name]) map[d.name] = { name: d.name, category: d.category, totalCost: 0, visits: 0 };
        map[d.name].totalCost += d.cost;
        map[d.name].visits += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.totalCost - a.totalCost).slice(0, 8);
  }, [visitMetrics]);

  return (
    <div className="space-y-3">
      {/* Hero */}
      <HeroCard
        value={`$${aggregates.cum.cost.toFixed(0)}`}
        label="Estimated Total Cost"
        detail={{ value: `$${avgCost.toFixed(0)}`, label: 'avg / visit' }}
        icon={<CostIcon className="w-5 h-5 text-emerald-600" />}
        colorClass="bg-emerald-50 border-emerald-200 text-emerald-900"
      />

      {/* Vertical Bar Chart + Dollar Icons */}
      <SectionCard title="Cost Per Visit" subtitle="Click a bar for procedure detail">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-h-[220px]" style={{ minWidth: Math.max(svgW, 300) }}>
            {/* Grid lines + Y-axis labels */}
            {yTicks.map((tick) => {
              const y = marginT + chartH - (tick / yMax) * chartH;
              return (
                <g key={tick}>
                  <line x1={marginL} x2={marginL + chartW} y1={y} y2={y} stroke="#f3f4f6" strokeWidth={1} />
                  <text x={marginL - 4} y={y + 3} textAnchor="end" fontSize={7} fill="#9ca3af">${tick}</text>
                </g>
              );
            })}

            {/* Bars */}
            {visitMetrics.map((vm, i) => {
              const x = marginL + gap + i * (barW + gap);
              let yOffset = marginT + chartH;
              const cats = Object.entries(vm.categoryBreakdown)
                .filter(([, v]) => v.cost > 0)
                .sort((a, b) => a[1].cost - b[1].cost);
              const isSelected = selectedVisit === i;
              return (
                <g
                  key={vm.encounter.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelectedVisit(isSelected ? null : i)}
                >
                  {cats.map(([cat, vals]) => {
                    const h = (vals.cost / yMax) * chartH;
                    yOffset -= h;
                    return (
                      <rect
                        key={cat}
                        x={x}
                        y={yOffset}
                        width={barW}
                        height={h}
                        rx={2}
                        fill={CAT_COLORS[cat]?.bar || '#94a3b8'}
                        opacity={hovered === i ? 0.85 : 1}
                        stroke={isSelected ? '#059669' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                    );
                  })}
                  {/* Visit label */}
                  <text x={x + barW / 2} y={marginT + chartH + 12} textAnchor="middle" fontSize={8} fill="#6b7280">
                    {visitLabel(vm.encounter)}
                  </text>
                  {/* Dollar value on top */}
                  <text
                    x={x + barW / 2}
                    y={marginT + chartH - (vm.totalCost / yMax) * chartH - 4}
                    textAnchor="middle" fontSize={8} fontWeight={600} fill="#059669"
                  >
                    ${vm.totalCost.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Average line */}
            {avgCost > 0 && (
              <>
                <line
                  x1={marginL} x2={marginL + chartW}
                  y1={marginT + chartH - (avgCost / yMax) * chartH}
                  y2={marginT + chartH - (avgCost / yMax) * chartH}
                  stroke="#059669" strokeDasharray="4 3" strokeWidth={1}
                />
                <text
                  x={marginL + chartW + 3}
                  y={marginT + chartH - (avgCost / yMax) * chartH + 3}
                  fontSize={7} fontWeight={600} fill="#059669"
                >
                  Avg ${avgCost.toFixed(0)}
                </text>
              </>
            )}
          </svg>
        </div>

        {/* Dollar icons per visit */}
        <div className="mt-2 flex gap-4 flex-wrap">
          {visitMetrics.map((vm, i) => (
            <div key={vm.encounter.id} className="text-center">
              <p className="text-[9px] text-gray-500 font-medium">{visitLabel(vm.encounter)}</p>
              <DollarRow amount={vm.totalCost} quantum={quantum} />
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        {hovered !== null && visitMetrics[hovered] && (
          <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-[10px]">
            <p className="font-bold text-gray-800 mb-1">{visitLabel(visitMetrics[hovered].encounter)} — ${visitMetrics[hovered].totalCost.toFixed(0)}</p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-0.5">
              {Object.entries(visitMetrics[hovered].categoryBreakdown)
                .filter(([, v]) => v.cost > 0)
                .sort((a, b) => b[1].cost - a[1].cost)
                .map(([cat, vals]) => (
                  <div key={cat} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CAT_COLORS[cat]?.bar || '#94a3b8' }} />
                    <span className="text-gray-600">{cat}</span>
                    <span className="font-bold text-gray-800 ml-auto">${vals.cost.toFixed(0)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Most Expensive Procedures — compact */}
      {topProcedures.length > 0 && (
        <SectionCard title="Most Expensive Procedures" subtitle="Aggregated across all visits">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-1 text-left font-semibold text-gray-500 w-5">#</th>
                <th className="py-1 text-left font-semibold text-gray-500">Procedure</th>
                <th className="py-1 text-left font-semibold text-gray-500">Category</th>
                <th className="py-1 text-right font-semibold text-gray-500">Cost</th>
                <th className="py-1 text-right font-semibold text-gray-500">% Total</th>
              </tr>
            </thead>
            <tbody>
              {topProcedures.map((p, i) => {
                const catColor = CAT_COLORS[p.category] || {};
                const pct = aggregates.cum.cost > 0 ? ((p.totalCost / aggregates.cum.cost) * 100).toFixed(1) : '0';
                return (
                  <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-1 text-gray-400">{i + 1}</td>
                    <td className="py-1 font-medium text-gray-800">{p.name}</td>
                    <td className="py-1">
                      <span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${catColor.bg || 'bg-gray-100'} ${catColor.text || 'text-gray-600'}`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="py-1 text-right font-bold text-gray-800">${p.totalCost.toFixed(0)}</td>
                    <td className="py-1 text-right text-gray-500">{pct}%</td>
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
          sortBy="cost"
        />
      )}
    </div>
  );
}
