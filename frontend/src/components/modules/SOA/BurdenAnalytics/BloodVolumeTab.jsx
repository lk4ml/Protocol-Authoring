import React, { useState, useMemo } from 'react';
import { HeroCard, SectionCard, BloodIcon, visitLabel, polarToCartesian } from './shared';
import VisitDetailTable from './VisitDetailTable';

/** Compact safety gauge rendered inline next to the hero value. */
function SafetyGauge({ totalBlood }) {
  const gaugeAngle = Math.min((totalBlood / 550) * 180, 180);
  const gaugeColor = totalBlood > 450 ? '#ef4444' : totalBlood > 300 ? '#f59e0b' : '#22c55e';
  const needleAngle = -180 + gaugeAngle;
  const tip = polarToCartesian(50, 50, 36, needleAngle);

  return (
    <svg viewBox="0 0 100 58" className="w-24 h-14">
      <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke="#e5e7eb" strokeWidth={6} strokeLinecap="round" />
      <path
        d={`M 8 52 A 42 42 0 0 1 ${polarToCartesian(50, 52, 42, -180 + (300/550)*180).x} ${polarToCartesian(50, 52, 42, -180 + (300/550)*180).y}`}
        fill="none" stroke="#22c55e" strokeWidth={6} strokeLinecap="round"
      />
      <path
        d={`M ${polarToCartesian(50, 52, 42, -180 + (300/550)*180).x} ${polarToCartesian(50, 52, 42, -180 + (300/550)*180).y} A 42 42 0 0 1 ${polarToCartesian(50, 52, 42, -180 + (450/550)*180).x} ${polarToCartesian(50, 52, 42, -180 + (450/550)*180).y}`}
        fill="none" stroke="#f59e0b" strokeWidth={6}
      />
      <path
        d={`M ${polarToCartesian(50, 52, 42, -180 + (450/550)*180).x} ${polarToCartesian(50, 52, 42, -180 + (450/550)*180).y} A 42 42 0 0 1 92 52`}
        fill="none" stroke="#ef4444" strokeWidth={6} strokeLinecap="round"
      />
      <line x1={50} y1={52} x2={tip.x} y2={tip.y} stroke={gaugeColor} strokeWidth={2} strokeLinecap="round" />
      <circle cx={50} cy={52} r={3} fill={gaugeColor} />
      <text x={8} y={56} fontSize={5} fill="#9ca3af">0</text>
      <text x={92} y={56} fontSize={5} fill="#ef4444" textAnchor="end">550</text>
    </svg>
  );
}

export default function BloodVolumeTab({ visitMetrics, aggregates, tubeTypes }) {
  const [selectedVisit, setSelectedVisit] = useState(null);

  const avgBlood = visitMetrics.length > 0 ? aggregates.cum.blood / visitMetrics.length : 0;
  const maxBlood = aggregates.maxBlood || 1;

  // Cumulative blood progression
  const cumulative = useMemo(() => {
    let total = 0;
    return visitMetrics.map((vm) => {
      total += vm.totalBlood;
      return total;
    });
  }, [visitMetrics]);

  // Aggregate tube volumes
  const totalTubeVolumes = useMemo(() => {
    const acc = {};
    visitMetrics.forEach((vm) => {
      Object.entries(vm.tubeVolumes).forEach(([tube, vol]) => {
        acc[tube] = (acc[tube] || 0) + vol;
      });
    });
    return acc;
  }, [visitMetrics]);

  // Bubble sizing — RED circles, radius proportional to volume
  const maxR = 30;
  const scaleFactor = maxBlood > 0 ? maxR / Math.sqrt(maxBlood / Math.PI) : 1;

  // SVG dimensions
  const bubbleSpacing = Math.max(72, Math.min(110, 550 / visitMetrics.length));
  const svgW = Math.max(visitMetrics.length * bubbleSpacing + 60, 320);
  const svgH = 160;
  const centerY = 62;

  return (
    <div className="space-y-3">
      {/* Hero with inline gauge */}
      <HeroCard
        value={`${aggregates.cum.blood.toFixed(1)} mL`}
        label="Total Blood Volume"
        detail={{ value: `${avgBlood.toFixed(1)} mL`, label: 'avg / visit' }}
        icon={<BloodIcon className="w-5 h-5 text-red-500" />}
        colorClass="bg-red-50 border-red-200 text-red-900"
        alertText={aggregates.cum.blood > 450 ? 'Approaches 550 mL safety limit' : null}
      >
        <div className="flex justify-center mt-1">
          <SafetyGauge totalBlood={aggregates.cum.blood} />
        </div>
      </HeroCard>

      {/* Bubble Chart — RED circles */}
      <SectionCard title="Blood Draw Per Visit" subtitle="Circle size proportional to volume. Click for detail.">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-h-[180px]" style={{ minWidth: Math.max(svgW, 280) }}>
            {/* Connecting baseline */}
            <line x1={30} x2={svgW - 30} y1={centerY} y2={centerY} stroke="#fecaca" strokeWidth={1} strokeDasharray="4 3" />

            {/* Bubbles — always RED */}
            {visitMetrics.map((vm, i) => {
              const cx = 45 + i * bubbleSpacing;
              const r = vm.totalBlood > 0 ? Math.max(Math.sqrt(vm.totalBlood / Math.PI) * scaleFactor, 6) : 4;
              const isSelected = selectedVisit === i;

              return (
                <g
                  key={vm.encounter.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedVisit(isSelected ? null : i)}
                >
                  {isSelected && <circle cx={cx} cy={centerY} r={r + 3} fill="none" stroke="#b91c1c" strokeWidth={1.5} strokeDasharray="3 2" />}

                  {vm.totalBlood > 0 ? (
                    <>
                      <circle cx={cx} cy={centerY} r={r} fill="#ef4444" opacity={0.75} />
                      <circle cx={cx} cy={centerY} r={r} fill="none" stroke="#dc2626" strokeWidth={1} />
                    </>
                  ) : (
                    <circle cx={cx} cy={centerY} r={4} fill="#fecaca" stroke="#fca5a5" strokeWidth={0.5} />
                  )}

                  {/* Volume label */}
                  <text x={cx} y={centerY + r + 14} textAnchor="middle" fontSize={9} fontWeight={600} fill="#374151">
                    {vm.totalBlood > 0 ? `${vm.totalBlood.toFixed(1)} mL` : '0'}
                  </text>
                  {/* Visit name */}
                  <text x={cx} y={centerY + r + 24} textAnchor="middle" fontSize={7} fill="#9ca3af">
                    {visitLabel(vm.encounter)}
                  </text>
                  {/* Cumulative small label at top */}
                  {cumulative[i] > 0 && (
                    <text x={cx} y={centerY - r - 5} textAnchor="middle" fontSize={6} fill="#dc2626" opacity={0.7}>
                      {'\u03A3'}{cumulative[i].toFixed(1)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </SectionCard>

      {/* Tube Type Legend — compact */}
      {Object.keys(totalTubeVolumes).length > 0 && (
        <SectionCard title="Tube Types" subtitle="Cumulative across all visits" expandable={false}>
          <div className="flex flex-wrap gap-3">
            {Object.entries(totalTubeVolumes).map(([tube, vol]) => {
              const info = tubeTypes[tube] || {};
              return (
                <div key={tube} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50">
                  <div className="w-3 h-6 rounded-sm shrink-0" style={{ backgroundColor: info.color || '#94a3b8' }} />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-700">{info.name || tube}</p>
                    <p className="text-[9px] text-gray-500">{vol.toFixed(1)} mL</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Selected Visit Detail */}
      {selectedVisit !== null && visitMetrics[selectedVisit] && (
        <VisitDetailTable
          vm={visitMetrics[selectedVisit]}
          onClose={() => setSelectedVisit(null)}
          sortBy="blood"
          filter={(d) => d.blood > 0}
        />
      )}
    </div>
  );
}
