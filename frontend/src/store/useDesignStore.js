import { create } from 'zustand';
import * as designApi from '../api/design';

const useDesignStore = create((set, get) => ({
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  arms: [],
  epochs: [],
  cells: [],
  elements: [],
  markers: [],          // Study markers (randomization, interim analysis, etc.)
  flowOverrides: [],    // Arrow overrides: [{id, fromArmId, fromEpochIdx, toArmId}]
  interventionModel: null,
  blindingSchema: null,
  eligibilityCriteria: { inclusion: [], exclusion: [] },
  objectives: [],
  dirty: false,
  loading: false,

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /**
   * Load design data from the backend and populate local state.
   */
  loadDesign: async (protocolId) => {
    set({ loading: true });
    try {
      const data = await designApi.getDesign(protocolId);

      // Normalize eligibilityCriteria: if it's a flat list (USDM format),
      // convert to {inclusion: [], exclusion: []} for the UI.
      let ec = data.eligibilityCriteria;
      if (Array.isArray(ec)) {
        ec = {
          inclusion: ec.filter((c) => c.category === 'inclusion'),
          exclusion: ec.filter((c) => c.category === 'exclusion'),
        };
      } else if (!ec) {
        ec = { inclusion: [], exclusion: [] };
      }

      set({
        arms: data.studyArms || [],
        epochs: data.studyEpochs || [],
        cells: data.studyCells || [],
        elements: data.studyElements || [],
        markers: data.studyMarkers || [],
        flowOverrides: data.studyFlowOverrides || [],
        interventionModel: data.interventionModel || null,
        blindingSchema: data.blindingSchema || null,
        eligibilityCriteria: ec,
        objectives: data.objectives || [],
        dirty: false,
        loading: false,
      });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  /**
   * Add an arm. Auto-creates one cell for each existing epoch.
   */
  addArm: (arm) => {
    const { epochs } = get();
    const newArm = { id: arm.id || crypto.randomUUID(), ...arm };
    const newCells = epochs.map((epoch) => ({
      id: crypto.randomUUID(),
      armId: newArm.id,
      epochId: epoch.id,
      elementIds: [],
    }));
    set((state) => ({
      arms: [...state.arms, newArm],
      cells: [...state.cells, ...newCells],
      dirty: true,
    }));
  },

  /**
   * Remove an arm and all cells belonging to it.
   */
  removeArm: (armId) => {
    set((state) => ({
      arms: state.arms.filter((a) => a.id !== armId),
      cells: state.cells.filter((c) => c.armId !== armId),
      flowOverrides: state.flowOverrides.filter(
        (fo) => fo.fromArmId !== armId && fo.toArmId !== armId
      ),
      dirty: true,
    }));
  },

  /**
   * Merge updates into an existing arm.
   */
  updateArm: (armId, updates) => {
    set((state) => ({
      arms: state.arms.map((a) => (a.id === armId ? { ...a, ...updates } : a)),
      dirty: true,
    }));
  },

  /**
   * Add an epoch. Auto-creates one cell for each existing arm.
   */
  addEpoch: (epoch) => {
    const { arms } = get();
    const newEpoch = { id: epoch.id || crypto.randomUUID(), ...epoch };
    const newCells = arms.map((arm) => ({
      id: crypto.randomUUID(),
      armId: arm.id,
      epochId: newEpoch.id,
      elementIds: [],
    }));
    set((state) => ({
      epochs: [...state.epochs, newEpoch],
      cells: [...state.cells, ...newCells],
      dirty: true,
    }));
  },

  /**
   * Remove an epoch, all its cells, and any markers positioned after it.
   */
  removeEpoch: (epochId) => {
    set((state) => ({
      epochs: state.epochs.filter((e) => e.id !== epochId),
      cells: state.cells.filter((c) => c.epochId !== epochId),
      markers: state.markers.filter((m) => m.afterEpochId !== epochId),
      flowOverrides: state.flowOverrides.filter((fo) => fo.fromEpochId !== epochId),
      dirty: true,
    }));
  },

  /**
   * Merge updates into an existing epoch.
   */
  updateEpoch: (epochId, updates) => {
    set((state) => ({
      epochs: state.epochs.map((e) =>
        e.id === epochId ? { ...e, ...updates } : e
      ),
      dirty: true,
    }));
  },

  /**
   * Update a cell's elementIds.
   */
  updateCell: (cellId, elementIds) => {
    set((state) => ({
      cells: state.cells.map((c) =>
        c.id === cellId ? { ...c, elementIds } : c
      ),
      dirty: true,
    }));
  },

  /**
   * Add a study element.
   */
  addElement: (element) => {
    const newElement = { id: element.id || crypto.randomUUID(), ...element };
    set((state) => ({
      elements: [...state.elements, newElement],
      dirty: true,
    }));
  },

  /**
   * Merge updates into an existing element.
   */
  updateElement: (elementId, updates) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === elementId ? { ...el, ...updates } : el
      ),
      dirty: true,
    }));
  },

  /**
   * Set the intervention model.
   */
  setInterventionModel: (model) => {
    set({ interventionModel: model, dirty: true });
  },

  /**
   * Set the blinding schema.
   */
  setBlindingSchema: (schema) => {
    set({ blindingSchema: schema, dirty: true });
  },

  /**
   * Set the full eligibility criteria object.
   */
  setEligibilityCriteria: (criteria) => {
    set({ eligibilityCriteria: criteria, dirty: true });
  },

  /**
   * Set the full objectives array.
   */
  setObjectives: (objectives) => {
    set({ objectives, dirty: true });
  },

  // -----------------------------------------------------------------------
  // Marker Actions
  // -----------------------------------------------------------------------

  /**
   * Add a study marker (randomization, interim analysis, etc.).
   */
  addMarker: (marker) => {
    const newMarker = { id: marker.id || crypto.randomUUID(), ...marker };
    set((state) => ({
      markers: [...state.markers, newMarker],
      dirty: true,
    }));
  },

  /**
   * Merge updates into an existing marker (e.g. edit ratio/label).
   */
  updateMarker: (markerId, updates) => {
    set((state) => ({
      markers: state.markers.map((m) =>
        m.id === markerId ? { ...m, ...updates } : m
      ),
      dirty: true,
    }));
  },

  /**
   * Remove a marker by ID.
   */
  removeMarker: (markerId) => {
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== markerId),
      dirty: true,
    }));
  },

  /**
   * Replace the entire markers array.
   */
  setMarkers: (markers) => {
    set({ markers, dirty: true });
  },

  // -----------------------------------------------------------------------
  // Flow Override Actions
  // -----------------------------------------------------------------------

  /**
   * Set or update a flow override for a specific arrow.
   * key = `${fromArmId}__${fromEpochId}` — identifies which arrow.
   * toArmId = the arm the arrow points TO in the next epoch.
   * If toArmId === fromArmId it's the default (straight) — remove override.
   */
  setFlowOverride: (fromArmId, fromEpochId, toArmId) => {
    set((state) => {
      const key = `${fromArmId}__${fromEpochId}`;
      // If toArmId equals fromArmId, remove override (revert to default straight)
      if (toArmId === fromArmId) {
        return {
          flowOverrides: state.flowOverrides.filter((fo) => fo.key !== key),
          dirty: true,
        };
      }
      const existing = state.flowOverrides.find((fo) => fo.key === key);
      if (existing) {
        return {
          flowOverrides: state.flowOverrides.map((fo) =>
            fo.key === key ? { ...fo, toArmId } : fo
          ),
          dirty: true,
        };
      }
      return {
        flowOverrides: [
          ...state.flowOverrides,
          { id: crypto.randomUUID(), key, fromArmId, fromEpochId, toArmId },
        ],
        dirty: true,
      };
    });
  },

  /**
   * Remove a flow override.
   */
  removeFlowOverride: (key) => {
    set((state) => ({
      flowOverrides: state.flowOverrides.filter((fo) => fo.key !== key),
      dirty: true,
    }));
  },

  /**
   * Remove an element and clean up all cell references to it.
   */
  removeElement: (elementId) => {
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== elementId),
      cells: state.cells.map((c) => ({
        ...c,
        elementIds: c.elementIds.filter((eid) => eid !== elementId),
      })),
      dirty: true,
    }));
  },

  /**
   * Add an element to a specific cell (if not already present).
   */
  assignElementToCell: (elementId, cellId) => {
    set((state) => ({
      cells: state.cells.map((c) =>
        c.id === cellId && !c.elementIds.includes(elementId)
          ? { ...c, elementIds: [...c.elementIds, elementId] }
          : c
      ),
      dirty: true,
    }));
  },

  /**
   * Remove an element from a specific cell.
   */
  unassignElementFromCell: (elementId, cellId) => {
    set((state) => ({
      cells: state.cells.map((c) =>
        c.id === cellId
          ? { ...c, elementIds: c.elementIds.filter((eid) => eid !== elementId) }
          : c
      ),
      dirty: true,
    }));
  },

  /**
   * Move an element from one cell to another.
   */
  moveElementBetweenCells: (elementId, fromCellId, toCellId) => {
    set((state) => ({
      cells: state.cells.map((c) => {
        if (c.id === fromCellId)
          return { ...c, elementIds: c.elementIds.filter((eid) => eid !== elementId) };
        if (c.id === toCellId && !c.elementIds.includes(elementId))
          return { ...c, elementIds: [...c.elementIds, elementId] };
        return c;
      }),
      dirty: true,
    }));
  },

  /**
   * Load a design template. Generates fresh UUIDs for all entities
   * and rewires cell/marker references to the new IDs.
   */
  loadTemplate: (templateData) => {
    const armIdMap = {};
    const epochIdMap = {};
    const elementIdMap = {};

    const newArms = templateData.arms.map((a) => {
      const newId = crypto.randomUUID();
      armIdMap[a.id] = newId;
      return { ...a, id: newId };
    });

    const newEpochs = templateData.epochs.map((e) => {
      const newId = crypto.randomUUID();
      epochIdMap[e.id] = newId;
      return { ...e, id: newId };
    });

    const newElements = templateData.elements.map((el) => {
      const newId = crypto.randomUUID();
      elementIdMap[el.id] = newId;
      return { ...el, id: newId };
    });

    const newCells = templateData.cells.map((c) => ({
      id: crypto.randomUUID(),
      armId: armIdMap[c.armId] || c.armId,
      epochId: epochIdMap[c.epochId] || c.epochId,
      elementIds: (c.elementIds || []).map((eid) => elementIdMap[eid] || eid),
    }));

    // Remap marker epoch references to new IDs
    const newMarkers = (templateData.markers || []).map((m) => ({
      ...m,
      id: crypto.randomUUID(),
      afterEpochId: epochIdMap[m.afterEpochId] || m.afterEpochId,
    }));

    // Remap flow override arm + epoch references to new IDs
    const newFlowOverrides = (templateData.flowOverrides || []).map((fo) => {
      const newFromArmId = armIdMap[fo.fromArmId] || fo.fromArmId;
      const newFromEpochId = epochIdMap[fo.fromEpochId] || fo.fromEpochId;
      const newToArmId = armIdMap[fo.toArmId] || fo.toArmId;
      return {
        ...fo,
        id: crypto.randomUUID(),
        key: `${newFromArmId}__${newFromEpochId}`,
        fromArmId: newFromArmId,
        fromEpochId: newFromEpochId,
        toArmId: newToArmId,
      };
    });

    set({
      arms: newArms,
      epochs: newEpochs,
      elements: newElements,
      cells: newCells,
      markers: newMarkers,
      flowOverrides: newFlowOverrides,
      interventionModel: templateData.interventionModel || null,
      blindingSchema: templateData.blindingSchema || null,
      dirty: true,
    });
  },

  /**
   * Persist the full design state back to the server.
   */
  saveDesign: async (protocolId) => {
    const { arms, epochs, cells, elements, markers, flowOverrides, interventionModel, blindingSchema, eligibilityCriteria, objectives } =
      get();
    set({ loading: true });
    try {
      await designApi.saveDesign(protocolId, {
        studyArms: arms,
        studyEpochs: epochs,
        studyCells: cells,
        studyElements: elements,
        studyMarkers: markers,
        studyFlowOverrides: flowOverrides,
        interventionModel,
        blindingSchema,
        eligibilityCriteria,
        objectives,
      });
      set({ dirty: false, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
}));

export default useDesignStore;
