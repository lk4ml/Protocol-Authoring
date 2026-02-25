import { create } from 'zustand';
import * as referencesApi from '../api/references';
import { parseCtGovResponse } from '../utils/parseCtGovTrial';

/**
 * useReferenceStore — Zustand store for ClinicalTrials.gov reference trials.
 *
 * Manages an array of parsed reference trials attached to the current protocol,
 * the slide-out reference panel state, and fetch/persist actions.
 */
const useReferenceStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────
  trials: [],            // Array of parsed reference trial objects
  activeTrialId: null,   // nctId of the currently displayed trial
  panelOpen: false,      // Whether the slide-out panel is visible
  panelContext: null,     // 'design' | 'eligibility' | 'endpoints' | 'soa'
  loading: false,
  fetchingNct: false,
  error: null,

  // ── Load persisted references from backend ─────────────────────────
  loadReferences: async (protocolId) => {
    if (!protocolId) return;
    set({ loading: true, error: null });
    try {
      const trials = await referencesApi.getReferences(protocolId);
      set({
        trials: trials || [],
        activeTrialId: trials?.length > 0 ? trials[0].nctId : null,
        loading: false,
      });
    } catch (err) {
      console.warn('Failed to load reference trials:', err);
      set({ loading: false, error: err.message });
    }
  },

  // ── Fetch from CT.gov + persist to backend ─────────────────────────
  fetchAndAddTrial: async (nctId, protocolId) => {
    const cleaned = nctId.trim().toUpperCase();
    if (!cleaned) throw new Error('Please enter an NCT ID.');

    // Check for duplicates locally
    if (get().trials.some((t) => t.nctId === cleaned)) {
      throw new Error(`${cleaned} is already added as a reference.`);
    }

    set({ fetchingNct: true, error: null });
    try {
      // Fetch via backend proxy (avoids browser CORS issues)
      const json = await referencesApi.fetchStudyFromCtGov(cleaned);

      // Parse into rich reference object
      const parsed = parseCtGovResponse(json, cleaned);

      // Persist to backend
      if (protocolId) {
        const updatedTrials = await referencesApi.addReference(protocolId, parsed);
        set({
          trials: updatedTrials,
          activeTrialId: cleaned,
          fetchingNct: false,
        });
      } else {
        // Before protocol creation — just add to local state
        set((state) => ({
          trials: [...state.trials, parsed],
          activeTrialId: cleaned,
          fetchingNct: false,
        }));
      }

      return parsed;
    } catch (err) {
      set({ fetchingNct: false, error: err.message });
      throw err;
    }
  },

  // ── Add a pre-parsed trial (for ProtocolPicker flow) ──────────────
  addParsedTrial: (parsedTrial) => {
    if (get().trials.some((t) => t.nctId === parsedTrial.nctId)) return;
    set((state) => ({
      trials: [...state.trials, parsedTrial],
      activeTrialId: parsedTrial.nctId,
    }));
  },

  // ── Persist all local trials to backend (after protocol creation) ──
  persistAllTrials: async (protocolId) => {
    const { trials } = get();
    for (const trial of trials) {
      try {
        await referencesApi.addReference(protocolId, trial);
      } catch {
        // Ignore duplicates (409) during bulk persist
      }
    }
  },

  // ── Remove a reference trial ──────────────────────────────────────
  removeTrial: async (nctId, protocolId) => {
    try {
      if (protocolId) {
        await referencesApi.removeReference(protocolId, nctId);
      }
    } catch {
      // Ignore errors during removal
    }
    set((state) => {
      const remaining = state.trials.filter((t) => t.nctId !== nctId);
      return {
        trials: remaining,
        activeTrialId:
          state.activeTrialId === nctId
            ? remaining.length > 0
              ? remaining[0].nctId
              : null
            : state.activeTrialId,
      };
    });
  },

  // ── Remove locally only (no backend call, for ProtocolPicker) ─────
  removeTrialLocal: (nctId) => {
    set((state) => {
      const remaining = state.trials.filter((t) => t.nctId !== nctId);
      return {
        trials: remaining,
        activeTrialId:
          state.activeTrialId === nctId
            ? remaining.length > 0 ? remaining[0].nctId : null
            : state.activeTrialId,
      };
    });
  },

  // ── UI actions ────────────────────────────────────────────────────
  setActiveTrialId: (nctId) => set({ activeTrialId: nctId }),

  openPanel: (context) =>
    set({ panelOpen: true, panelContext: context || 'design' }),

  closePanel: () => set({ panelOpen: false }),

  togglePanel: (context) =>
    set((s) => ({
      panelOpen: !s.panelOpen || s.panelContext !== context,
      panelContext: context || s.panelContext || 'design',
    })),

  // ── Reset ─────────────────────────────────────────────────────────
  reset: () =>
    set({
      trials: [],
      activeTrialId: null,
      panelOpen: false,
      panelContext: null,
      loading: false,
      fetchingNct: false,
      error: null,
    }),
}));

export default useReferenceStore;
