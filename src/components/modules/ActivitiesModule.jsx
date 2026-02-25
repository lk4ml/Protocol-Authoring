import React from 'react';

export default function ActivitiesModule({
  protocol,
  activityCategories,
  activityCategoryConfig,
  cdiscData,
  onAddActivity,
  onSelectActivity,
  onRemoveBC
}) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">📝</span>
          Activities & CRF Forms
        </h2>
        <button
          onClick={onAddActivity}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          + Add Activity
        </button>
      </div>
      <div className="grid gap-4">
        {activityCategoryConfig.map(category => {
          const catActivities = activityCategories[category.id] || [];
          if (catActivities.length === 0) return null;
          return (
            <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className={`px-4 py-3 bg-${category.color}-50 border-b flex items-center gap-2`}>
                <span>{category.icon}</span>
                <span className={`font-medium text-${category.color}-700`}>{category.name}</span>
                <span className="text-xs text-slate-500 ml-auto">{catActivities.length} activities</span>
              </div>
              <div className="divide-y divide-slate-100">
                {catActivities.map(activity => (
                  <div key={activity.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium text-slate-800">{activity.name}</h4>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono">
                            {activity.domain}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                            {activity.formType}
                          </span>
                        </div>
                        {activity.bcIds?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {activity.bcIds.map(bcId => {
                              const bc = (cdiscData.biomedicalConcepts || []).find(b => b.id === bcId);
                              return bc ? (
                                <span
                                  key={bcId}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs"
                                >
                                  {bc.name}
                                  <button
                                    onClick={() => onRemoveBC(activity.id, bcId)}
                                    className="hover:text-red-500"
                                  >
                                    ✕
                                  </button>
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {activity.visits?.map(visitId => {
                            const visit = protocol.visits.find(v => v.id === visitId);
                            const assignment = activity.visitAssignments?.[visitId] || {};
                            return visit ? (
                              <span
                                key={visitId}
                                className={`px-2 py-0.5 rounded text-xs ${
                                  assignment.mandatory !== false
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {visit.label || visit.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => onSelectActivity(activity)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                        title="Map Biomedical Concepts"
                      >
                        🧬
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

