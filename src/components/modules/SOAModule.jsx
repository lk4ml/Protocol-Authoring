import React from 'react';

export default function SOAModule({
  protocol,
  activityCategories,
  activityCategoryConfig,
  epochTypes,
  onToggleActivityVisit,
  onAddVisit,
  onSelectActivity
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">📅</span>
            Schedule of Activities
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center font-bold text-xs">X</span>
                Required
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-6 bg-amber-500 text-white rounded flex items-center justify-center font-bold text-xs">C</span>
                Conditional
              </span>
            </div>
            <button
              onClick={onAddVisit}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
            >
              + Add Visit
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-3 font-semibold text-slate-700 border-b border-r border-slate-200 min-w-56 sticky left-0 bg-slate-50 z-10">
                  <div className="text-xs text-slate-500 font-normal mb-1">Assessment / Procedure</div>
                  <div>Activity</div>
                </th>
                {protocol.visits.map(visit => {
                  const epoch = protocol.epochs.find(e => e.id === visit.epochId);
                  const epochType = epochTypes.find(e => e.code === epoch?.typeCode);
                  return (
                    <th
                      key={visit.id}
                      className={`p-2 border-b border-slate-200 min-w-24 text-center bg-${epochType?.color || 'slate'}-50`}
                    >
                      <div className="font-semibold text-slate-700 text-xs">{visit.name}</div>
                      <div className="text-xs text-slate-500 font-normal">{visit.windowLabel}</div>
                      {epochType && (
                        <div className={`text-xs font-normal mt-1 text-${epochType.color}-600`}>
                          {epochType.label}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activityCategoryConfig.map(category => {
                const catActivities = activityCategories[category.id] || [];
                if (catActivities.length === 0) return null;
                return (
                  <React.Fragment key={category.id}>
                    <tr className={`bg-${category.color}-50`}>
                      <td colSpan={protocol.visits.length + 1} className="px-3 py-1.5 border-b border-slate-200">
                        <span className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-2 text-${category.color}-700`}>
                          <span>{category.icon}</span>
                          {category.name}
                        </span>
                      </td>
                    </tr>
                    {catActivities.map(activity => (
                      <tr key={activity.id} className="hover:bg-slate-50 group">
                        <td className="p-2 border-b border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm text-slate-700 font-medium">{activity.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                                  {activity.domain}
                                </span>
                                {activity.bcIds?.length > 0 && (
                                  <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                    {activity.bcIds.length} BC
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => onSelectActivity(activity)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 p-1"
                              title="Map Biomedical Concepts"
                            >
                              🧬
                            </button>
                          </div>
                        </td>
                        {protocol.visits.map(visit => {
                          const isAssigned = activity.visits?.includes(visit.id);
                          const assignment = activity.visitAssignments?.[visit.id] || {};
                          const isMandatory = isAssigned && assignment.mandatory !== false;
                          const isConditional = isAssigned && assignment.conditional;
                          return (
                            <td key={visit.id} className="p-1 border-b border-slate-200 text-center">
                              <button
                                onClick={() => onToggleActivityVisit(activity.id, visit.id)}
                                className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all ${
                                  isMandatory
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : isConditional
                                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                                }`}
                              >
                                {isMandatory ? 'X' : isConditional ? 'C' : '—'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

