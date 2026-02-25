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
  const cat = activity.uiCategory || activity.category || '';
  const domain = activity.sdtmDomain || '';

  const rule = rules[cat] || {};
  const soaGroupId = activity.soaGroupId || rule.soaGroup || 'SAFETY';
  const domainMap = rule.domainMap || {};
  const activityGroupId = activity.activityGroupId || domainMap[domain] || defaults[soaGroupId] || null;

  return { ...activity, soaGroupId, activityGroupId };
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
   * If soaGroups/activityGroups aren't persisted yet, initialize from hierarchy terminology.
   */
  loadSchedule: async (protocolId) => {
    set({ loading: true });
    try {
      const data = await scheduleApi.getSchedule(protocolId);
      set({
        encounters: data.encounters || [],
        activities: data.activities || [],
        timelines: data.scheduleTimelines || [],
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
   * Called after both loadSchedule and terminology are loaded.
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

  /**
   * Toggle collapse state for a group (SOA group or activity group).
   */
  toggleCollapse: (groupId) => {
    set((state) => ({
      collapsedGroups: {
        ...state.collapsedGroups,
        [groupId]: !state.collapsedGroups[groupId],
      },
    }));
  },

  /**
   * Expand all groups.
   */
  expandAll: () => set({ collapsedGroups: {} }),

  /**
   * Collapse all groups.
   */
  collapseAll: () => {
    const { soaGroups, activityGroups } = get();
    const collapsed = {};
    soaGroups.forEach(g => { collapsed[g.id] = true; });
    activityGroups.forEach(g => { collapsed[g.id] = true; });
    set({ collapsedGroups: collapsed });
  },

  /**
   * Reorder SOA groups.
   */
  reorderSoaGroups: (orderedIds) => {
    set((state) => ({
      soaGroups: orderedIds.map((id, i) => {
        const group = state.soaGroups.find(g => g.id === id);
        return group ? { ...group, order: i + 1 } : null;
      }).filter(Boolean),
      dirty: true,
    }));
  },

  /**
   * Reorder activity groups within a SOA group.
   */
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

  /**
   * Move an activity to a different activity group (and SOA group).
   */
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

  applyPattern: (activityIds, encounterIds, conditionality = 'mandatory') => {
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
          const exists = instances.some((inst) => {
            const matchEnc = inst.encounterId === encounterId;
            const matchAct =
              inst.activityId === activityId ||
              (Array.isArray(inst.activityIds) && inst.activityIds.includes(activityId));
            return matchEnc && matchAct;
          });

          if (!exists) {
            instances.push({
              id: crypto.randomUUID(),
              activityId,
              encounterId,
              conditionality,
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
          (inst) => inst.activityId !== actId
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

      const idx = instances.findIndex((inst) => {
        const matchEnc = inst.encounterId === encounterId;
        const matchAct =
          inst.activityId === activityId ||
          (Array.isArray(inst.activityIds) && inst.activityIds.includes(activityId));
        return matchEnc && matchAct;
      });

      if (idx === -1) {
        instances.push({
          id: crypto.randomUUID(),
          activityId,
          encounterId,
          conditionality: 'mandatory',
        });
      } else {
        const current = instances[idx];
        const currentCond = current.conditionality || current.defaultConditionId || 'mandatory';
        if (currentCond === 'mandatory') {
          instances[idx] = { ...current, conditionality: 'conditional', defaultConditionId: undefined };
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
