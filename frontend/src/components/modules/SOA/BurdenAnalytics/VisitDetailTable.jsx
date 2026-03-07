import React from 'react';
import { CAT_COLORS } from './shared';

/**
 * VisitDetailTable — expandable per-visit procedure detail table.
 * Reused by all four metric tabs.
 *
 * @param {Object} props
 * @param {Object} props.vm — visitMetrics entry for a single encounter
 * @param {Object} props.tubeTypes — from procedureBurden.tubeTypes
 * @param {Function} props.onClose
 * @param {string} [props.sortBy='time'] — 'time' | 'blood' | 'cost' | 'rvu'
 * @param {Function} [props.filter] — optional predicate to filter activityDetails
 */
export default function VisitDetailTable({ vm, tubeTypes = {}, onClose, sortBy = 'time', filter }) {
  let details = [...vm.activityDetails];
  if (filter) details = details.filter(filter);
  details.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

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
            {details.map((det, i) => {
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
                  <td className="px-3 py-1.5 text-right text-gray-700">{det.blood > 0 ? det.blood.toFixed(1) : '\u2014'}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700">{det.cost > 0 ? `$${det.cost.toFixed(2)}` : '\u2014'}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700">{det.rvu > 0 ? det.rvu.toFixed(2) : '\u2014'}</td>
                  <td className="px-3 py-1.5 text-gray-500">
                    {det.loincCode && <span className="mr-1">LOINC:{det.loincCode}</span>}
                    {det.cptCode && <span>CPT:{det.cptCode}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-gray-400 max-w-[200px] truncate" title={det.derivation}>
                    {det.derivation || '\u2014'}
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
