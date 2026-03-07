import React, { useState } from 'react';
import { createPortal } from 'react-dom';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

export const CAT_COLORS = {
  ADMIN:      { bar: '#64748b', bg: 'bg-slate-100',  text: 'text-slate-700' },
  CLINICAL:   { bar: '#3b82f6', bg: 'bg-blue-100',   text: 'text-blue-700' },
  LABORATORY: { bar: '#a855f7', bg: 'bg-purple-100', text: 'text-purple-700' },
  IMAGING:    { bar: '#6366f1', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  EFFICACY:   { bar: '#22c55e', bg: 'bg-green-100',  text: 'text-green-700' },
  SAFETY:     { bar: '#f59e0b', bg: 'bg-amber-100',  text: 'text-amber-700' },
  PK:         { bar: '#f43f5e', bg: 'bg-rose-100',   text: 'text-rose-700' },
  TREATMENT:  { bar: '#06b6d4', bg: 'bg-cyan-100',   text: 'text-cyan-700' },
  PRO:        { bar: '#14b8a6', bg: 'bg-teal-100',   text: 'text-teal-700' },
};

export const TAB_ACTIVE = {
  indigo:  'bg-indigo-100 text-indigo-700',
  red:     'bg-red-100 text-red-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber:   'bg-amber-100 text-amber-700',
};

// ═══════════════════════════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════════════════════════

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes.toFixed(0)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function visitLabel(enc) {
  return enc.name || enc.label || `V${enc.order || '?'}`;
}

/** Generate nice round tick values for an axis. */
export function computeYTicks(maxValue, count = 5) {
  if (maxValue <= 0) return [0];
  const raw = maxValue / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 2.5, 5, 10].find((n) => n * mag >= raw) * mag;
  const ticks = [];
  for (let v = 0; v <= maxValue + nice * 0.01; v += nice) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

// ── SVG arc helpers ──────────────────────────────────────────────────────

export function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function describeArc(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function describeArcSlice(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reusable components
// ═══════════════════════════════════════════════════════════════════════════

/** Horizontal bar with label and value — compact. */
export function HBar({ value, max, color = '#6366f1', label, suffix = '' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-[9px] text-gray-500 w-14 text-right shrink-0">{label}</span>}
      <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-bold text-gray-700 w-14 shrink-0">
        {typeof value === 'number' ? value.toFixed(1) : value}{suffix}
      </span>
    </div>
  );
}

/** Hero stat card for the top of each tab — compact. */
export function HeroCard({ value, label, detail, icon, colorClass, alertText, children }) {
  return (
    <div className={`rounded-xl border px-5 py-3 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-2xl font-bold leading-tight">{value}</p>
            <p className="text-[10px] opacity-70">{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {alertText && (
            <p className="text-[9px] font-semibold text-red-600 animate-pulse max-w-[120px]">{alertText}</p>
          )}
          {detail && (
            <div className="text-right bg-white/50 rounded-lg px-2.5 py-1.5">
              <p className="text-sm font-bold">{detail.value}</p>
              <p className="text-[9px] opacity-60">{detail.label}</p>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Fullscreen modal overlay for expanded chart view. */
function ExpandModal({ title, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[92vw] max-w-[1200px] max-h-[88vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Section card wrapper — compact, with expand button. */
export function SectionCard({ title, subtitle, children, expandable = true }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {title && (
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-gray-800">{title}</h3>
              {subtitle && <p className="text-[9px] text-gray-400">{subtitle}</p>}
            </div>
            {expandable && (
              <button
                onClick={() => setExpanded(true)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors"
                title="Expand"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="px-4 py-3">{children}</div>
      </div>

      {expanded && (
        <ExpandModal title={title} onClose={() => setExpanded(false)}>
          {children}
        </ExpandModal>
      )}
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────

export function ClockIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
export function BloodIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C12 2 5 10 5 14.5C5 18.09 8.13 21 12 21s7-2.91 7-6.5C19 10 12 2 12 2z" />
    </svg>
  );
}
export function CostIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
export function ComplexityIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
