import React, { useState, useRef, useCallback } from 'react';
import useDesignStore from '../../store/useDesignStore';
import useTerminologyStore from '../../store/useTerminologyStore';
import DesignCanvas from '../design/DesignCanvas';
import ElementPalette from '../design/ElementPalette';
import DesignTemplates from '../design/DesignTemplates';
import DesignToolbar from '../design/DesignToolbar';
import GraphDesigner from '../design/GraphDesigner';
import ReferenceToggleButton from '../reference/ReferenceToggleButton';

/**
 * Extract a plain string from a value that may be either a string or a
 * CDISC coded object like {code: "C12345", decode: "Parallel", codeSystem: "..."}.
 */
function codedValue(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.decode || val.code || '';
  return String(val);
}

/* =========================================================================
 * ScratchBuilder — Visual drag-and-drop builder for creating from scratch
 *
 * Shows a visual workspace with:
 *   • Pre-made epoch boxes that can be dragged into the timeline
 *   • Pre-made arm type blocks
 *   • Pre-made element blocks
 * ========================================================================= */
function ScratchBuilder({ onClose }) {
  const addArm = useDesignStore((s) => s.addArm);
  const addEpoch = useDesignStore((s) => s.addEpoch);
  const addElement = useDesignStore((s) => s.addElement);
  const arms = useDesignStore((s) => s.arms) || [];
  const epochs = useDesignStore((s) => s.epochs) || [];
  const elements = useDesignStore((s) => s.elements) || [];

  // Predefined building blocks
  const EPOCH_BLOCKS = [
    { name: 'Screening', type: 'Screening', color: '#a855f7' },
    { name: 'Run-in', type: 'Run-in', color: '#6366f1' },
    { name: 'Treatment', type: 'Treatment', color: '#3b82f6' },
    { name: 'Washout', type: 'Washout', color: '#f59e0b' },
    { name: 'Follow-up', type: 'Follow-up', color: '#22c55e' },
    { name: 'Maintenance', type: 'Treatment', color: '#06b6d4' },
  ];

  const ARM_BLOCKS = [
    { name: 'Experimental Arm', type: 'Experimental Arm', color: '#4f46e5' },
    { name: 'Placebo Control', type: 'Placebo Comparator Arm', color: '#9ca3af' },
    { name: 'Active Comparator', type: 'Active Comparator Arm', color: '#0891b2' },
    { name: 'No Intervention', type: 'No Intervention Arm', color: '#d97706' },
  ];

  const ELEMENT_BLOCKS = [
    { name: 'Drug A', color: '#4f46e5', description: 'Active treatment' },
    { name: 'Drug B', color: '#7c3aed', description: 'Second treatment' },
    { name: 'Placebo', color: '#9ca3af', description: 'Placebo control' },
    { name: 'Washout', color: '#f59e0b', description: 'Washout period' },
    { name: 'Screening Procedures', color: '#a855f7', description: 'Screening assessments' },
    { name: 'Follow-up Assessments', color: '#22c55e', description: 'Follow-up visits' },
  ];

  function handleAddEpoch(block) {
    addEpoch({ name: block.name, type: block.type, order: epochs.length + 1 });
  }

  function handleAddArm(block) {
    addArm({ name: block.name, type: block.type, order: arms.length + 1 });
  }

  function handleAddElement(block) {
    // Check if element with same name already exists
    if (elements.find((el) => el.name === block.name)) return;
    addElement({ name: block.name, color: block.color, description: block.description || '' });
  }

  const hasContent = arms.length > 0 || epochs.length > 0 || elements.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Build Your Trial Design
          </h3>
          <p className="text-indigo-200 text-xs mt-0.5">
            Click the blocks below to add them to your design. Then drag elements into cells on the schema.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-white/80 hover:text-white font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          ← Back to Templates
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Row 1: Epochs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
              <h4 className="text-sm font-semibold text-gray-800">Add Study Epochs</h4>
              <span className="text-[10px] text-gray-400">(study periods/phases)</span>
            </div>
            {epochs.length > 0 && (
              <span className="text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                {epochs.length} added
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {EPOCH_BLOCKS.map((block) => (
              <button
                key={block.name}
                onClick={() => handleAddEpoch(block)}
                className="group flex items-center px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <span
                  className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: block.color }}
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 transition-colors">
                  {block.name}
                </span>
                <svg className="w-4 h-4 ml-2 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Arms */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
              <h4 className="text-sm font-semibold text-gray-800">Add Study Arms</h4>
              <span className="text-[10px] text-gray-400">(treatment groups)</span>
            </div>
            {arms.length > 0 && (
              <span className="text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                {arms.length} added
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {ARM_BLOCKS.map((block) => (
              <button
                key={block.name}
                onClick={() => handleAddArm(block)}
                className="group flex items-center px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition-all"
              >
                <span
                  className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: block.color }}
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700 transition-colors">
                  {block.name}
                </span>
                <svg className="w-4 h-4 ml-2 text-gray-300 group-hover:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Elements */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
              <h4 className="text-sm font-semibold text-gray-800">Add Study Elements</h4>
              <span className="text-[10px] text-gray-400">(interventions & activities)</span>
            </div>
            {elements.length > 0 && (
              <span className="text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                {elements.length} added
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {ELEMENT_BLOCKS.map((block) => {
              const alreadyAdded = elements.find((el) => el.name === block.name);
              return (
                <button
                  key={block.name}
                  onClick={() => handleAddElement(block)}
                  disabled={!!alreadyAdded}
                  className={`group flex items-center px-4 py-2.5 rounded-xl border-2 border-dashed transition-all ${
                    alreadyAdded
                      ? 'border-green-300 bg-green-50 cursor-default'
                      : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: block.color }}
                  />
                  <span className={`text-sm font-medium transition-colors ${
                    alreadyAdded ? 'text-green-700' : 'text-gray-700 group-hover:text-emerald-700'
                  }`}>
                    {block.name}
                  </span>
                  {alreadyAdded ? (
                    <svg className="w-4 h-4 ml-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 ml-2 text-gray-300 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress indicator */}
        {hasContent && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>{epochs.length} Epochs</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>{arms.length} Arms</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{elements.length} Elements</span>
                </span>
              </div>
              <p className="text-xs text-indigo-600 font-medium">
                ↓ See the visual schema below — drag elements into cells
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* =========================================================================
 * ArmsEpochsGrid - Matrix table of arms x epochs with cell elements
 * ========================================================================= */
function ArmsEpochsGrid() {
  const arms = useDesignStore((s) => s.arms) || [];
  const epochs = useDesignStore((s) => s.epochs) || [];
  const cells = useDesignStore((s) => s.cells) || [];
  const elements = useDesignStore((s) => s.elements) || [];
  const addArm = useDesignStore((s) => s.addArm);
  const removeArm = useDesignStore((s) => s.removeArm);
  const updateArm = useDesignStore((s) => s.updateArm);
  const addEpoch = useDesignStore((s) => s.addEpoch);
  const removeEpoch = useDesignStore((s) => s.removeEpoch);
  const updateEpoch = useDesignStore((s) => s.updateEpoch);
  const armTypes = useTerminologyStore((s) => s.armTypes) || [];
  const epochTypes = useTerminologyStore((s) => s.epochTypes) || [];

  const [showArmForm, setShowArmForm] = useState(false);
  const [showEpochForm, setShowEpochForm] = useState(false);
  const [armForm, setArmForm] = useState({ name: '', type: '', description: '' });
  const [epochForm, setEpochForm] = useState({ name: '', type: '' });
  const [editingArm, setEditingArm] = useState(null);
  const [editingEpoch, setEditingEpoch] = useState(null);

  const sortedEpochs = [...epochs].sort((a, b) => (a.order || 0) - (b.order || 0));
  const sortedArms = [...arms].sort((a, b) => (a.order || 0) - (b.order || 0));

  function getCellElements(armId, epochId) {
    const cell = cells.find((c) => c.armId === armId && c.epochId === epochId);
    if (!cell || !cell.elementIds) return [];
    return cell.elementIds
      .map((eid) => elements.find((el) => el.id === eid || el._id === eid))
      .filter(Boolean);
  }

  function handleAddArm(e) {
    e.preventDefault();
    if (!armForm.name.trim()) return;
    addArm({ ...armForm, order: arms.length + 1 });
    setArmForm({ name: '', type: '', description: '' });
    setShowArmForm(false);
  }

  function handleAddEpoch(e) {
    e.preventDefault();
    if (!epochForm.name.trim()) return;
    addEpoch({ ...epochForm, order: epochs.length + 1 });
    setEpochForm({ name: '', type: '' });
    setShowEpochForm(false);
  }

  function handleArmNameEdit(arm, newName) {
    updateArm(arm.id || arm._id, { name: newName });
    setEditingArm(null);
  }

  function handleEpochNameEdit(epoch, newName) {
    updateEpoch(epoch.id || epoch._id, { name: newName });
    setEditingEpoch(null);
  }

  function epochTypeColor(type) {
    const label = codedValue(type).toUpperCase().replace(/[\s-]/g, '_');
    switch (label) {
      case 'SCREENING': return 'bg-purple-100 text-purple-800';
      case 'RUN_IN': return 'bg-indigo-100 text-indigo-800';
      case 'TREATMENT': return 'bg-blue-100 text-blue-800';
      case 'FOLLOW_UP': return 'bg-green-100 text-green-800';
      case 'WASHOUT': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Arms & Epochs Grid
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowArmForm(!showArmForm)}
            className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Arm
          </button>
          <button
            onClick={() => setShowEpochForm(!showEpochForm)}
            className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Epoch
          </button>
        </div>
      </div>

      {/* Inline forms */}
      {showArmForm && (
        <div className="px-6 py-4 border-b border-gray-100 bg-indigo-50">
          <form onSubmit={handleAddArm} className="flex items-end space-x-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Arm Name</label>
              <input
                type="text"
                value={armForm.name}
                onChange={(e) => setArmForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Treatment Arm A"
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={armForm.type}
                onChange={(e) => setArmForm((p) => ({ ...p, type: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="">Select type...</option>
                {(armTypes.length > 0 ? armTypes : [
                  { code: 'C174267', decode: 'Experimental Arm' },
                  { code: 'C174265', decode: 'Active Comparator Arm' },
                  { code: 'C174266', decode: 'Placebo Comparator Arm' },
                  { code: 'C174268', decode: 'No Intervention Arm' },
                  { code: 'C174269', decode: 'Sham Comparator Arm' },
                ]).map((at) => (
                  <option key={at.code} value={at.decode || at.label || at.code}>{at.decode || at.label || at.code}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={armForm.description}
                onChange={(e) => setArmForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowArmForm(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {showEpochForm && (
        <div className="px-6 py-4 border-b border-gray-100 bg-indigo-50">
          <form onSubmit={handleAddEpoch} className="flex items-end space-x-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Epoch Name</label>
              <input
                type="text"
                value={epochForm.name}
                onChange={(e) => setEpochForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Screening"
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={epochForm.type}
                onChange={(e) => setEpochForm((p) => ({ ...p, type: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="">Select type...</option>
                {(epochTypes.length > 0 ? epochTypes : [
                  { code: 'C98779', decode: 'Screening' },
                  { code: 'C101527', decode: 'Run-in' },
                  { code: 'C101526', decode: 'Treatment' },
                  { code: 'C99158', decode: 'Follow-up' },
                  { code: 'C99156', decode: 'Washout' },
                ]).map((et) => (
                  <option key={et.code} value={et.decode || et.label || et.code}>{et.decode || et.label || et.code}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowEpochForm(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Grid table */}
      <div className="overflow-x-auto">
        {sortedEpochs.length === 0 && sortedArms.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
            </svg>
            <p className="text-sm text-gray-500">No arms or epochs defined yet.</p>
            <p className="text-xs text-gray-400 mt-1">Add arms and epochs above, or select a template to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-r border-gray-200 w-48">
                  Arm / Epoch
                </th>
                {sortedEpochs.map((epoch) => {
                  const epochId = epoch.id || epoch._id;
                  return (
                    <th
                      key={epochId}
                      className="px-4 py-3 text-center text-xs font-semibold text-gray-700 border-b border-r border-gray-200 min-w-[140px]"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        {editingEpoch === epochId ? (
                          <input
                            type="text"
                            defaultValue={epoch.name}
                            autoFocus
                            onBlur={(e) => handleEpochNameEdit(epoch, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEpochNameEdit(epoch, e.target.value);
                              if (e.key === 'Escape') setEditingEpoch(null);
                            }}
                            className="px-1.5 py-0.5 border border-indigo-300 rounded text-xs text-center w-24 focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:text-indigo-600 transition-colors"
                            onClick={() => setEditingEpoch(epochId)}
                            title="Click to edit"
                          >
                            {epoch.name}
                          </span>
                        )}
                        <button
                          onClick={() => removeEpoch(epochId)}
                          className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                          title="Remove epoch"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {epoch.type && (
                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${epochTypeColor(epoch.type)}`}>
                          {codedValue(epoch.type)}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedArms.map((arm) => {
                const armId = arm.id || arm._id;
                return (
                  <tr key={armId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 border-b border-r border-gray-200 font-medium text-gray-900">
                      <div className="flex items-center justify-between">
                        {editingArm === armId ? (
                          <input
                            type="text"
                            defaultValue={arm.name}
                            autoFocus
                            onBlur={(e) => handleArmNameEdit(arm, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleArmNameEdit(arm, e.target.value);
                              if (e.key === 'Escape') setEditingArm(null);
                            }}
                            className="px-1.5 py-0.5 border border-indigo-300 rounded text-xs w-32 focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:text-indigo-600 transition-colors text-xs"
                            onClick={() => setEditingArm(armId)}
                            title="Click to edit"
                          >
                            {arm.name}
                          </span>
                        )}
                        <button
                          onClick={() => removeArm(armId)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove arm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {arm.type && (
                        <span className="text-[10px] text-gray-400 block mt-0.5">{codedValue(arm.type)}</span>
                      )}
                    </td>
                    {sortedEpochs.map((epoch) => {
                      const epochId = epoch.id || epoch._id;
                      const cellElements = getCellElements(armId, epochId);
                      return (
                        <td
                          key={epochId}
                          className="px-3 py-3 border-b border-r border-gray-200 text-center align-middle"
                        >
                          {cellElements.length > 0 ? (
                            <div className="space-y-1">
                              {cellElements.map((el) => (
                                <span
                                  key={el.id || el._id}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-white"
                                  style={{ backgroundColor: el.color || '#6366f1' }}
                                >
                                  {el.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300">--</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
 * StudyDesignModule - Main study design editor
 * ========================================================================= */
export default function StudyDesignModule() {
  const arms = useDesignStore((s) => s.arms) || [];
  const epochs = useDesignStore((s) => s.epochs) || [];

  // Visual schematic state
  const [zoom, setZoom] = useState(1);
  const [showTemplates, setShowTemplates] = useState(false);
  const [dragElement, setDragElement] = useState(null);
  const containerRef = useRef(null);

  const [scratchMode, setScratchMode] = useState(false);
  const [viewMode, setViewMode] = useState('schema'); // 'schema' | 'graph'

  const handleFitToView = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 280; // subtract palette width
    const epochCount = epochs.length || 1;
    const canvasWidth = 140 + 30 + epochCount * (150 + 56) - 56 + 30 + 40;
    const newZoom = Math.min(1.5, Math.max(0.5, containerWidth / canvasWidth));
    setZoom(Math.round(newZoom * 10) / 10);
  }, [epochs.length]);

  // Palette drag handlers
  const handlePaletteDragStart = useCallback((elementId, element) => {
    setDragElement({ id: elementId, color: element.color, name: element.name });
  }, []);

  const handleDragComplete = useCallback(() => {
    setDragElement(null);
  }, []);

  const isEmpty = arms.length === 0 && epochs.length === 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Study Design</h2>
          <p className="text-sm text-gray-500 mt-1">
            Define intervention model, blinding, arms, epochs, and study elements
          </p>
        </div>
        <ReferenceToggleButton context="design" />
      </div>

      {/* Build Your Trial Design — always visible while in scratch/build mode */}
      {scratchMode && (
        <ScratchBuilder onClose={() => setScratchMode(false)} />
      )}

      {/* Template picker when design is empty and NOT in scratch mode */}
      {isEmpty && !scratchMode && (
        <DesignTemplates onClose={() => setScratchMode(true)} />
      )}

      {/* Template picker overlay when triggered from toolbar */}
      {showTemplates && (
        <DesignTemplates onClose={() => setShowTemplates(false)} isOverlay />
      )}

      {/* Section B: Arms & Epochs Grid */}
      <ArmsEpochsGrid />

      {/* ── View Mode Toggle ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Visual Trial Schema
        </h3>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          <button
            onClick={() => setViewMode('schema')}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'schema'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
            </svg>
            Schema View
          </button>
          <button
            onClick={() => setViewMode('graph')}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'graph'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Graph Builder
          </button>
        </div>
      </div>

      {/* Section C: Visual Trial Schema — Schema View */}
      {viewMode === 'schema' && (
        <>
          <div
            ref={containerRef}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <DesignToolbar
              zoom={zoom}
              onZoomChange={setZoom}
              onFitToView={handleFitToView}
              onShowTemplates={() => setShowTemplates(true)}
            />
            <div className="flex" style={{ minHeight: 300 }}>
              <DesignCanvas
                dragElement={dragElement}
                onDragComplete={handleDragComplete}
                zoom={zoom}
              />
              <ElementPalette
                onDragStart={handlePaletteDragStart}
                onDragEnd={handleDragComplete}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
              <span className="font-semibold text-gray-700 uppercase tracking-wide text-[10px]">Legend:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-400" />
                Screening
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-400" />
                Treatment
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-400" />
                Follow-up
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                Washout
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 flex items-center justify-center bg-red-500 text-white rounded-full text-[8px] font-bold">R</span>
                Randomization
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 flex items-center justify-center bg-purple-600 text-white text-[7px] font-bold" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>IA</span>
                Interim Analysis
              </span>
              <span className="text-gray-400 ml-2">
                Right-click element blocks to remove from cell
              </span>
            </div>
          </div>
        </>
      )}

      {/* Section C: Visual Trial Schema — Graph Builder View */}
      {viewMode === 'graph' && (
        <GraphDesigner />
      )}
    </div>
  );
}
