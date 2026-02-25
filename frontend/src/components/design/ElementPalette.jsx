import React, { useState } from 'react';
import useDesignStore from '../../store/useDesignStore';

/**
 * Color presets for study elements.
 * Each has a hex fill, a lighter bg for badges, and a text color.
 */
const COLOR_PRESETS = [
  { hex: '#4f46e5', label: 'Indigo' },
  { hex: '#dc2626', label: 'Red' },
  { hex: '#16a34a', label: 'Green' },
  { hex: '#d97706', label: 'Amber' },
  { hex: '#7c3aed', label: 'Purple' },
  { hex: '#0891b2', label: 'Cyan' },
  { hex: '#9ca3af', label: 'Gray' },
  { hex: '#be185d', label: 'Pink' },
];

/**
 * ElementPalette — Side panel for creating and managing study elements.
 *
 * Study elements are the treatment/intervention building blocks that get
 * assigned to cells in the design grid (e.g., "Drug A", "Placebo",
 * "Washout", "Screening assessments").
 *
 * Props:
 *   onDragStart(elementId, element) — Called when user starts dragging an element chip.
 *                                      Parent uses this to enable drop zones on the canvas.
 */
export default function ElementPalette({ onDragStart, onDragEnd }) {
  const elements = useDesignStore((s) => s.elements) || [];
  const addElement = useDesignStore((s) => s.addElement);
  const removeElement = useDesignStore((s) => s.removeElement);
  const updateElement = useDesignStore((s) => s.updateElement);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', color: COLOR_PRESETS[0].hex, description: '' });
  const [editingId, setEditingId] = useState(null);

  function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    addElement({ name: form.name.trim(), color: form.color, description: form.description.trim() });
    setForm({ name: '', color: COLOR_PRESETS[0].hex, description: '' });
    setShowForm(false);
  }

  function handleDelete(elementId) {
    removeElement(elementId);
  }

  function handleRename(elementId, newName) {
    if (newName.trim()) {
      updateElement(elementId, { name: newName.trim() });
    }
    setEditingId(null);
  }

  function handlePointerDown(e, element) {
    if (onDragStart) {
      onDragStart(element.id, element);
    }
  }

  return (
    <div className="w-72 border-l border-gray-200 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Study Elements
          </h4>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Drag elements to assign to cells
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          title="Add element"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      {/* Add Element Form */}
      {showForm && (
        <div className="px-4 py-3 border-b border-gray-200 bg-indigo-50">
          <form onSubmit={handleAdd} className="space-y-2">
            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Drug A, Placebo"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Color</label>
              <div className="flex space-x-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, color: c.hex }))}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      form.color === c.hex ? 'border-gray-800 scale-110' : 'border-transparent hover:border-gray-300'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors"
              >
                Add Element
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Element List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {elements.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-xs text-gray-400">No elements defined.</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Click + to create study elements.</p>
          </div>
        ) : (
          elements.map((el) => (
            <div
              key={el.id}
              className="group flex items-center space-x-2 px-2.5 py-2 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all"
              onPointerDown={(e) => handlePointerDown(e, el)}
              title="Drag to assign to a cell"
            >
              {/* Color dot */}
              <span
                className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-2 ring-white"
                style={{ backgroundColor: el.color || '#6b7280' }}
              />

              {/* Name (editable) */}
              <div className="flex-1 min-w-0">
                {editingId === el.id ? (
                  <input
                    type="text"
                    defaultValue={el.name}
                    autoFocus
                    onBlur={(e) => handleRename(el.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(el.id, e.target.value);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-full px-1 py-0.5 border border-indigo-300 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="text-xs font-medium text-gray-800 truncate block cursor-pointer hover:text-indigo-600"
                    onClick={(e) => { e.stopPropagation(); setEditingId(el.id); }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {el.name}
                  </span>
                )}
                {el.description && (
                  <span className="text-[10px] text-gray-400 truncate block">{el.description}</span>
                )}
              </div>

              {/* Drag handle + delete */}
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                </svg>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(el.id); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Remove element"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
