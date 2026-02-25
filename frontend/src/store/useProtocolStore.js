import { create } from 'zustand';
import * as protocolsApi from '../api/protocols';

const useProtocolStore = create((set, get) => ({
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  protocol: null,
  protocols: [],
  loading: false,
  error: null,
  dirty: false,

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /**
   * Load all protocols (summary list).
   */
  loadProtocols: async () => {
    set({ loading: true, error: null });
    try {
      const protocols = await protocolsApi.listProtocols();
      set({ protocols, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /**
   * Load a single protocol by ID (full detail).
   */
  loadProtocol: async (id) => {
    set({ loading: true, error: null });
    try {
      const protocol = await protocolsApi.getProtocol(id);
      set({ protocol, loading: false, dirty: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /**
   * Create a new protocol and return it.
   */
  createProtocol: async (data) => {
    set({ loading: true, error: null });
    try {
      const newProtocol = await protocolsApi.createProtocol(data);
      set((state) => ({
        protocols: [...state.protocols, newProtocol],
        loading: false,
      }));
      return newProtocol;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  /**
   * Update a single top-level field on the current protocol in local state.
   * Marks the store as dirty (unsaved changes).
   */
  updateField: (field, value) => {
    const { protocol } = get();
    if (!protocol) return;
    set({
      protocol: { ...protocol, [field]: value },
      dirty: true,
    });
  },

  /**
   * Persist the current protocol back to the server.
   * Sends only the mutable metadata fields.
   */
  saveProtocol: async () => {
    const { protocol } = get();
    if (!protocol) return;

    set({ loading: true, error: null });
    try {
      const updatedFields = {
        protocolNumber: protocol.protocolNumber,
        fullTitle: protocol.fullTitle,
        shortTitle: protocol.shortTitle,
        phase: protocol.phase,
        studyType: protocol.studyType,
        therapeuticArea: protocol.therapeuticArea,
        indication: protocol.indication,
        sponsorName: protocol.sponsorName,
        sampleSize: protocol.sampleSize,
        status: protocol.status,
      };

      const updated = await protocolsApi.updateProtocol(protocol.id, updatedFields);
      set({ protocol: updated, dirty: false, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /**
   * Update a narrative section in local state.
   * Marks dirty so it can be persisted with saveProtocol.
   */
  updateNarrativeSection: (sectionKey, text) => {
    const { protocol } = get();
    if (!protocol) return;
    set({
      protocol: {
        ...protocol,
        narrativeSections: {
          ...protocol.narrativeSections,
          [sectionKey]: text,
        },
      },
      dirty: true,
    });
  },
}));

export default useProtocolStore;
