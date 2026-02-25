import React, { useMemo, useState, useRef, useCallback } from 'react';
import useDesignStore from '../../store/useDesignStore';
import { MARKER_TYPES, MARKER_TYPE_LIST, getMarkerType } from '../../constants/markerTypes';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const EPOCH_W = 150;
const EPOCH_GAP = 56;
const ARM_H = 60;
const ARM_GAP = 10;
const HEADER_H = 54;
const LABEL_W = 140;
const PAD_X = 30;
const PAD_Y = 20;
const ELEM_H = 30;
const ELEM_GAP = 4;
const ELEM_PAD = 6;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
function codedValue(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.decode || val.code || '';
  return String(val);
}

function epochColor(type) {
  const label = codedValue(type).toUpperCase().replace(/[\s-]/g, '_');
  switch (label) {
    case 'SCREENING': return { fill: '#f3e8ff', stroke: '#a855f7', text: '#7e22ce' };
    case 'RUN_IN':    return { fill: '#e0e7ff', stroke: '#6366f1', text: '#4338ca' };
    case 'TREATMENT': return { fill: '#dbeafe', stroke: '#3b82f6', text: '#1d4ed8' };
    case 'FOLLOW_UP': return { fill: '#dcfce7', stroke: '#22c55e', text: '#15803d' };
    case 'WASHOUT':   return { fill: '#fef3c7', stroke: '#f59e0b', text: '#b45309' };
    default:          return { fill: '#f3f4f6', stroke: '#9ca3af', text: '#4b5563' };
  }
}

function isInterimEpoch(epoch) {
  return !!(epoch.isInterimAnalysis || /^IA[-\s]?\d*/i.test(epoch.name) || /interim/i.test(epoch.name));
}

// ---------------------------------------------------------------------------
// DesignCanvas
// ---------------------------------------------------------------------------
/**
 * DesignCanvas — SVG-based visual trial design schematic.
 *
 * Renders epoch columns, arm rows, study element blocks inside cells,
 * flow arrows, interactive markers (randomization, IA, decision, stratification),
 * and crossover arrows.
 *
 * Markers are driven by the shared useDesignStore and sync with Graph Builder.
 *
 * Props:
 *   dragElement      - { id, color, name } of element being dragged from palette
 *   onDragComplete   - () => void — called when drag finishes
 *   zoom             - number (default 1)
 */
export default function DesignCanvas({ dragElement, onDragComplete, zoom = 1 }) {
  const arms = useDesignStore((s) => s.arms) || [];
  const epochs = useDesignStore((s) => s.epochs) || [];
  const cells = useDesignStore((s) => s.cells) || [];
  const elements = useDesignStore((s) => s.elements) || [];
  const assignElementToCell = useDesignStore((s) => s.assignElementToCell);
  const moveElementBetweenCells = useDesignStore((s) => s.moveElementBetweenCells);
  const unassignElementFromCell = useDesignStore((s) => s.unassignElementFromCell);

  // Store-driven markers
  const markers = useDesignStore((s) => s.markers) || [];
  const addMarker = useDesignStore((s) => s.addMarker);
  const updateMarker = useDesignStore((s) => s.updateMarker);
  const removeMarker = useDesignStore((s) => s.removeMarker);

  // Flow overrides for arrow redirection
  const flowOverrides = useDesignStore((s) => s.flowOverrides) || [];
  const setFlowOverride = useDesignStore((s) => s.setFlowOverride);

  const svgRef = useRef(null);
  const [dragState, setDragState] = useState(null); // { elementId, fromCellId, x, y, color, name }
  const [hoverCellId, setHoverCellId] = useState(null);

  // Marker interaction state
  const [gutterMenu, setGutterMenu] = useState(null);     // { afterEpochId, x, y }
  const [editingMarker, setEditingMarker] = useState(null); // marker object
  const [markerEditValue, setMarkerEditValue] = useState('');

  // Sort
  const sortedEpochs = useMemo(
    () => [...epochs].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [epochs]
  );
  const sortedArms = useMemo(
    () => [...arms].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [arms]
  );

  // Element lookup
  const elementMap = useMemo(() => {
    const m = {};
    elements.forEach((el) => { m[el.id] = el; });
    return m;
  }, [elements]);

  // Epoch index lookup by ID
  const epochIndexMap = useMemo(() => {
    const m = {};
    sortedEpochs.forEach((ep, i) => { m[ep.id] = i; });
    return m;
  }, [sortedEpochs]);

  // Compute cell layout positions
  const cellLayout = useMemo(() => {
    const layout = {};
    sortedArms.forEach((arm, ai) => {
      sortedEpochs.forEach((epoch, ei) => {
        const cell = cells.find((c) => c.armId === (arm.id || arm._id) && c.epochId === (epoch.id || epoch._id));
        if (cell) {
          layout[cell.id] = {
            x: LABEL_W + PAD_X + ei * (EPOCH_W + EPOCH_GAP),
            y: HEADER_H + PAD_Y + ai * (ARM_H + ARM_GAP),
            w: EPOCH_W,
            h: ARM_H,
            armIndex: ai,
            epochIndex: ei,
          };
        }
      });
    });
    return layout;
  }, [sortedArms, sortedEpochs, cells]);

  // Canvas size
  const svgWidth = LABEL_W + PAD_X + sortedEpochs.length * (EPOCH_W + EPOCH_GAP) - (sortedEpochs.length > 0 ? EPOCH_GAP : 0) + PAD_X + 40;
  const svgHeight = HEADER_H + PAD_Y + sortedArms.length * (ARM_H + ARM_GAP) - (sortedArms.length > 0 ? ARM_GAP : 0) + PAD_Y + 30;

  // ---------------------------------------------------------------------------
  // Marker layout — compute screen positions for all store markers
  // ---------------------------------------------------------------------------
  const markerLayout = useMemo(() => {
    return markers.map((marker) => {
      const epochIdx = epochIndexMap[marker.afterEpochId];
      if (epochIdx === undefined) return null;

      // Center of the gutter between this epoch and the next
      const gutterCenterX = LABEL_W + PAD_X + epochIdx * (EPOCH_W + EPOCH_GAP) + EPOCH_W + EPOCH_GAP / 2;
      const topY = HEADER_H + PAD_Y - 10;
      const botY = HEADER_H + PAD_Y + sortedArms.length * (ARM_H + ARM_GAP) - ARM_GAP + 10;
      const midY = (topY + botY) / 2;

      const typeData = getMarkerType(marker.type);

      return {
        ...marker,
        typeData,
        cx: gutterCenterX,
        topY,
        botY,
        midY,
      };
    }).filter(Boolean);
  }, [markers, epochIndexMap, sortedArms.length]);

  // Gutter zones for click-to-add
  const gutterZones = useMemo(() => {
    if (sortedEpochs.length < 2) return [];
    return sortedEpochs.slice(0, -1).map((epoch, idx) => {
      const x = LABEL_W + PAD_X + idx * (EPOCH_W + EPOCH_GAP) + EPOCH_W;
      return {
        afterEpochId: epoch.id,
        x,
        centerX: x + EPOCH_GAP / 2,
        y: PAD_Y - 5,
        width: EPOCH_GAP,
        height: HEADER_H + sortedArms.length * (ARM_H + ARM_GAP) + 10,
      };
    });
  }, [sortedEpochs, sortedArms.length]);

  // Flow override lookup: key → toArmId
  const flowOverrideMap = useMemo(() => {
    const m = {};
    flowOverrides.forEach((fo) => { m[fo.key] = fo.toArmId; });
    return m;
  }, [flowOverrides]);

  // Click an arrow → cycle its target arm (current → next arm → next → ... → back to original)
  function handleArrowClick(e, fromArmId, fromEpochId) {
    e.stopPropagation();
    const key = `${fromArmId}__${fromEpochId}`;
    const currentToArmId = flowOverrideMap[key] || fromArmId;
    // Find current target arm index, advance to next
    const currentIdx = sortedArms.findIndex((a) => a.id === currentToArmId);
    const nextIdx = (currentIdx + 1) % sortedArms.length;
    const nextArmId = sortedArms[nextIdx].id;
    setFlowOverride(fromArmId, fromEpochId, nextArmId);
  }

  // --- Drag handlers ---
  function getSvgPoint(e) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }

  function hitTestCell(pt) {
    for (const [cellId, pos] of Object.entries(cellLayout)) {
      if (pt.x >= pos.x && pt.x <= pos.x + pos.w && pt.y >= pos.y && pt.y <= pos.y + pos.h) {
        return cellId;
      }
    }
    return null;
  }

  const handlePointerDown = useCallback((e, elementId, fromCellId, color, name) => {
    e.stopPropagation();
    e.preventDefault();
    const pt = getSvgPoint(e);
    setDragState({ elementId, fromCellId, x: pt.x, y: pt.y, color, name });
    svgRef.current?.setPointerCapture(e.pointerId);
  }, [zoom]);

  const handlePointerMove = useCallback((e) => {
    if (!dragState && !dragElement) return;
    const pt = getSvgPoint(e);
    if (dragState) {
      setDragState((prev) => prev ? { ...prev, x: pt.x, y: pt.y } : null);
    }
    const cellId = hitTestCell(pt);
    setHoverCellId(cellId);
  }, [dragState, dragElement, cellLayout, zoom]);

  const handlePointerUp = useCallback((e) => {
    const pt = getSvgPoint(e);
    const targetCellId = hitTestCell(pt);

    if (dragState && targetCellId) {
      if (dragState.fromCellId && dragState.fromCellId !== targetCellId) {
        moveElementBetweenCells(dragState.elementId, dragState.fromCellId, targetCellId);
      } else if (!dragState.fromCellId) {
        assignElementToCell(dragState.elementId, targetCellId);
      }
    }

    // Handle palette drag (from parent)
    if (!dragState && dragElement && targetCellId) {
      assignElementToCell(dragElement.id, targetCellId);
    }

    setDragState(null);
    setHoverCellId(null);
    if (onDragComplete) onDragComplete();
  }, [dragState, dragElement, cellLayout, zoom, moveElementBetweenCells, assignElementToCell, onDragComplete]);

  // Right-click to remove element from cell
  function handleContextMenu(e, elementId, cellId) {
    e.preventDefault();
    unassignElementFromCell(elementId, cellId);
  }

  // ---------------------------------------------------------------------------
  // Gutter click → open marker type picker
  // ---------------------------------------------------------------------------
  function handleGutterClick(e, afterEpochId) {
    e.stopPropagation();
    // Close any open menus first
    setEditingMarker(null);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setGutterMenu({
      afterEpochId,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function handlePickMarkerType(typeId) {
    if (!gutterMenu) return;
    const typeData = getMarkerType(typeId);
    addMarker({
      type: typeData.id,
      afterEpochId: gutterMenu.afterEpochId,
      label: typeData.shortLabel,
      ratio: typeData.id === 'randomization' ? '1:1' : '',
      description: '',
    });
    setGutterMenu(null);
  }

  // ---------------------------------------------------------------------------
  // Marker click → edit ratio/label
  // ---------------------------------------------------------------------------
  function handleMarkerClick(e, marker) {
    e.stopPropagation();
    setGutterMenu(null);
    setEditingMarker(marker);
    setMarkerEditValue(marker.ratio || marker.label || '');
  }

  function handleMarkerEditSubmit() {
    if (editingMarker) {
      updateMarker(editingMarker.id, {
        ratio: markerEditValue,
        label: markerEditValue || getMarkerType(editingMarker.type).shortLabel,
      });
    }
    setEditingMarker(null);
    setMarkerEditValue('');
  }

  function handleMarkerEditKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMarkerEditSubmit();
    } else if (e.key === 'Escape') {
      setEditingMarker(null);
      setMarkerEditValue('');
    }
  }

  // Marker right-click → delete
  function handleMarkerRightClick(e, marker) {
    e.preventDefault();
    e.stopPropagation();
    removeMarker(marker.id);
  }

  // Close popups when clicking canvas background
  function handleCanvasClick() {
    if (gutterMenu) setGutterMenu(null);
    if (editingMarker) {
      handleMarkerEditSubmit();
    }
  }

  // --- Empty state ---
  if (sortedEpochs.length === 0 && sortedArms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
          </svg>
          <p className="text-sm text-gray-500 font-medium">No trial design defined</p>
          <p className="text-xs text-gray-400 mt-1">Select a template or add arms and epochs to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto p-4 relative"
      style={{ cursor: dragState ? 'grabbing' : 'default' }}
    >
      <svg
        ref={svgRef}
        width={svgWidth * zoom}
        height={svgHeight * zoom}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="mx-auto"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleCanvasClick}
      >
        {/* ====== Layer 1: Grid background (alternating arm rows) ====== */}
        {sortedArms.map((arm, ai) => {
          const y = HEADER_H + PAD_Y + ai * (ARM_H + ARM_GAP);
          return (
            <rect
              key={`row-bg-${ai}`}
              x={LABEL_W + PAD_X}
              y={y}
              width={sortedEpochs.length * (EPOCH_W + EPOCH_GAP) - EPOCH_GAP}
              height={ARM_H}
              rx={4}
              fill={ai % 2 === 0 ? '#fafafa' : '#f5f5f5'}
              opacity={0.6}
            />
          );
        })}

        {/* ====== Layer 2: Epoch column bands ====== */}
        {sortedEpochs.map((epoch, ei) => {
          const x = LABEL_W + PAD_X + ei * (EPOCH_W + EPOCH_GAP);
          const colors = epochColor(epoch.type);
          const isInterim = isInterimEpoch(epoch);
          return (
            <rect
              key={`col-${ei}`}
              x={x}
              y={HEADER_H + PAD_Y}
              width={EPOCH_W}
              height={sortedArms.length * (ARM_H + ARM_GAP) - ARM_GAP}
              rx={4}
              fill={isInterim ? '#fefce8' : colors.fill}
              opacity={0.2}
            />
          );
        })}

        {/* ====== Layer 3: Gutter click zones (invisible — for adding markers) ====== */}
        {gutterZones.map((gz) => (
          <rect
            key={`gutter-${gz.afterEpochId}`}
            x={gz.x}
            y={gz.y}
            width={gz.width}
            height={gz.height}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={(e) => handleGutterClick(e, gz.afterEpochId)}
          >
            <title>Click to add marker</title>
          </rect>
        ))}

        {/* ====== Layer 4: Interactive flow arrows between epochs ====== */}
        {/* Arrows can be clicked to redirect — cycles through arms (straight → down → up → ...) */}
        {sortedArms.map((arm, ai) => {
          const fromY = HEADER_H + PAD_Y + ai * (ARM_H + ARM_GAP) + ARM_H / 2;
          const armId = arm.id || arm._id;
          return sortedEpochs.map((epoch, ei) => {
            if (ei === 0) return null;
            const prevEpoch = sortedEpochs[ei - 1];
            const prevEpochId = prevEpoch.id || prevEpoch._id;
            const x1 = LABEL_W + PAD_X + (ei - 1) * (EPOCH_W + EPOCH_GAP) + EPOCH_W;
            const x2 = LABEL_W + PAD_X + ei * (EPOCH_W + EPOCH_GAP);

            // Check if this arm has content in the source epoch
            const prevCell = cells.find((c) => c.armId === armId && c.epochId === prevEpochId);
            const hasPrev = prevCell && prevCell.elementIds && prevCell.elementIds.length > 0;
            if (!hasPrev) return null;

            // Determine target arm via flow override
            const overrideKey = `${armId}__${prevEpochId}`;
            const toArmId = flowOverrideMap[overrideKey] || armId;
            const toArmIdx = sortedArms.findIndex((a) => a.id === toArmId);
            const toY = HEADER_H + PAD_Y + (toArmIdx >= 0 ? toArmIdx : ai) * (ARM_H + ARM_GAP) + ARM_H / 2;
            const isRedirected = toArmId !== armId;

            // Arrow colors: gray for straight, amber for redirected
            const arrowColor = isRedirected ? '#f59e0b' : '#d1d5db';
            const arrowWidth = isRedirected ? 2 : 1.5;

            return (
              <g
                key={`arrow-${ai}-${ei}`}
                style={{ cursor: sortedArms.length > 1 ? 'pointer' : 'default' }}
                onClick={sortedArms.length > 1 ? (e) => handleArrowClick(e, armId, prevEpochId) : undefined}
              >
                {/* Invisible wider hit target */}
                <line
                  x1={x1 + 2} y1={fromY}
                  x2={x2 - 2} y2={toY}
                  stroke="transparent"
                  strokeWidth={14}
                />
                {/* Visible arrow line */}
                <line
                  x1={x1 + 2} y1={fromY}
                  x2={x2 - 8} y2={toY}
                  stroke={arrowColor}
                  strokeWidth={arrowWidth}
                  strokeDasharray={isRedirected ? '6 3' : 'none'}
                />
                {/* Arrowhead */}
                {(() => {
                  // Calculate angle for proper arrowhead rotation
                  const dx = (x2 - 8) - (x1 + 2);
                  const dy = toY - fromY;
                  const angle = Math.atan2(dy, dx);
                  const tipX = x2 - 4;
                  const tipY = toY;
                  const backLen = 7;
                  const spread = 3.5;
                  const bx = tipX - backLen * Math.cos(angle);
                  const by = tipY - backLen * Math.sin(angle);
                  const p1x = bx + spread * Math.cos(angle + Math.PI / 2);
                  const p1y = by + spread * Math.sin(angle + Math.PI / 2);
                  const p2x = bx - spread * Math.cos(angle + Math.PI / 2);
                  const p2y = by - spread * Math.sin(angle + Math.PI / 2);
                  return (
                    <polygon
                      points={`${p1x},${p1y} ${tipX},${tipY} ${p2x},${p2y}`}
                      fill={arrowColor}
                    />
                  );
                })()}
                {/* Tooltip */}
                {sortedArms.length > 1 && (
                  <title>{isRedirected ? `→ ${sortedArms[toArmIdx]?.name} (click to change)` : 'Click to redirect arrow'}</title>
                )}
              </g>
            );
          });
        })}

        {/* ====== Layer 6: Store-driven markers ====== */}
        {markerLayout.map((m) => {
          const td = m.typeData;
          const displayLabel = m.ratio || m.label || td.shortLabel;

          return (
            <g
              key={`marker-${m.id}`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleMarkerClick(e, m)}
              onContextMenu={(e) => handleMarkerRightClick(e, m)}
            >
              {/* Invisible wide hit-target so clicks anywhere in gutter go to this marker */}
              <rect
                x={m.cx - EPOCH_GAP / 2}
                y={m.topY - 20}
                width={EPOCH_GAP}
                height={m.botY - m.topY + 40}
                fill="transparent"
              />
              {/* Vertical dashed line */}
              <line
                x1={m.cx}
                y1={m.topY}
                x2={m.cx}
                y2={m.botY}
                stroke={td.color}
                strokeWidth={2}
                strokeDasharray="6 3"
              />

              {/* Shape at top */}
              {td.shape === 'circle' && (
                <>
                  <circle cx={m.cx} cy={m.topY - 6} r={11} fill={td.color} />
                  <text
                    x={m.cx}
                    y={m.topY - 2}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill="white"
                  >
                    {td.shortLabel}
                  </text>
                </>
              )}
              {td.shape === 'diamond' && (
                <>
                  <polygon
                    points={`${m.cx},${m.topY - 18} ${m.cx + 11},${m.topY - 6} ${m.cx},${m.topY + 6} ${m.cx - 11},${m.topY - 6}`}
                    fill={td.color}
                  />
                  <text
                    x={m.cx}
                    y={m.topY - 2}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight={700}
                    fill="white"
                  >
                    {td.shortLabel}
                  </text>
                </>
              )}
              {td.shape === 'hexagon' && (
                <>
                  <rect
                    x={m.cx - 11}
                    y={m.topY - 17}
                    width={22}
                    height={22}
                    rx={4}
                    fill={td.color}
                  />
                  <text
                    x={m.cx}
                    y={m.topY - 2}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="white"
                  >
                    {td.shortLabel}
                  </text>
                </>
              )}

              {/* Ratio / label text below shape */}
              {displayLabel && displayLabel !== td.shortLabel && (
                <text
                  x={m.cx}
                  y={m.topY + 14}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight={600}
                  fill={td.color}
                >
                  {displayLabel}
                </text>
              )}

              {/* Fan-out arrows for randomization (from center to each arm in next epoch) */}
              {m.type === 'randomization' && sortedArms.length > 1 && (() => {
                const nextEpochIdx = (epochIndexMap[m.afterEpochId] ?? -1) + 1;
                if (nextEpochIdx >= sortedEpochs.length) return null;
                const fanX = m.cx;
                return sortedArms.map((arm, ai) => {
                  const armCy = HEADER_H + PAD_Y + ai * (ARM_H + ARM_GAP) + ARM_H / 2;
                  return (
                    <line
                      key={`fan-${m.id}-${ai}`}
                      x1={fanX}
                      y1={m.midY}
                      x2={fanX + 6}
                      y2={armCy}
                      stroke={td.color}
                      strokeWidth={1}
                      strokeDasharray="3 2"
                      opacity={0.4}
                    />
                  );
                });
              })()}
            </g>
          );
        })}

        {/* ====== Layer 7: Epoch header boxes ====== */}
        {sortedEpochs.map((epoch, ei) => {
          const x = LABEL_W + PAD_X + ei * (EPOCH_W + EPOCH_GAP);
          const colors = epochColor(epoch.type);
          const isInterim = isInterimEpoch(epoch);
          return (
            <g key={`epoch-header-${ei}`}>
              <rect
                x={x}
                y={PAD_Y}
                width={EPOCH_W}
                height={38}
                rx={8}
                ry={8}
                fill={isInterim ? '#fef9c3' : colors.fill}
                stroke={isInterim ? '#ca8a04' : colors.stroke}
                strokeWidth={1.5}
              />
              <text
                x={x + EPOCH_W / 2}
                y={PAD_Y + 16}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={isInterim ? '#92400e' : colors.text}
              >
                {epoch.name}
              </text>
              {epoch.type && (
                <text
                  x={x + EPOCH_W / 2}
                  y={PAD_Y + 30}
                  textAnchor="middle"
                  fontSize={8}
                  fill={isInterim ? '#a16207' : colors.text}
                  opacity={0.7}
                >
                  {codedValue(epoch.type)}
                </text>
              )}
            </g>
          );
        })}

        {/* ====== Layer 8: Arm labels ====== */}
        {sortedArms.map((arm, ai) => {
          const y = HEADER_H + PAD_Y + ai * (ARM_H + ARM_GAP) + ARM_H / 2;
          return (
            <g key={`arm-label-${ai}`}>
              <text
                x={LABEL_W + PAD_X - 10}
                y={y - 3}
                textAnchor="end"
                fontSize={11}
                fontWeight={600}
                fill="#374151"
              >
                {arm.name}
              </text>
              {arm.type && (
                <text
                  x={LABEL_W + PAD_X - 10}
                  y={y + 10}
                  textAnchor="end"
                  fontSize={8}
                  fill="#9ca3af"
                >
                  {codedValue(arm.type)}
                </text>
              )}
            </g>
          );
        })}

        {/* ====== Layer 9: Cell drop zones ====== */}
        {Object.entries(cellLayout).map(([cellId, pos]) => {
          const isHover = hoverCellId === cellId && (dragState || dragElement);
          return (
            <rect
              key={`dropzone-${cellId}`}
              x={pos.x + 1}
              y={pos.y + 1}
              width={pos.w - 2}
              height={pos.h - 2}
              rx={6}
              fill={isHover ? '#e0e7ff' : 'transparent'}
              stroke={isHover ? '#6366f1' : 'transparent'}
              strokeWidth={isHover ? 2 : 0}
              strokeDasharray={isHover ? '4 2' : 'none'}
              opacity={isHover ? 0.7 : 0}
              pointerEvents="none"
            />
          );
        })}

        {/* ====== Layer 10: Element blocks inside cells ====== */}
        {cells.map((cell) => {
          const pos = cellLayout[cell.id];
          if (!pos) return null;
          const elIds = cell.elementIds || [];
          if (elIds.length === 0) return null;

          return elIds.map((elId, idx) => {
            const el = elementMap[elId];
            if (!el) return null;

            const ex = pos.x + ELEM_PAD;
            const ey = pos.y + ELEM_PAD + idx * (ELEM_H + ELEM_GAP);
            const ew = pos.w - ELEM_PAD * 2;

            return (
              <g
                key={`elem-${cell.id}-${elId}`}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => handlePointerDown(e, elId, cell.id, el.color, el.name)}
                onContextMenu={(e) => handleContextMenu(e, elId, cell.id)}
              >
                <rect
                  x={ex}
                  y={ey}
                  width={ew}
                  height={ELEM_H}
                  rx={6}
                  ry={6}
                  fill={el.color || '#6b7280'}
                  opacity={0.9}
                />
                <text
                  x={ex + ew / 2}
                  y={ey + ELEM_H / 2 + 4}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="white"
                  pointerEvents="none"
                >
                  {el.name}
                </text>
              </g>
            );
          });
        })}

        {/* ====== Layer 11: Gutter hover hints (+ icon) ====== */}
        {gutterZones.map((gz) => {
          // Don't show + if a marker already exists in this gutter
          const hasMarker = markers.some((m) => m.afterEpochId === gz.afterEpochId);
          if (hasMarker) return null;
          return (
            <g key={`gutter-hint-${gz.afterEpochId}`} opacity={0.15} pointerEvents="none">
              <circle cx={gz.centerX} cy={HEADER_H + PAD_Y - 16} r={8} fill="#6b7280" />
              <text
                x={gz.centerX}
                y={HEADER_H + PAD_Y - 12}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="white"
              >
                +
              </text>
            </g>
          );
        })}

        {/* ====== Layer 12: Drag ghost ====== */}
        {dragState && (
          <g opacity={0.7} pointerEvents="none">
            <rect
              x={dragState.x - 45}
              y={dragState.y - ELEM_H / 2}
              width={90}
              height={ELEM_H}
              rx={6}
              fill={dragState.color || '#6b7280'}
            />
            <text
              x={dragState.x}
              y={dragState.y + 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="white"
            >
              {dragState.name}
            </text>
          </g>
        )}
      </svg>

      {/* ====== HTML overlay: Gutter marker type picker ====== */}
      {gutterMenu && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-[180px]"
          style={{ left: gutterMenu.x - 90, top: gutterMenu.y + 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 pb-1 mb-1 border-b border-gray-100">
            Add Marker
          </p>
          {MARKER_TYPE_LIST.map((mt) => (
            <button
              key={mt.id}
              onClick={() => handlePickMarkerType(mt.id)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              {mt.shape === 'circle' && (
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-black flex-shrink-0"
                  style={{ backgroundColor: mt.color }}
                >
                  {mt.shortLabel}
                </span>
              )}
              {mt.shape === 'diamond' && (
                <span
                  className="w-5 h-5 flex items-center justify-center text-white text-[7px] font-black flex-shrink-0"
                  style={{ backgroundColor: mt.color, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
                >
                  {mt.shortLabel}
                </span>
              )}
              {mt.shape === 'hexagon' && (
                <span
                  className="w-5 h-5 rounded-sm flex items-center justify-center text-white text-[8px] font-black flex-shrink-0"
                  style={{ backgroundColor: mt.color }}
                >
                  {mt.shortLabel}
                </span>
              )}
              <div>
                <span className="text-xs font-medium text-gray-700">{mt.fullLabel}</span>
                <p className="text-[9px] text-gray-400 leading-tight">{mt.description}</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => setGutterMenu(null)}
            className="w-full mt-1 pt-1 border-t border-gray-100 text-[10px] text-gray-400 hover:text-gray-600 text-center py-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ====== HTML overlay: Marker edit popover ====== */}
      {editingMarker && (() => {
        const layout = markerLayout.find((m) => m.id === editingMarker.id);
        if (!layout) return null;
        const td = layout.typeData;
        // Position near the marker
        const popLeft = layout.cx * zoom - 80;
        const popTop = (layout.topY + 30) * zoom;
        return (
          <div
            className="absolute z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[180px]"
            style={{ left: popLeft, top: popTop }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-black"
                style={{ backgroundColor: td.color }}
              >
                {td.shortLabel}
              </span>
              <span className="text-xs font-semibold text-gray-700">{td.fullLabel}</span>
            </div>
            <label className="text-[10px] text-gray-500 mb-1 block">
              {editingMarker.type === 'randomization' ? 'Ratio (e.g. 1:1, 1:1:1, 2:1)' : 'Label / Description'}
            </label>
            <input
              autoFocus
              type="text"
              value={markerEditValue}
              onChange={(e) => setMarkerEditValue(e.target.value)}
              onKeyDown={handleMarkerEditKeyDown}
              onBlur={handleMarkerEditSubmit}
              placeholder={editingMarker.type === 'randomization' ? '1:1' : 'Label...'}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); removeMarker(editingMarker.id); setEditingMarker(null); }}
                className="text-[10px] text-red-500 hover:text-red-700 font-medium"
              >
                Delete
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleMarkerEditSubmit(); }}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Done
              </button>
            </div>
          </div>
        );
      })()}

      {/* ====== Bottom legend ====== */}
      {markerLayout.length > 0 && (
        <div className="mt-2 px-2 flex items-center gap-3 flex-wrap text-[10px] text-gray-500">
          <span className="font-semibold text-gray-600 uppercase tracking-wide">Markers:</span>
          {markerLayout.map((m) => (
            <span key={m.id} className="flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: m.typeData.color }}
              />
              <span>{m.typeData.fullLabel}{m.ratio ? ` (${m.ratio})` : ''}</span>
            </span>
          ))}
          <span className="text-gray-400 ml-auto">
            Click between epochs to add marker · Click marker to edit · Right-click to delete · Click arrows to redirect
          </span>
        </div>
      )}
    </div>
  );
}
