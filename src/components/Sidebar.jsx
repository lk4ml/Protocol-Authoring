import React from 'react';

export default function Sidebar({ collapsed, onToggleCollapse, activeModule, onModuleChange, navItems, protocol }) {
  return (
    <aside
      className={`bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col h-screen sticky top-0 transition-all duration-300 shadow-2xl`}
      style={{ width: collapsed ? '80px' : '288px' }}
    >
      <div className={`p-4 flex items-center border-b border-slate-700/50 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl font-bold text-white">P</span>
            </div>
            <div>
              <div className="font-semibold text-white">Protocol Platform</div>
              <div className="text-xs text-blue-400">USDM v4.0 • DDF Ready</div>
            </div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>
      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-700/50">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current Protocol</div>
          <div className="font-medium text-white truncate">{protocol.protocolNumber}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">{protocol.phase}</span>
            <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">{protocol.status}</span>
          </div>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <div className="space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                activeModule === item.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                  {item.badge !== null && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        activeModule === item.id
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </nav>
      {!collapsed && (
        <div className="p-4 border-t border-slate-700/50">
          <div className="p-3 bg-slate-800/50 rounded-xl">
            <div className="text-xs text-slate-500 mb-2">Data Standards</div>
            <div className="flex flex-wrap gap-1">
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">USDM</span>
              <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">CDASH</span>
              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">SDTM</span>
              <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs">ODM</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

