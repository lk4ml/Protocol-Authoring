import { create } from 'zustand';
import * as scheduleApi from '../api/schedule';

/**
 * Auto-assign soaGroupId and activityGroupId to an activity based on
 * its uiCategory and sdtmDomain, using the hierarchy rules.
 */
function autoAssignHierarchy(activity, soaHierarchy) {
  if (!soaHierarchy?.autoAssignRules) return activity;

  // If activity already has hierarchy assignments from the procedure library, keep them
  if (activity.soaGroupId && activity.activityGroupId) return activity;

  const rules = soaHierarchy.autoAssignRules.byCategoryAndDomain || {};
  const defaults = soaHierarchy.autoAssignRules.defaultActivityGroup || {};
  const nameOverrides = soaHierarchy.autoAssignRules.nameOverrides || {};
  const cat = activity.uiCategory || activity.category || '';
  const domain = activity.sdtmDomain || '';
  const name = activity.name || '';

  // Check name-based overrides first (e.g. "Informed Consent" → CONSENT)
  const nameOverrideGroup = nameOverrides[name];

  const rule = rules[cat] || {};
  const soaGroupId = activity.soaGroupId || rule.soaGroup || 'SAFETY';
  const domainMap = rule.domainMap || {};
  const activityGroupId = activity.activityGroupId || nameOverrideGroup || domainMap[domain] || defaults[soaGroupId] || null;

  // Resolve the soaGroupId from the activityGroup's parent if we have hierarchy data
  const activityGroups = soaHierarchy.activityGroups || [];
  const matchedGroup = activityGroups.find(g => g.id === activityGroupId);
  const resolvedSoaGroupId = matchedGroup?.soaGroupId || soaGroupId;

  return { ...activity, soaGroupId: resolvedSoaGroupId, activityGroupId };
}

/**
 * Normalize a schedule instance to canonical schema.
 *
 * Canonical: { activityIds: [string], defaultConditionId: string }
 * Legacy:    { activityId: string, conditionality: string }
 *
 * This ensures the frontend always uses canonical form regardless of
 * what the backend returns (backward compat with old data).
 */
function normalizeInstance(inst) {
  const normalized = { ...inst };

  // activityId (singular) -> activityIds (list)
  if (!normalized.activityIds && normalized.activityId) {
    normalized.activityIds = [normalized.activityId];
    delete normalized.activityId;
  }
  if (!normalized.activityIds) {
    normalized.activityIds = [];
  }

  // conditionality -> defaultConditionId
  if (!normalized.defaultConditionId && normalized.conditionality) {
    normalized.defaultConditionId = normalized.conditionality;
    delete normalized.conditionality;
  }
  if (!normalized.defaultConditionId) {
    normalized.defaultConditionId = 'mandatory';
  }

  return normalized;
}

/**
 * Check if an instance matches a given activityId + encounterId.
 */
function instanceMatches(inst, activityId, encounterId) {
  if (inst.encounterId !== encounterId) return false;
  // Canonical: activityIds (list)
  if (Array.isArray(inst.activityIds) && inst.activityIds.includes(activityId)) return true;
  return false;
}

const useScheduleStore = create((set, get) => ({
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  encounters: [],
  activities: [],
  timelines: [],
  soaGroups: [],       // persisted: [{id, name, order, colorBg, ...}]
  activityGroups: [],  // persisted: [{id, name, soaGroupId, order}]
  collapsedGroups: {}, // UI-only: { [soaGroupId]: bool, [activityGroupId]: bool }
  dirty: false,
  loading: false,

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /**
   * Load schedule data from the backend.
   * Normalizes all instances to canonical schema on load.
   */
  loadSchedule: async (protocolId) => {
    set({ loading: true });
    try {
      const data = await scheduleApi.getSchedule(protocolId);

      // Normalize all timeline instances to canonical form
      const timelines = (data.scheduleTimelines || []).map((tl) => ({
        ...tl,
        instances: (tl.instances || []).map(normalizeInstance),
      }));

      set({
        encounters: data.encounters || [],
        activities: data.activities || [],
        timelines,
        soaGroups: data.soaGroups || [],
        activityGroups: data.activityGroups || [],
        dirty: false,
        loading: false,
      });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  /**
   * Initialize SOA hierarchy from terminology if not already persisted.
   */
  initHierarchyFromTerminology: (soaHierarchy) => {
    const { soaGroups, activityGroups } = get();
    if (soaGroups.length === 0 && soaHierarchy?.soaGroups) {
      set({
        soaGroups: soaHierarchy.soaGroups.map(g => ({ ...g })),
        activityGroups: (soaHierarchy.activityGroups || []).map(g => ({ ...g })),
        dirty: true,
      });
    }
  },

  toggleCollapse: (groupId) => {
    set((state) => ({
      collapsedGroups: {
        ...state.collapsedGroups,
        [groupId]: !state.collapsedGroups[groupId],
      },
    }));
  },

  expandAll: () => set({ collapsedGroups: {} }),

  collapseAll: () => {
    const { soaGroups, activityGroups } = get();
    const collapsed = {};
    soaGroups.forEach(g => { collapsed[g.id] = true; });
    activityGroups.forEach(g => { collapsed[g.id] = true; });
    set({ collapsedGroups: collapsed });
  },

  reorderSoaGroups: (orderedIds) => {
    set((state) => ({
      soaGroups: orderedIds.map((id, i) => {
        const group = state.soaGroups.find(g => g.id === id);
        return group ? { ...group, order: i + 1 } : null;
      }).filter(Boolean),
      dirty: true,
    }));
  },

  reorderActivityGroups: (soaGroupId, orderedIds) => {
    set((state) => ({
      activityGroups: state.activityGroups.map(g => {
        if (g.soaGroupId !== soaGroupId) return g;
        const idx = orderedIds.indexOf(g.id);
        return idx >= 0 ? { ...g, order: idx + 1 } : g;
      }),
      dirty: true,
    }));
  },

  moveActivity: (activityId, targetGroupId, targetSoaGroupId) => {
    set((state) => ({
      activities: state.activities.map(a =>
        (a.id === activityId)
          ? { ...a, activityGroupId: targetGroupId, soaGroupId: targetSoaGroupId }
          : a
      ),
      dirty: true,
    }));
  },

  // -----------------------------------------------------------------------
  // Encounter (Visit) actions
  // -----------------------------------------------------------------------

  addEncounter: (encounter) => {
    const newEncounter = {
      id: encounter.id || crypto.randomUUID(),
      ...encounter,
    };
    set((state) => ({
      encounters: [...state.encounters, newEncounter],
      dirty: true,
    }));
  },

  removeEncounter: (encId) => {
    set((state) => ({
      encounters: state.encounters.filter((e) => e.id !== encId),
      timelines: state.timelines.map((tl) => ({
        ...tl,
        instances: (tl.instances || []).filter(
          (inst) => inst.encounterId !== encId
        ),
      })),
      dirty: true,
    }));
  },

  updateEncounter: (encId, updates) => {
    set((state) => ({
      encounters: state.encounters.map((e) =>
        e.id === encId ? { ...e, ...updates } : e
      ),
      dirty: true,
    }));
  },

  // -----------------------------------------------------------------------
  // Activity actions (with auto-hierarchy assignment)
  // -----------------------------------------------------------------------

  addActivity: (activity, soaHierarchy) => {
    const enriched = autoAssignHierarchy(activity, soaHierarchy);
    const newActivity = {
      id: enriched.id || crypto.randomUUID(),
      ...enriched,
    };
    set((state) => ({
      activities: [...state.activities, newActivity],
      dirty: true,
    }));
  },

  addActivities: (activitiesArray, soaHierarchy) => {
    const newActivities = activitiesArray.map((activity) => {
      const enriched = autoAssignHierarchy(activity, soaHierarchy);
      return {
        id: enriched.id || crypto.randomUUID(),
        ...enriched,
      };
    });
    set((state) => ({
      activities: [...state.activities, ...newActivities],
      dirty: true,
    }));
    return newActivities;
  },

  applyPattern: (activityIds, encounterIds, defaultConditionId = 'mandatory') => {
    set((state) => {
      let timelines = [...state.timelines];

      if (timelines.length === 0) {
        timelines = [
          {
            id: crypto.randomUUID(),
            name: 'Main Timeline',
            instances: [],
            timings: [],
          },
        ];
      }

      const timeline = { ...timelines[0] };
      const instances = [...(timeline.instances || [])];

      activityIds.forEach((activityId) => {
        encounterIds.forEach((encounterId) => {
          const exists = instances.some((inst) =>
            instanceMatches(inst, activityId, encounterId)
          );

          if (!exists) {
            instances.push({
              id: crypto.randomUUID(),
              activityIds: [activityId],
              encounterId,
              defaultConditionId,
            });
          }
        });
      });

      timeline.instances = instances;
      timelines[0] = timeline;

      return { timelines, dirty: true };
    });
  },

  removeActivity: (actId) => {
    set((state) => ({
      activities: state.activities.filter((a) => a.id !== actId),
      timelines: state.timelines.map((tl) => ({
        ...tl,
        instances: (tl.instances || []).filter(
          (inst) => !(Array.isArray(inst.activityIds) && inst.activityIds.includes(actId))
        ),
      })),
      dirty: true,
    }));
  },

  updateActivity: (actId, updates) => {
    set((state) => ({
      activities: state.activities.map((a) =>
        a.id === actId ? { ...a, ...updates } : a
      ),
      dirty: true,
    }));
  },

  toggleInstance: (activityId, encounterId) => {
    set((state) => {
      let timelines = [...state.timelines];

      if (timelines.length === 0) {
        timelines = [
          {
            id: crypto.randomUUID(),
            name: 'Main Timeline',
            instances: [],
            timings: [],
          },
        ];
      }

      const timeline = { ...timelines[0] };
      const instances = [...(timeline.instances || [])];

      const idx = instances.findIndex((inst) =>
        instanceMatches(inst, activityId, encounterId)
      );

      if (idx === -1) {
        // Add new instance (canonical form)
        instances.push({
          id: crypto.randomUUID(),
          activityIds: [activityId],
          encounterId,
          defaultConditionId: 'mandatory',
        });
      } else {
        const current = instances[idx];
        const currentCond = current.defaultConditionId || 'mandatory';
        if (currentCond === 'mandatory') {
          instances[idx] = { ...current, defaultConditionId: 'conditional' };
        } else {
          instances.splice(idx, 1);
        }
      }

      timeline.instances = instances;
      timelines[0] = timeline;

      return { timelines, dirty: true };
    });
  },

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  saveSchedule: async (protocolId) => {
    const { encounters, activities, timelines, soaGroups, activityGroups } = get();
    set({ loading: true });
    try {
      await scheduleApi.saveSchedule(protocolId, {
        encounters,
        activities,
        scheduleTimelines: timelines,
        soaGroups,
        activityGroups,
      });
      set({ dirty: false, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
}));

export default useScheduleStore;
