import React, { useState, useMemo } from 'react';
import { CAT_COLORS, HBar, HeroCard, SectionCard, ClockIcon, formatDuration, visitLabel, computeYTicks } from './shared';
import VisitDetailTable from './VisitDetailTable';

export default function ParticipantTimeTab({ visitMetrics, aggregates, categoryTotals }) {
  const [hovered, setHovered] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);

  const avgTime = visitMetrics.length > 0 ? aggregates.cum.time / visitMetrics.length : 0;
  const yTicks = useMemo(() => computeYTicks(aggregates.maxTime, 4), [aggregates.maxTime]);
  const yMax = yTicks[yTicks.length - 1] || 1;

  // Compact SVG dimensions
  const marginL = 38, marginR = 16, marginT = 14, marginB = 32;
  const barW = 26;
  const gap = Math.max(8, Math.min(20, 240 / visitMetrics.length));
  const chartW = visitMetrics.length * (barW + gap) + gap;
  const chartH = 160;
  const svgW = marginL + chartW + marginR;
  const svgH = marginT + chartH + marginB;

  return (
    <div className="space-y-3">
      {/* Hero */}
      <HeroCard
        value={formatDuration(aggregates.cum.time)}
        label="Total Participant Time"
        detail={{ value: `${avgTime.toFixed(0)} min`, label: 'avg / visit' }}
        icon={<ClockIcon className="w-5 h-5 text-indigo-500" />}
        colorClass="bg-indigo-50 border-indigo-200 text-indigo-900"
      />

      {/* Stacked Bar Chart */}
      <SectionCard title="Time Per Visit (minutes)" subtitle="Click a bar for procedure detail">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-h-[220px]" style={{ minWidth: Math.max(svgW, 300) }}>
            {/* Grid lines + Y-axis labels */}
            {yTicks.map((tick) => {
              const y = marginT + chartH - (tick / yMax) * chartH;
              return (
                <g key={tick}>
                  <line x1={marginL} x2={marginL + chartW} y1={y} y2={y} stroke="#f3f4f6" strokeWidth={1} />
                  <text x={marginL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="#9ca3af">{tick}</text>
                </g>
              );
            })}

            {/* Bars */}
            {visitMetrics.map((vm, i) => {
              const x = marginL + gap + i * (barW + gap);
              let yOffset = marginT + chartH;
              const cats = Object.entries(vm.categoryBreakdown)
                .filter(([, v]) => v.time > 0)
                .sort((a, b) => a[1].time - b[1].time);
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
                    const h = (vals.time / yMax) * chartH;
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
                        stroke={isSelected ? '#6366f1' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                    );
                  })}
                  {/* Visit label */}
                  <text x={x + barW / 2} y={marginT + chartH + 12} textAnchor="middle" fontSize={8} fill="#6b7280">
                    {visitLabel(vm.encounter)}
                  </text>
                  {/* Value on top */}
                  <text
                    x={x + barW / 2}
                    y={marginT + chartH - (vm.totalTime / yMax) * chartH - 4}
                    textAnchor="middle" fontSize={8} fontWeight={600} fill="#4b5563"
                  >
                    {vm.totalTime.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Average line */}
            {avgTime > 0 && (
              <>
                <line
                  x1={marginL} x2={marginL + chartW}
                  y1={marginT + chartH - (avgTime / yMax) * chartH}
                  y2={marginT + chartH - (avgTime / yMax) * chartH}
                  stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1}
                />
                <text
                  x={marginL + chartW + 3}
                  y={marginT + chartH - (avgTime / yMax) * chartH + 3}
                  fontSize={7} fontWeight={600} fill="#6366f1"
                >
                  Avg {avgTime.toFixed(0)}m
                </text>
              </>
            )}
          </svg>
        </div>

        {/* Hover tooltip */}
        {hovered !== null && visitMetrics[hovered] && (
          <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-[10px]">
            <p className="font-bold text-gray-800 mb-1">{visitLabel(visitMetrics[hovered].encounter)} — {visitMetrics[hovered].totalTime.toFixed(0)} min</p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-0.5">
              {Object.entries(visitMetrics[hovered].categoryBreakdown)
                .filter(([, v]) => v.time > 0)
                .sort((a, b) => b[1].time - a[1].time)
                .map(([cat, vals]) => (
                  <div key={cat} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CAT_COLORS[cat]?.bar || '#94a3b8' }} />
                    <span className="text-gray-600">{cat}</span>
                    <span className="font-bold text-gray-800 ml-auto">{vals.time.toFixed(0)}m</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Category Breakdown */}
      <SectionCard title="Time by Activity Category" subtitle="Cumulative across all visits">
        <div className="space-y-1.5">
          {Object.entries(categoryTotals)
            .filter(([, v]) => v.time > 0)
            .sort((a, b) => b[1].time - a[1].time)
            .map(([cat, vals]) => {
              const pct = aggregates.cum.time > 0 ? ((vals.time / aggregates.cum.time) * 100).toFixed(0) : 0;
              return (
                <div key={cat} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-24 shrink-0">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT_COLORS[cat]?.bar || '#94a3b8' }} />
                    <span className="text-[10px] font-semibold text-gray-700 truncate">{cat}</span>
                  </div>
                  <div className="flex-1">
                    <HBar value={vals.time} max={Math.max(...Object.values(categoryTotals).map(v => v.time))} color={CAT_COLORS[cat]?.bar} suffix=" min" />
                  </div>
                  <span className="text-[9px] text-gray-400 w-8 shrink-0 text-right">{pct}%</span>
                </div>
              );
            })}
        </div>
      </SectionCard>

      {/* Selected Visit Detail */}
      {selectedVisit !== null && visitMetrics[selectedVisit] && (
        <VisitDetailTable
          vm={visitMetrics[selectedVisit]}
          onClose={() => setSelectedVisit(null)}
          sortBy="time"
        />
      )}
    </div>
  );
}
