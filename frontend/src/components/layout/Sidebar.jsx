import React, { useState } from 'react';
import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import useProtocolStore from '../../store/useProtocolStore';
import useReferenceStore from '../../store/useReferenceStore';
import { WORKSPACE_NAV_ITEMS } from '../../config/productRegistry';

/**
 * Sidebar — sequential step navigation for the study workspace.
 *
 * Shows numbered steps so the user knows where they are in the workflow:
 *   1. Protocol Info
 *   2. Study Designer
 *   3. SOA Builder
 *   4. I/E Criteria
 *   5. Burden Analysis
 *   6. Export & Preview
 */
export default function Sidebar({
  navItems = WORKSPACE_NAV_ITEMS,
  basePath: basePathProp,
  homeUrl = '/workspace',
}) {
  const { id: protocolId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const protocol = useProtocolStore((s) => s.protocol);
  const trials = useReferenceStore((s) => s.trials);
  const panelOpen = useReferenceStore((s) => s.panelOpen);
  const togglePanel = useReferenceStore((s) => s.togglePanel);
  const [collapsed, setCollapsed] = useState(false);

  const basePath = basePathProp || `/study/${protocolId}`;
  const protocolNumber = protocol?.protocolNumber || 'Loading...';
  const phase = protocol?.phase || '';

  // Figure out which step is active
  const currentPath = location.pathname;
  const activeIdx = navItems.findIndex((item) => {
    const fullPath = `${basePath}/${item.path}`.replace(/\/$/, '');
    if (item.path === '') {
      return currentPath === basePath || currentPath === basePath + '/';
    }
    return currentPath.startsWith(fullPath);
  });

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ease-in-out`}
    >
      {/* Home Button */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => navigate(homeUrl)}
          className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors group ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Back to Home"
        >
          <svg className="w-5 h-5 flex-shrink-0 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          {!collapsed && <span className="ml-2.5">Home</span>}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3 border-b border-gray-200" />

      {/* Protocol identity header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {protocolNumber}
              </p>
              {phase && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 mt-1">
                  {phase}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Workflow label */}
      {!collapsed && (
        <div className="px-5 pt-4 pb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Workflow</p>
        </div>
      )}

      {/* Sequential navigation steps */}
      <nav className="flex-1 py-1 space-y-0.5 overflow-y-auto px-2">
        {navItems.map((item, idx) => {
          const isActive = idx === activeIdx;
          const isCompleted = activeIdx >= 0 && idx < activeIdx;
          const stepNum = idx + 1;

          return (
            <NavLink
              key={item.path}
              to={`${basePath}/${item.path}`}
              end={item.path === ''}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {/* Step number / check */}
              {!collapsed && (
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </span>
              )}

              {collapsed && (
                <span className="flex-shrink-0">{item.icon}</span>
              )}

              {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Reference Trials toggle */}
      {trials.length > 0 && (
        <div className="px-3 pb-2">
          <button
            onClick={() => togglePanel()}
            className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group ${
              panelOpen
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
            } ${collapsed ? 'justify-center' : ''}`}
            title="Toggle Reference Trials panel"
          >
            <svg className={`w-5 h-5 flex-shrink-0 transition-colors ${panelOpen ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            {!collapsed && (
              <>
                <span className="ml-2.5 flex-1 text-left">References</span>
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  {trials.length}
                </span>
              </>
            )}
            {collapsed && trials.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[8px] font-bold flex items-center justify-center">
                {trials.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Footer branding */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">ProtoHelix</p>
          <p className="text-xs text-gray-400">USDM v3.0 / ICH M11</p>
        </div>
      )}
    </aside>
  );
}
