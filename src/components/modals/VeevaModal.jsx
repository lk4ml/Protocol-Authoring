import React, { useState } from 'react';
import VeevaEDCService from '../../services/veevaEDCService';

export default function VeevaModal({ protocol, usdm, onExport, onCancel }) {
  const [config, setConfig] = useState({ vaultDomain: '', username: '', password: '' });
  const [status, setStatus] = useState('idle');

  const handleExport = async (e) => {
    e.preventDefault();
    setStatus('connecting');
    try {
      const veevaService = new VeevaEDCService(config);
      const result = await veevaService.createStudy(usdm, protocol);
      setStatus('idle');
      onExport(result);
    } catch (error) {
      console.error('Veeva export error:', error);
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Export to Veeva Vault CDMS</h3>
        <p className="text-sm text-slate-500 mb-6">
          Configure connection to push study configuration directly to Veeva EDC
        </p>
        <form onSubmit={handleExport} className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-xl">⚠️</span>
              <div>
                <div className="font-medium text-amber-800">Veeva Vault Connection Required</div>
                <p className="text-sm text-amber-700 mt-1">
                  You need valid Veeva Vault CDMS credentials with API access.
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vault Domain</label>
            <input
              type="text"
              value={config.vaultDomain}
              onChange={e => setConfig(c => ({ ...c, vaultDomain: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="my-vault.veevavault.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={config.username}
                onChange={e => setConfig(c => ({ ...c, username: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={config.password}
                onChange={e => setConfig(c => ({ ...c, password: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="text-sm font-medium text-slate-700 mb-2">What will be created:</div>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Study: {protocol.protocolNumber}</li>
              <li>• Visits: {protocol.visits.length} study events</li>
              <li>• Forms: {[...new Set(protocol.activities.map(a => a.formType))].length} CRF forms</li>
              <li>• Fields: {protocol.activities.reduce((acc, a) => acc + (a.bcIds?.length || 0), 0)} BC mappings</li>
            </ul>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === 'connecting' || status === 'creating'}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
            >
              {status === 'connecting' && <><span className="animate-spin">⟳</span> Connecting...</>}
              {status === 'creating' && <><span className="animate-spin">⟳</span> Creating Study...</>}
              {status === 'idle' && <>🏢 Push to Veeva</>}
              {status === 'error' && <>✗ Error</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

