import React, { useState, useRef, useCallback, useMemo } from 'react';
import useDesignStore from '../../store/useDesignStore';
import { MARKER_TYPES, getMarkerType } from '../../constants/markerTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LANE_MIN_W = 280;
const LANE_GAP = 12;
const LANE_PAD = 24;
const NODE_W = 140;
const NODE_H = 38;
const NODE_GAP_Y = 16;
const PORT_R = 7;
const HEADER_H = 46;
const TOP_PAD = 20;
const DELETE_R = 8;

// Marker dimensions
const MARKER_GAP = 60; // width of the gutter between lanes for markers
const RAND_R = 20;     // Randomization circle radius
const IA_SIZE = 22;    // Interim analysis diamond half-size
const DECISION_W = 110;
const DECISION_H = 32;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function codedValue(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.decode || val.code || '';
  return String(val);
}

function epochLaneColor(type) {
  const t = codedValue(type).toUpperCase().replace(/[\s-]/g, '_');
  switch (t) {
    case 'SCREENING': return { bg: '#f3e8ff', border: '#d8b4fe', headerBg: '#ede9fe', headerText: '#7e22ce' };
    case 'RUN_IN':    return { bg: '#e0e7ff', border: '#a5b4fc', headerBg: '#e0e7ff', headerText: '#4338ca' };
    case 'TREATMENT': return { bg: '#dbeafe', border: '#93c5fd', headerBg: '#dbeafe', headerText: '#1d4ed8' };
    case 'FOLLOW_UP': return { bg: '#dcfce7', border: '#86efac', headerBg: '#dcfce7', headerText: '#15803d' };
    case 'WASHOUT':   return { bg: '#fef3c7', border: '#fcd34d', headerBg: '#fef9c3', headerText: '#92400e' };
    default:          return { bg: '#f1f5f9', border: '#cbd5e1', headerBg: '#f1f5f9', headerText: '#475569' };
  }
}

const ELEMENT_PRESETS = [
  { name: 'Screen', color: '#0d9488', description: 'Screening procedures' },
  { name: 'Placebo', color: '#7c3aed', description: 'Placebo control' },
  { name: 'Drug A', color: '#dc2626', description: 'Active treatment A' },
  { name: 'Drug B', color: '#dc2626', description: 'Active treatment B' },
  { name: '5 mg', color: '#dc2626', description: '5 mg dose' },
  { name: '10 mg', color: '#b91c1c', description: '10 mg dose' },
  { name: 'Rest', color: '#16a34a', description: 'Rest / Recovery period' },
  { name: 'Follow', color: '#be185d', description: 'Follow-up assessments' },
];

const EPOCH_PRESETS = [
  { name: 'Screening', type: 'Screening' },
  { name: 'Treatment', type: 'Treatment' },
  { name: 'Washout', type: 'Washout' },
  { name: 'Follow-up', type: 'Follow-up' },
];

// MARKER_TYPES imported from shared constants/markerTypes.js

// ---------------------------------------------------------------------------
// GraphDesigner — Node-graph visual builder with:
//   • Epoch swim lanes
//   • Draggable element chips from toolbar → drop into lanes
//   • Right-click node → inline edit name/dosage
//   • × button on each node to delete
//   • Port-to-port manual connections (drag right port → left port)
//   • Auto connections (arm flow across lanes)
//   • ★ Randomization markers (red R circles) placed between lanes
//   • ★ Interim analysis markers (purple IA diamonds)
//   • ★ Decision point markers (amber D hexagons)
//   • ★ Stratification markers (cyan S circles)
// ---------------------------------------------------------------------------
export default function GraphDesigner() {
  const arms = useDesignStore((s) => s.arms) || [];
  const epochs = useDesignStore((s) => s.epochs) || [];
  const cells = useDesignStore((s) => s.cells) || [];
  const elements = useDesignStore((s) => s.elements) || [];
  const markers = useDesignStore((s) => s.markers) || [];
  const addEpoch = useDesignStore((s) => s.addEpoch);
  const addElement = useDesignStore((s) => s.addElement);
  const updateElement = useDesignStore((s) => s.updateElement);
  const assignElementToCell = useDesignStore((s) => s.assignElementToCell);
  const unassignElementFromCell = useDesignStore((s) => s.unassignElementFromCell);
  const addMarker = useDesignStore((s) => s.addMarker);
  const updateMarker = useDesignStore((s) => s.updateMarker);
  const removeMarker = useDesignStore((s) => s.removeMarker);

  const svgRef = useRef(null);
  const [paletteDrag, setPaletteDrag] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [showEpochMenu, setShowEpochMenu] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [customConns, setCustomConns] = useState([]);
  const [hoveredPort, setHoveredPort] = useState(null);
  const editInputRef = useRef(null);

  // Transient UI state for marker interactions (not persisted)
  const [markerDrag, setMarkerDrag] = useState(null); // { type, x, y }
  const [editingMarker, setEditingMarker] = useState(null);
  const [markerEditValue, setMarkerEditValue] = useState('');
  const markerEditRef = useRef(null);
  const [showMarkerMenu, setShowMarkerMenu] = useState(false);

  const sortedEpochs = useMemo(
    () => [...epochs].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [epochs]
  );
  const sortedArms = useMemo(
    () => [...arms].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [arms]
  );

  // ── Layout computation ────────────────────────────────────────────────
  const layout = useMemo(() => {
    const lanes = [];
    const gutters = []; // spaces between lanes where markers live
    let xOffset = LANE_PAD;

    sortedEpochs.forEach((epoch, epochIdx) => {
      const epochId = epoch.id || epoch._id;

      // Check if there's a marker before this lane (gutter)
      const prevEpoch = epochIdx > 0 ? sortedEpochs[epochIdx - 1] : null;
      const prevEpochId = prevEpoch ? (prevEpoch.id || prevEpoch._id) : null;
      const gutterMarkers = markers.filter(
        (m) => m.afterEpochId === prevEpochId
      );
      const hasGutterMarkers = gutterMarkers.length > 0 || epochIdx > 0;

      // Add gutter space for markers between lanes
      if (epochIdx > 0) {
        const gutterX = xOffset;
        const gutterW = gutterMarkers.length > 0 ? MARKER_GAP : LANE_GAP;
        gutters.push({
          afterEpochIdx: epochIdx - 1,
          x: gutterX,
          w: gutterW,
          markers: gutterMarkers,
        });
        xOffset += gutterW;
      }

      const nodes = [];
      sortedArms.forEach((arm, armIdx) => {
        const armId = arm.id || arm._id;
        const cell = cells.find((c) => c.armId === armId && c.epochId === epochId);
        if (!cell) return;
        (cell.elementIds || []).forEach((eid) => {
          const el = elements.find((e) => e.id === eid || e._id === eid);
          if (!el) return;
          nodes.push({
            id: `${cell.id}_${eid}`,
            cellId: cell.id,
            elementId: eid,
            element: el,
            armId,
            armIdx,
            armName: arm.name,
          });
        });
      });

      const laneW = Math.max(LANE_MIN_W, NODE_W + LANE_PAD * 2);
      const nodeX = xOffset + (laneW - NODE_W) / 2;
      const positionedNodes = nodes.map((n, i) => ({
        ...n,
        x: nodeX,
        y: HEADER_H + TOP_PAD + i * (NODE_H + NODE_GAP_Y),
      }));

      const laneH = Math.max(
        300,
        HEADER_H + TOP_PAD + nodes.length * (NODE_H + NODE_GAP_Y) + LANE_PAD
      );

      lanes.push({
        epoch, epochId, epochIdx, x: xOffset, w: laneW, h: laneH,
        nodes: positionedNodes, colors: epochLaneColor(epoch.type),
      });
      xOffset += laneW;
    });

    const totalW = Math.max(800, xOffset + LANE_PAD);
    const totalH = Math.max(400, Math.max(...lanes.map((l) => l.h), 300) + LANE_PAD * 2);

    const nodeMap = {};
    lanes.forEach((l) => l.nodes.forEach((n) => { nodeMap[n.id] = n; }));

    return { lanes, gutters, totalW, totalH, nodeMap };
  }, [sortedEpochs, sortedArms, cells, elements, markers]);

  // ── Compute marker positions ─────────────────────────────────────────
  const markerPositions = useMemo(() => {
    // Build map from epochId → gutter
    const epochGutterMap = {};
    layout.gutters.forEach((g) => {
      const epoch = sortedEpochs[g.afterEpochIdx];
      if (epoch) {
        epochGutterMap[epoch.id || epoch._id] = g;
      }
    });

    return markers.map((marker) => {
      const typeData = getMarkerType(marker.type);
      const gutter = epochGutterMap[marker.afterEpochId];

      if (gutter) {
        const cx = gutter.x + gutter.w / 2;
        const laneH = layout.lanes.length > 0 ? Math.max(...layout.lanes.map((l) => l.h)) : 300;
        const cy = HEADER_H + (laneH - HEADER_H) / 2;
        return { ...marker, typeData, cx, cy, gutterX: gutter.x, gutterW: gutter.w };
      }

      // Fallback: place after last lane
      const lastLane = layout.lanes[layout.lanes.length - 1];
      if (lastLane) {
        const cx = lastLane.x + lastLane.w + MARKER_GAP / 2;
        const cy = HEADER_H + (lastLane.h - HEADER_H) / 2;
        return { ...marker, typeData, cx, cy, gutterX: lastLane.x + lastLane.w, gutterW: MARKER_GAP };
      }

      return { ...marker, typeData, cx: 400, cy: 200 };
    });
  }, [markers, layout, sortedEpochs]);

  // ── Auto connections (arm flow across epoch lanes) ────────────────────
  const autoConnections = useMemo(() => {
    const lines = [];
    sortedArms.forEach((arm) => {
      const armId = arm.id || arm._id;
      let prevNodes = [];
      layout.lanes.forEach((lane) => {
        const armNodes = lane.nodes.filter((n) => n.armId === armId);
        if (prevNodes.length > 0 && armNodes.length > 0) {
          prevNodes.forEach((from) => {
            armNodes.forEach((to) => {
              lines.push({
                id: `auto_${from.id}-${to.id}`,
                x1: from.x + NODE_W + PORT_R, y1: from.y + NODE_H / 2,
                x2: to.x - PORT_R, y2: to.y + NODE_H / 2,
                type: 'auto',
              });
            });
          });
        }
        if (armNodes.length > 0) prevNodes = armNodes;
      });
    });
    return lines;
  }, [sortedArms, layout]);

  // ── Custom connections resolved to coordinates ────────────────────────
  const customConnLines = useMemo(() => {
    return customConns.map((cc) => {
      const from = layout.nodeMap[cc.fromNodeId];
      const to = layout.nodeMap[cc.toNodeId];
      if (!from || !to) return null;
      return {
        id: cc.id,
        x1: from.x + NODE_W + PORT_R, y1: from.y + NODE_H / 2,
        x2: to.x - PORT_R, y2: to.y + NODE_H / 2,
        type: 'custom',
      };
    }).filter(Boolean);
  }, [customConns, layout.nodeMap]);

  const allConnections = useMemo(
    () => [...autoConnections, ...customConnLines],
    [autoConnections, customConnLines]
  );

  // ── SVG coordinate helpers ────────────────────────────────────────────
  const getSvgPoint = useCallback((e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  // ── Palette drag ──────────────────────────────────────────────────────
  const handlePaletteDragStart = useCallback((preset, e) => {
    const pt = getSvgPoint(e);
    setPaletteDrag({ preset, x: pt.x, y: pt.y });
  }, [getSvgPoint]);

  // ── Marker drag ──────────────────────────────────────────────────────
  const handleMarkerDragStart = useCallback((markerType, e) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const pt = getSvgPoint(e);
    setMarkerDrag({ type: markerType, x: pt.x, y: pt.y });
  }, [getSvgPoint]);

  const handlePointerMove = useCallback((e) => {
    const pt = getSvgPoint(e);
    if (paletteDrag) {
      setPaletteDrag((d) => d ? { ...d, x: pt.x, y: pt.y } : null);
    }
    if (connecting) {
      setConnecting((c) => c ? { ...c, x2: pt.x, y2: pt.y } : null);
    }
    if (markerDrag) {
      setMarkerDrag((d) => d ? { ...d, x: pt.x, y: pt.y } : null);
    }
  }, [paletteDrag, connecting, markerDrag, getSvgPoint]);

  const handlePointerUp = useCallback((e) => {
    if (paletteDrag) {
      const pt = getSvgPoint(e);
      const lane = layout.lanes.find((l) => pt.x >= l.x && pt.x <= l.x + l.w);
      if (lane) {
        let el = elements.find((el) => el.name === paletteDrag.preset.name);
        if (!el) {
          addElement({
            name: paletteDrag.preset.name,
            color: paletteDrag.preset.color,
            description: paletteDrag.preset.description || '',
          });
          el = useDesignStore.getState().elements.find((e) => e.name === paletteDrag.preset.name);
        }
        if (el) {
          const armIdx = Math.max(0, Math.min(
            sortedArms.length - 1,
            Math.floor((pt.y - HEADER_H - TOP_PAD) / (NODE_H + NODE_GAP_Y))
          ));
          const arm = sortedArms[armIdx];
          if (arm) {
            const armId = arm.id || arm._id;
            const cell = cells.find((c) => c.armId === armId && c.epochId === lane.epochId);
            if (cell) assignElementToCell(el.id || el._id, cell.id);
          }
        }
      }
      setPaletteDrag(null);
    }

    // ★ Marker drop
    if (markerDrag) {
      const pt = getSvgPoint(e);
      // Find which gutter (between-lane space) the marker was dropped in
      // We detect "between lanes" by finding the gap between two adjacent lane rectangles
      let droppedGutterIdx = -1;

      for (let i = 0; i < layout.lanes.length - 1; i++) {
        const currentLane = layout.lanes[i];
        const nextLane = layout.lanes[i + 1];
        const gapStart = currentLane.x + currentLane.w;
        const gapEnd = nextLane.x;
        // Be generous with the drop zone — extend into lane edges
        if (pt.x >= gapStart - 30 && pt.x <= gapEnd + 30) {
          droppedGutterIdx = i;
          break;
        }
      }

      if (droppedGutterIdx >= 0) {
        const afterEpoch = sortedEpochs[droppedGutterIdx];
        const afterEpochId = afterEpoch ? (afterEpoch.id || afterEpoch._id) : null;
        if (afterEpochId) {
          addMarker({
            type: markerDrag.type.id,
            afterEpochId,
            label: markerDrag.type.shortLabel || markerDrag.type.name,
            ratio: markerDrag.type.id === 'randomization' ? '1:1' : '',
            description: markerDrag.type.description || '',
          });
        }
      }
      setMarkerDrag(null);
    }

    if (connecting) setConnecting(null);
  }, [paletteDrag, connecting, markerDrag, getSvgPoint, layout, elements, sortedArms, sortedEpochs, cells, addElement, assignElementToCell, addMarker]);

  // ── Port connection: drag from right port → drop on left port ─────────
  const handlePortDown = useCallback((nodeId, side, cx, cy, e) => {
    e.stopPropagation();
    if (side === 'right') {
      setConnecting({ fromNodeId: nodeId, x1: cx, y1: cy, x2: cx, y2: cy });
    }
  }, []);

  const handlePortUp = useCallback((nodeId, side, cx, cy, e) => {
    e.stopPropagation();
    if (connecting && side === 'left' && nodeId !== connecting.fromNodeId) {
      const connId = `custom_${connecting.fromNodeId}_${nodeId}_${Date.now()}`;
      setCustomConns((prev) => [...prev, { id: connId, fromNodeId: connecting.fromNodeId, toNodeId: nodeId }]);
    }
    setConnecting(null);
  }, [connecting]);

  const handleRemoveCustomConn = useCallback((connId) => {
    setCustomConns((prev) => prev.filter((c) => c.id !== connId));
  }, []);

  const handleDeleteNode = useCallback((node) => {
    unassignElementFromCell(node.elementId, node.cellId);
  }, [unassignElementFromCell]);

  // ── Delete marker ─────────────────────────────────────────────────────
  const handleDeleteMarker = useCallback((markerId) => {
    removeMarker(markerId);
  }, [removeMarker]);

  // ── Right-click node → inline edit ─────────────────────────────────────
  const handleNodeRightClick = useCallback((e, node) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingNode({
      nodeId: node.id,
      elementId: node.elementId,
      x: node.x,
      y: node.y,
      name: node.element.name,
    });
    setEditValue(node.element.name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, []);

  const handleEditSubmit = useCallback(() => {
    if (editingNode && editValue.trim()) {
      updateElement(editingNode.elementId, { name: editValue.trim() });
    }
    setEditingNode(null);
    setEditValue('');
  }, [editingNode, editValue, updateElement]);

  const handleEditKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleEditSubmit();
    if (e.key === 'Escape') { setEditingNode(null); setEditValue(''); }
  }, [handleEditSubmit]);

  // ── Right-click marker → edit label/ratio ──────────────────────────────
  const handleMarkerRightClick = useCallback((e, marker, pos) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingMarker({ ...marker, cx: pos.cx, cy: pos.cy });
    setMarkerEditValue(marker.ratio || marker.label || '');
    setTimeout(() => markerEditRef.current?.focus(), 50);
  }, []);

  const handleMarkerEditSubmit = useCallback(() => {
    if (editingMarker && markerEditValue.trim()) {
      updateMarker(editingMarker.id, {
        ratio: markerEditValue.trim(),
        label: markerEditValue.trim(),
      });
    }
    setEditingMarker(null);
    setMarkerEditValue('');
  }, [editingMarker, markerEditValue, updateMarker]);

  const handleMarkerEditKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleMarkerEditSubmit();
    if (e.key === 'Escape') { setEditingMarker(null); setMarkerEditValue(''); }
  }, [handleMarkerEditSubmit]);

  // ── Add epoch ─────────────────────────────────────────────────────────
  function handleAddEpoch(preset) {
    addEpoch({ name: preset.name, type: preset.type, order: epochs.length + 1 });
    setShowEpochMenu(false);
  }

  const canvasW = layout.totalW;
  const canvasH = layout.totalH;

  // ── Render a connection line (bezier + arrowhead) ─────────────────────
  function renderConnection(conn) {
    const dx = conn.x2 - conn.x1;
    const midX = conn.x1 + dx * 0.5;
    const isCustom = conn.type === 'custom';
    const strokeColor = isCustom ? '#6366f1' : '#94a3b8';
    const strokeOpacity = isCustom ? 0.8 : 0.5;

    return (
      <g key={conn.id} className={isCustom ? 'cursor-pointer' : ''} onClick={isCustom ? () => handleRemoveCustomConn(conn.id) : undefined}>
        <path
          d={`M${conn.x1},${conn.y1} C${midX},${conn.y1} ${midX},${conn.y2} ${conn.x2},${conn.y2}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={isCustom ? 2 : 1.5}
          opacity={strokeOpacity}
        />
        <polygon
          points={`${conn.x2},${conn.y2} ${conn.x2 - 7},${conn.y2 - 4} ${conn.x2 - 7},${conn.y2 + 4}`}
          fill={strokeColor}
          opacity={strokeOpacity}
        />
        {isCustom && (
          <path
            d={`M${conn.x1},${conn.y1} C${midX},${conn.y1} ${midX},${conn.y2} ${conn.x2},${conn.y2}`}
            fill="none" stroke="transparent" strokeWidth={12}
          />
        )}
      </g>
    );
  }

  // ── Render a port ─────────────────────────────────────────────────────
  function renderPort(cx, cy, side, nodeId) {
    const isHovered = hoveredPort === `${nodeId}_${side}`;
    const isOutput = side === 'right';
    return (
      <g>
        <circle
          cx={cx} cy={cy} r={PORT_R + 4}
          fill="transparent"
          className={isOutput ? 'cursor-crosshair' : 'cursor-pointer'}
          onPointerDown={(e) => handlePortDown(nodeId, side, cx, cy, e)}
          onPointerUp={(e) => handlePortUp(nodeId, side, cx, cy, e)}
          onPointerEnter={() => setHoveredPort(`${nodeId}_${side}`)}
          onPointerLeave={() => setHoveredPort(null)}
        />
        <circle
          cx={cx} cy={cy} r={PORT_R}
          fill={isHovered ? (isOutput ? '#e0e7ff' : '#dcfce7') : '#fff'}
          stroke={isHovered ? (isOutput ? '#6366f1' : '#22c55e') : '#94a3b8'}
          strokeWidth={isHovered ? 2 : 1.5}
          className="pointer-events-none transition-all"
        />
        {isHovered && isOutput && (
          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize={8} fill="#6366f1" fontWeight={700} className="pointer-events-none">
            &#9654;
          </text>
        )}
      </g>
    );
  }

  // ── Render a marker ───────────────────────────────────────────────────
  function renderMarker(pos) {
    const typeData = pos.typeData || getMarkerType(pos.type);
    const { cx, cy } = pos;
    const isEditing = editingMarker?.id === pos.id;

    // Draw vertical dashed line spanning the full lane height
    const laneH = layout.lanes.length > 0 ? Math.max(...layout.lanes.map((l) => l.h)) : 300;

    if (pos.type === 'randomization' || pos.type === 'stratification') {
      // Circle marker with vertical dashed line
      const r = RAND_R;
      return (
        <g key={pos.id} onContextMenu={(e) => handleMarkerRightClick(e, pos, pos)}>
          {/* Vertical dashed line spanning full height */}
          <line
            x1={cx} y1={HEADER_H + 4} x2={cx} y2={laneH - 8}
            stroke={typeData.color}
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.4}
          />
          {/* Background glow */}
          <circle cx={cx} cy={cy} r={r + 4} fill={typeData.color} opacity={0.08} />
          {/* Outer ring */}
          <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={typeData.color} strokeWidth={2.5} />
          {/* Inner colored fill */}
          <circle cx={cx} cy={cy} r={r - 4} fill={typeData.color} opacity={0.15} />
          {/* Label */}
          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
            fontSize={14} fontWeight={800} fill={typeData.color} className="pointer-events-none">
            {typeData.shortLabel}
          </text>
          {/* Ratio/label below */}
          {pos.ratio && (
            <text x={cx} y={cy + r + 14} textAnchor="middle" fontSize={10} fontWeight={600}
              fill={typeData.color} opacity={0.8} className="pointer-events-none">
              {pos.ratio}
            </text>
          )}
          {/* Full label above */}
          <text x={cx} y={HEADER_H - 4} textAnchor="middle" fontSize={9} fontWeight={600}
            fill={typeData.color} opacity={0.7} className="pointer-events-none">
            {typeData.fullLabel}
          </text>
          {/* Fan-out arrows to arms below the marker */}
          {sortedArms.length > 1 && pos.type === 'randomization' && (
            <g opacity={0.35}>
              {sortedArms.map((_, i) => {
                const armY = HEADER_H + TOP_PAD + i * (NODE_H + NODE_GAP_Y) + NODE_H / 2;
                const afterEpochIdx = sortedEpochs.findIndex((e) => (e.id || e._id) === pos.afterEpochId);
                const nextLane = afterEpochIdx >= 0 ? layout.lanes[afterEpochIdx + 1] : null;
                if (!nextLane) return null;
                const targetX = nextLane.x + 10;
                return (
                  <g key={i}>
                    <line x1={cx + r + 2} y1={cy} x2={targetX} y2={armY}
                      stroke={typeData.color} strokeWidth={1.5} strokeDasharray="4 2" />
                    <polygon
                      points={`${targetX},${armY} ${targetX - 5},${armY - 3} ${targetX - 5},${armY + 3}`}
                      fill={typeData.color}
                    />
                  </g>
                );
              })}
            </g>
          )}
          {/* × delete */}
          <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteMarker(pos.id); }}>
            <circle cx={cx + r - 2} cy={cy - r + 2} r={DELETE_R} fill="#fff" stroke="#e5e7eb" strokeWidth={1} />
            <text x={cx + r - 2} y={cy - r + 3} textAnchor="middle" dominantBaseline="central"
              fontSize={10} fontWeight={700} fill="#ef4444" className="pointer-events-none">×</text>
          </g>
        </g>
      );
    }

    if (pos.type === 'interim_analysis') {
      // Diamond marker
      const s = IA_SIZE;
      const diamondPath = `M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`;
      return (
        <g key={pos.id} onContextMenu={(e) => handleMarkerRightClick(e, pos, pos)}>
          <line
            x1={cx} y1={HEADER_H + 4} x2={cx} y2={laneH - 8}
            stroke={typeData.color} strokeWidth={2} strokeDasharray="6 4" opacity={0.3}
          />
          <path d={diamondPath} fill="#fff" stroke={typeData.color} strokeWidth={2.5} />
          <path d={`M${cx},${cy - s + 5} L${cx + s - 5},${cy} L${cx},${cy + s - 5} L${cx - s + 5},${cy} Z`}
            fill={typeData.color} opacity={0.12} />
          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
            fontSize={11} fontWeight={800} fill={typeData.color} className="pointer-events-none">
            IA
          </text>
          {pos.ratio && (
            <text x={cx} y={cy + s + 14} textAnchor="middle" fontSize={9} fontWeight={600}
              fill={typeData.color} opacity={0.8} className="pointer-events-none">
              {pos.ratio}
            </text>
          )}
          <text x={cx} y={HEADER_H - 4} textAnchor="middle" fontSize={9} fontWeight={600}
            fill={typeData.color} opacity={0.7} className="pointer-events-none">
            Interim Analysis
          </text>
          {/* Dashed crossed arrows indicating possible arm dropping */}
          {sortedArms.length > 1 && (
            <g opacity={0.25}>
              {sortedArms.map((_, i) => {
                if (i === 0) return null; // skip first arm
                const armY = HEADER_H + TOP_PAD + i * (NODE_H + NODE_GAP_Y) + NODE_H / 2;
                return (
                  <g key={i}>
                    <line x1={cx - s - 4} y1={armY} x2={cx + s + 4} y2={armY}
                      stroke={typeData.color} strokeWidth={1} strokeDasharray="3 2" />
                    {/* Small "X" mark for potential dropping */}
                    <text x={cx + s + 10} y={armY + 1} fontSize={8} fill={typeData.color}
                      dominantBaseline="central" className="pointer-events-none">drop?</text>
                  </g>
                );
              })}
            </g>
          )}
          <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteMarker(pos.id); }}>
            <circle cx={cx + s - 4} cy={cy - s + 4} r={DELETE_R} fill="#fff" stroke="#e5e7eb" strokeWidth={1} />
            <text x={cx + s - 4} y={cy - s + 5} textAnchor="middle" dominantBaseline="central"
              fontSize={10} fontWeight={700} fill="#ef4444" className="pointer-events-none">×</text>
          </g>
        </g>
      );
    }

    if (pos.type === 'decision_point') {
      // Hexagon/rounded rect marker
      const hw = DECISION_W / 2;
      const hh = DECISION_H / 2;
      return (
        <g key={pos.id} onContextMenu={(e) => handleMarkerRightClick(e, pos, pos)}>
          <line
            x1={cx} y1={HEADER_H + 4} x2={cx} y2={laneH - 8}
            stroke={typeData.color} strokeWidth={2} strokeDasharray="6 4" opacity={0.3}
          />
          <rect x={cx - hw} y={cy - hh} width={DECISION_W} height={DECISION_H}
            rx={DECISION_H / 2} fill="#fff" stroke={typeData.color} strokeWidth={2.5} />
          <rect x={cx - hw + 3} y={cy - hh + 3} width={DECISION_W - 6} height={DECISION_H - 6}
            rx={(DECISION_H - 6) / 2} fill={typeData.color} opacity={0.08} />
          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
            fontSize={10} fontWeight={700} fill={typeData.color} className="pointer-events-none">
            {pos.ratio || 'Decision Point'}
          </text>
          <text x={cx} y={HEADER_H - 4} textAnchor="middle" fontSize={9} fontWeight={600}
            fill={typeData.color} opacity={0.7} className="pointer-events-none">
            Decision
          </text>
          <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteMarker(pos.id); }}>
            <circle cx={cx + hw - 2} cy={cy - hh + 2} r={DELETE_R} fill="#fff" stroke="#e5e7eb" strokeWidth={1} />
            <text x={cx + hw - 2} y={cy - hh + 3} textAnchor="middle" dominantBaseline="central"
              fontSize={10} fontWeight={700} fill="#ef4444" className="pointer-events-none">×</text>
          </g>
        </g>
      );
    }

    // Fallback circle
    return (
      <g key={pos.id}>
        <circle cx={cx} cy={cy} r={RAND_R} fill="#fff" stroke="#94a3b8" strokeWidth={2} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="#64748b">
          ?
        </text>
      </g>
    );
  }

  // ── Render gutter drop zones ─────────────────────────────────────────
  function renderGutterDropZones() {
    if (!markerDrag) return null;
    return layout.lanes.slice(0, -1).map((lane, i) => {
      const nextLane = layout.lanes[i + 1];
      if (!nextLane) return null;
      const gapX = lane.x + lane.w;
      const gapW = nextLane.x - gapX;
      const laneH = Math.max(lane.h, nextLane.h);
      // Expand the drop zone visually
      const dropX = gapX - 15;
      const dropW = gapW + 30;
      return (
        <g key={`gutter_drop_${i}`}>
          <rect
            x={dropX} y={HEADER_H} width={dropW} height={laneH - HEADER_H}
            rx={8}
            fill={markerDrag.type.color}
            opacity={0.08}
            stroke={markerDrag.type.color}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <text
            x={gapX + gapW / 2} y={HEADER_H + 20}
            textAnchor="middle" fontSize={9} fontWeight={600}
            fill={markerDrag.type.color} opacity={0.6}
          >
            Drop {markerDrag.type.fullLabel} here
          </text>
        </g>
      );
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center px-4 py-2.5 border-b border-gray-200 bg-gray-50/80 gap-3 flex-wrap" style={{ minHeight: 56 }}>
        {/* Create Epoch */}
        <div className="relative">
          <button
            onClick={() => setShowEpochMenu(!showEpochMenu)}
            className="flex items-center px-3.5 py-2 rounded-lg border-2 border-dashed border-indigo-300 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            CREATE AN EPOCH
          </button>
          {showEpochMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]">
              {EPOCH_PRESETS.map((ep) => (
                <button key={ep.name} onClick={() => handleAddEpoch(ep)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                >{ep.name}</button>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button onClick={() => { const name = prompt('Epoch name:'); if (name) handleAddEpoch({ name, type: 'Treatment' }); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >Custom…</button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-7 bg-gray-300" />

        {/* Element chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {ELEMENT_PRESETS.map((preset) => (
            <div
              key={preset.name}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md hover:scale-105 transition-all"
              style={{ backgroundColor: preset.color }}
              onPointerDown={(e) => { e.preventDefault(); if (svgRef.current) handlePaletteDragStart(preset, e); }}
            >
              {preset.name}
            </div>
          ))}
          {elements.filter((el) => !ELEMENT_PRESETS.find((p) => p.name === el.name)).map((el) => (
            <div
              key={el.id}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md hover:scale-105 transition-all"
              style={{ backgroundColor: el.color || '#6366f1' }}
              onPointerDown={(e) => { e.preventDefault(); if (svgRef.current) handlePaletteDragStart({ name: el.name, color: el.color || '#6366f1', description: '' }, e); }}
            >
              {el.name}
            </div>
          ))}
        </div>

        <div className="w-px h-7 bg-gray-300" />

        {/* ★ Marker chips — Randomization, Interim Analysis, Decision Point, Stratification */}
        <div className="flex items-center gap-2 flex-wrap">
          {Object.values(MARKER_TYPES).map((mt) => (
            <div
              key={mt.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-grab active:cursor-grabbing select-none border-2 border-dashed hover:shadow-md hover:scale-105 transition-all"
              style={{
                backgroundColor: mt.bgColor,
                borderColor: mt.borderColor,
                color: mt.color,
              }}
              onPointerDown={(e) => { e.preventDefault(); if (svgRef.current) handleMarkerDragStart(mt, e); }}
              title={mt.description}
            >
              {mt.shape === 'circle' && (
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-black"
                  style={{ backgroundColor: mt.color }}>
                  {mt.shortLabel}
                </span>
              )}
              {mt.shape === 'diamond' && (
                <span className="w-4 h-4 flex items-center justify-center text-white text-[7px] font-black"
                  style={{ backgroundColor: mt.color, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
                  {mt.shortLabel}
                </span>
              )}
              {mt.shape === 'hexagon' && (
                <span className="w-4 h-4 rounded-sm flex items-center justify-center text-white text-[8px] font-black"
                  style={{ backgroundColor: mt.color }}>
                  {mt.shortLabel}
                </span>
              )}
              {mt.fullLabel}
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {/* Instructions */}
        <div className="hidden xl:flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-400" />
            Drag port→port
          </span>
          <span>·</span>
          <span>Right-click to edit</span>
          <span>·</span>
          <span>Drag markers between lanes</span>
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-[#f8fafc] relative" style={{ minHeight: 400 }}>
        <svg
          ref={svgRef}
          width={canvasW}
          height={canvasH}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          className="select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={() => { setShowEpochMenu(false); setShowMarkerMenu(false); if (editingNode) handleEditSubmit(); if (editingMarker) handleMarkerEditSubmit(); }}
        >
          {/* Grid dots */}
          <defs>
            <pattern id="graph-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#d1d5db" />
            </pattern>
            <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
            </filter>
            <filter id="marker-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity="0.2" />
            </filter>
          </defs>
          <rect width={canvasW} height={canvasH} fill="url(#graph-dots)" />

          {/* ── Gutter drop zones (visible during marker drag) ──────── */}
          {renderGutterDropZones()}

          {/* ── Epoch Swim Lanes ─────────────────────────────────────── */}
          {layout.lanes.map((lane) => {
            const c = lane.colors;
            return (
              <g key={lane.epochId}>
                <rect x={lane.x} y={0} width={lane.w} height={lane.h} rx={10}
                  fill={c.bg} stroke={c.border} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.7} />
                <rect x={lane.x} y={0} width={lane.w} height={HEADER_H} rx={10} fill={c.headerBg} />
                <rect x={lane.x} y={HEADER_H - 10} width={lane.w} height={10} fill={c.headerBg} />
                <text x={lane.x + lane.w / 2} y={HEADER_H / 2 + 1}
                  textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600} fill={c.headerText}>
                  {lane.epoch.name}
                </text>
                <text x={lane.x + lane.w - 20} y={HEADER_H / 2 + 1}
                  textAnchor="middle" dominantBaseline="central" fontSize={14} fill={c.headerText} opacity={0.5}
                  className="cursor-pointer hover:opacity-100">
                  &#9881;
                </text>
              </g>
            );
          })}

          {/* ── Connection lines ────────────────────────────────────── */}
          {allConnections.map(renderConnection)}

          {/* ── Live connection line while dragging port ─────────────── */}
          {connecting && (
            <g style={{ pointerEvents: 'none' }}>
              <path
                d={(() => {
                  const dx = connecting.x2 - connecting.x1;
                  const midX = connecting.x1 + dx * 0.5;
                  return `M${connecting.x1},${connecting.y1} C${midX},${connecting.y1} ${midX},${connecting.y2} ${connecting.x2},${connecting.y2}`;
                })()}
                fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" opacity={0.7}
              />
              <circle cx={connecting.x2} cy={connecting.y2} r={5} fill="#6366f1" opacity={0.4}>
                <animate attributeName="r" values="4;8;4" dur="0.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0.15;0.5" dur="0.8s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* ── Placed Markers (Randomization, IA, Decision Point) ──── */}
          {markerPositions.map(renderMarker)}

          {/* ── Nodes ──────────────────────────────────────────────── */}
          {layout.lanes.map((lane) =>
            lane.nodes.map((node) => {
              const bg = node.element?.color || '#6366f1';
              const isEditing = editingNode?.nodeId === node.id;
              return (
                <g key={node.id} onContextMenu={(e) => handleNodeRightClick(e, node)}>
                  <rect
                    x={node.x} y={node.y} width={NODE_W} height={NODE_H}
                    rx={NODE_H / 2} fill={bg} filter="url(#node-shadow)"
                    className={isEditing ? '' : 'cursor-pointer'}
                  />
                  {!isEditing && (
                    <text x={node.x + NODE_W / 2} y={node.y + NODE_H / 2 + 1}
                      textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}
                      fill="#fff" className="pointer-events-none">
                      {node.element.name}
                    </text>
                  )}
                  <g
                    className="cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleDeleteNode(node); }}
                  >
                    <circle
                      cx={node.x + NODE_W - 4} cy={node.y + 2}
                      r={DELETE_R} fill="#fff" stroke="#e5e7eb" strokeWidth={1}
                    />
                    <text
                      x={node.x + NODE_W - 4} y={node.y + 3}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize={10} fontWeight={700} fill="#ef4444"
                      className="pointer-events-none"
                    >
                      ×
                    </text>
                  </g>
                  {renderPort(node.x - PORT_R + 2, node.y + NODE_H / 2, 'left', node.id)}
                  {renderPort(node.x + NODE_W + PORT_R - 2, node.y + NODE_H / 2, 'right', node.id)}
                </g>
              );
            })
          )}

          {/* ── Palette drag ghost ─────────────────────────────────── */}
          {paletteDrag && (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={paletteDrag.x - NODE_W / 2} y={paletteDrag.y - NODE_H / 2}
                width={NODE_W} height={NODE_H} rx={NODE_H / 2} fill={paletteDrag.preset.color} opacity={0.7}
                filter="url(#node-shadow)" />
              <text x={paletteDrag.x} y={paletteDrag.y + 1}
                textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="#fff" opacity={0.9}>
                {paletteDrag.preset.name}
              </text>
            </g>
          )}

          {/* ── Marker drag ghost ──────────────────────────────────── */}
          {markerDrag && (
            <g style={{ pointerEvents: 'none' }}>
              {markerDrag.type.shape === 'circle' && (
                <>
                  <circle cx={markerDrag.x} cy={markerDrag.y} r={RAND_R} fill="#fff"
                    stroke={markerDrag.type.color} strokeWidth={2.5} opacity={0.8}
                    filter="url(#marker-glow)" />
                  <text x={markerDrag.x} y={markerDrag.y + 1} textAnchor="middle" dominantBaseline="central"
                    fontSize={14} fontWeight={800} fill={markerDrag.type.color} opacity={0.8}>
                    {markerDrag.type.shortLabel}
                  </text>
                </>
              )}
              {markerDrag.type.shape === 'diamond' && (
                <>
                  <path
                    d={`M${markerDrag.x},${markerDrag.y - IA_SIZE} L${markerDrag.x + IA_SIZE},${markerDrag.y} L${markerDrag.x},${markerDrag.y + IA_SIZE} L${markerDrag.x - IA_SIZE},${markerDrag.y} Z`}
                    fill="#fff" stroke={markerDrag.type.color} strokeWidth={2.5} opacity={0.8}
                    filter="url(#marker-glow)" />
                  <text x={markerDrag.x} y={markerDrag.y + 1} textAnchor="middle" dominantBaseline="central"
                    fontSize={11} fontWeight={800} fill={markerDrag.type.color} opacity={0.8}>
                    IA
                  </text>
                </>
              )}
              {markerDrag.type.shape === 'hexagon' && (
                <>
                  <rect x={markerDrag.x - DECISION_W / 2} y={markerDrag.y - DECISION_H / 2}
                    width={DECISION_W} height={DECISION_H} rx={DECISION_H / 2}
                    fill="#fff" stroke={markerDrag.type.color} strokeWidth={2.5} opacity={0.8}
                    filter="url(#marker-glow)" />
                  <text x={markerDrag.x} y={markerDrag.y + 1} textAnchor="middle" dominantBaseline="central"
                    fontSize={10} fontWeight={700} fill={markerDrag.type.color} opacity={0.8}>
                    Decision
                  </text>
                </>
              )}
            </g>
          )}

          {/* ── Empty state ────────────────────────────────────────── */}
          {layout.lanes.length === 0 && (
            <g>
              <text x={canvasW / 2} y={canvasH / 2 - 20} textAnchor="middle" fontSize={14} fill="#9ca3af">
                No epochs defined yet.
              </text>
              <text x={canvasW / 2} y={canvasH / 2 + 6} textAnchor="middle" fontSize={12} fill="#d1d5db">
                Click "Create an Epoch" above to add swim lanes, then drag element chips in.
              </text>
            </g>
          )}
        </svg>

        {/* ── Inline edit overlay for nodes (HTML on top of SVG) ────── */}
        {editingNode && (
          <div
            className="absolute z-50"
            style={{
              left: editingNode.x,
              top: editingNode.y,
              width: NODE_W,
              height: NODE_H,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditSubmit}
              className="w-full h-full rounded-full text-center text-xs font-semibold text-white border-2 border-white outline-none focus:ring-2 focus:ring-white/50"
              style={{ backgroundColor: elements.find((e) => e.id === editingNode.elementId)?.color || '#6366f1' }}
            />
          </div>
        )}

        {/* ── Inline edit overlay for markers (HTML on top of SVG) ──── */}
        {editingMarker && (
          <div
            className="absolute z-50"
            style={{
              left: editingMarker.cx - 50,
              top: editingMarker.cy + 30,
              width: 100,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-lg shadow-lg border-2 p-2" style={{ borderColor: editingMarker.typeData?.color || '#dc2626' }}>
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                {editingMarker.type === 'randomization' ? 'Ratio (e.g., 1:1:1)' :
                 editingMarker.type === 'interim_analysis' ? 'Analysis label' :
                 'Label'}
              </label>
              <input
                ref={markerEditRef}
                type="text"
                value={markerEditValue}
                onChange={(e) => setMarkerEditValue(e.target.value)}
                onKeyDown={handleMarkerEditKeyDown}
                onBlur={handleMarkerEditSubmit}
                placeholder={editingMarker.type === 'randomization' ? '1:1' : 'Label...'}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom helper bar with marker legend ─────────────────────── */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50/80 flex items-center gap-4 flex-wrap text-[10px] text-gray-500">
        <span className="font-semibold text-gray-600 uppercase tracking-wide">Markers:</span>
        {Object.values(MARKER_TYPES).map((mt) => (
          <span key={mt.id} className="flex items-center gap-1.5">
            {mt.shape === 'circle' && (
              <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-black"
                style={{ backgroundColor: mt.color }}>{mt.shortLabel}</span>
            )}
            {mt.shape === 'diamond' && (
              <span className="w-3.5 h-3.5 flex items-center justify-center text-white text-[6px] font-black"
                style={{ backgroundColor: mt.color, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>{mt.shortLabel}</span>
            )}
            {mt.shape === 'hexagon' && (
              <span className="w-3.5 h-3.5 rounded-sm flex items-center justify-center text-white text-[7px] font-black"
                style={{ backgroundColor: mt.color }}>{mt.shortLabel}</span>
            )}
            <span>{mt.fullLabel}</span>
          </span>
        ))}
        <span className="text-gray-400 ml-auto">
          Drag markers from toolbar → drop between epoch lanes · Right-click marker to edit ratio/label
        </span>
      </div>
    </div>
  );
}
