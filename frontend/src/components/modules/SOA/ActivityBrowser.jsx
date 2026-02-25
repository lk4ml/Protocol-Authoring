import React from 'react';

/**
 * CDISC verification badge shown on catalog-sourced activities.
 */
const CdiscBadge = () => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700">
    <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
    CDISC
  </span>
);

/**
 * ActivityBrowser - Browse and select activities from the CDISC catalog.
 *
 * Displays a searchable, category-filtered grid of standard activities
 * sourced from CDISC COSMoS Biomedical Concepts.
 */
export default function ActivityBrowser({
  categories,
  activities,
  selectedIds,
  addedCatalogIds,
  categoryFilter,
  searchQuery,
  categoryCounts,
  onCategoryChange,
  onSearchChange,
  onToggleActivity,
  onAddSelected,
  onSwitchToCustom,
  onClose,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">
            Browse CDISC Activity Catalog
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {activities.length} activities from CDISC COSMoS Biomedical Concepts
            {selectedIds.size > 0 && (
              <span className="ml-2 text-indigo-600 font-medium">
                ({selectedIds.size} selected)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onSwitchToCustom}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            or create custom activity
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search activities by name, domain, NCI code, or keyword..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex space-x-4">
          {/* Category Filter Sidebar */}
          <div className="w-52 flex-shrink-0">
            <div className="space-y-1">
              <button
                onClick={() => onCategoryChange('ALL')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === 'ALL'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span>All Activities</span>
                  <span className="text-xs font-bold">{categoryCounts.ALL || 0}</span>
                </span>
              </button>
              {categories.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                if (count === 0) return null;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onCategoryChange(cat.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      categoryFilter === cat.id
                        ? `${cat.bgHeader} ${cat.textHeader}`
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span>{cat.name}</span>
                      <span className="text-xs font-bold">{count}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Cards Grid */}
          <div className="flex-1 min-w-0">
            {activities.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm font-medium">No activities match your search</p>
                <p className="text-xs mt-1">Try different keywords or clear the filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2">
                {activities.map((activity) => {
                  const isAdded = addedCatalogIds.has(activity.id);
                  const isSelected = selectedIds.has(activity.id);
                  const category = categories.find((c) => c.id === activity.uiCategory);

                  return (
                    <div
                      key={activity.id}
                      onClick={() => !isAdded && onToggleActivity(activity.id)}
                      className={`border rounded-lg p-3 transition-all ${
                        isAdded
                          ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm cursor-pointer'
                          : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {!isAdded && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 flex-shrink-0"
                          />
                        )}
                        {isAdded && (
                          <svg className="mt-0.5 w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs text-gray-900 truncate">
                            {activity.name}
                          </div>
                          {activity.definition && (
                            <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">
                              {activity.definition}
                            </p>
                          )}
                          <div className="flex items-center flex-wrap gap-1 mt-1.5">
                            {activity.sdtmDomain && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  category?.badge || 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {activity.sdtmDomain}
                              </span>
                            )}
                            <CdiscBadge />
                            {activity.nciCode && (
                              <span className="text-[10px] text-gray-400">
                                {activity.nciCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bulk Add Button */}
            {selectedIds.size > 0 && (
              <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
                <button
                  onClick={onAddSelected}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add {selectedIds.size} {selectedIds.size === 1 ? 'Activity' : 'Activities'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
