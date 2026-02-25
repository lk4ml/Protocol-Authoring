import React from 'react';

export default function ExportStatusToast({ status, onClose }) {
  const statusConfig = {
    success: { bg: 'bg-green-600', text: '✓ Export successful!' },
    error: { bg: 'bg-red-600', text: '✗ Export failed' },
    exporting: { bg: 'bg-blue-600', text: '⟳ Exporting...' }
  };

  const config = statusConfig[status] || statusConfig.exporting;

  return (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${config.bg} text-white`}>
      {status === 'exporting' && <span className="animate-spin">⟳</span>}
      <span>{config.text}</span>
      {status !== 'exporting' && (
        <button onClick={onClose} className="ml-2 hover:opacity-80">×</button>
      )}
    </div>
  );
}

