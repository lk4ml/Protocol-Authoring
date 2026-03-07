import React, { useState } from 'react';

/**
 * MethodologyPanel — collapsible documentation panel explaining all burden metrics.
 */
export default function MethodologyPanel({ conversionFactor = 32.35 }) {
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
              durations. Procedure times are derived from <strong>CMS physician time data</strong> and published <strong>time-and-motion
              studies</strong> (PMC8249906, PMC11335779).
            </p>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 text-xs mb-1">Blood Volume (mL)</h4>
            <p>
              Total blood draw volume per visit, incorporating <strong>tube-sharing optimization</strong>.
              Multiple lab tests using the same tube type share a single tube draw.
              Safety limit: 550 mL over 8 weeks (adult, non-pregnant, 110+ lbs).
            </p>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 text-xs mb-1">Estimated Cost (USD)</h4>
            <p>
              Lab tests use the <strong>CMS CLFS 2025</strong> national rates. Procedures use the CMS PFS formula:
              Total RVU x Conversion Factor (${conversionFactor}).
              These are Medicare reimbursement rates, not actual trial site costs.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 text-xs mb-1">Complexity Score (RVU)</h4>
            <p>
              <strong>Relative Value Units</strong> from the <strong>CMS PFS 2025</strong>.
              Total RVU = Work RVU (~51%) + Practice Expense RVU (~45%) + Malpractice RVU (~4%).
            </p>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <h4 className="font-bold text-gray-800 text-xs mb-1">Data Sources</h4>
            <ul className="space-y-0.5 list-disc list-inside text-[10px] text-gray-500">
              <li>CMS Physician Fee Schedule RVU Files (2025)</li>
              <li>CMS Clinical Laboratory Fee Schedule (2025)</li>
              <li>LOINC v2.77</li>
              <li>ARUP Laboratories & Laboratory Alliance specimen guides</li>
              <li>Published time-motion studies (PMC8249906, PMC11335779)</li>
              <li>CMS Conversion Factor: ${conversionFactor} (2025)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
