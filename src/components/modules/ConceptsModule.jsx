import React from 'react';

export default function ConceptsModule({ cdiscData }) {
  const biomedicalConcepts = cdiscData.biomedicalConcepts || [];
  
  // Group by category
  const conceptsByCategory = {};
  biomedicalConcepts.forEach(bc => {
    const category = bc.category || 'Other';
    if (!conceptsByCategory[category]) {
      conceptsByCategory[category] = [];
    }
    conceptsByCategory[category].push(bc);
  });

  const categories = Object.keys(conceptsByCategory);

  if (cdiscData.loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="text-center py-8">
            <div className="animate-spin text-4xl mb-4">⟳</div>
            <p className="text-slate-500">Loading biomedical concepts from CDISC Library...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">🧬</span>
          Biomedical Concepts Library
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          CDISC Biomedical Concepts define standardized measurements with CDASH/SDTM variable mappings.
          {cdiscData.error && (
            <span className="text-amber-600 ml-2">
              (Using fallback data: {cdiscData.error})
            </span>
          )}
        </p>
        {categories.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No biomedical concepts available. Check CDISC Library connection.
          </div>
        ) : (
          <div className="grid gap-4">
            {categories.map(category => {
              const concepts = conceptsByCategory[category];
              return (
                <div key={category} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 font-medium text-slate-700">
                    {category}
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    {concepts.map(bc => (
                      <div key={bc.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100">
                        <div className="font-medium text-slate-800 text-sm">{bc.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                            {bc.domain}
                          </span>
                          <span className="text-xs text-slate-500">NCI: {bc.code}</span>
                          {bc.unit && (
                            <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                              {bc.unit}
                            </span>
                          )}
                        </div>
                        {bc.dataElements && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {bc.dataElements.slice(0, 4).map(de => (
                              <span
                                key={de.name}
                                className="text-xs text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200"
                              >
                                {de.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

