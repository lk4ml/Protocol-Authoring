import { create } from 'zustand';
import * as terminologyApi from '../api/terminology';

const useTerminologyStore = create((set) => ({
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  phases: [],
  studyTypes: [],
  epochTypes: [],
  armTypes: [],
  interventionModels: [],
  blindingSchemas: [],
  sdtmDomains: [],
  oncologyDomains: [],
  responseCriteria: [],
  activityCatalog: null, // { activities: [], schedulingPatterns: [], _meta: {} }
  procedureLibrary: null, // { therapeuticAreas: [], coreProcedures: [], taProcedures: {} }
  procedureBurden: null, // { procedures: {}, tubeTypes: {}, _meta: {} }
  soaHierarchy: null, // { soaGroups: [], activityGroups: [], autoAssignRules: {} }
  loading: false,

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /**
   * Load all terminology datasets in parallel.
   */
  loadAll: async () => {
    set({ loading: true });
    try {
      const [
        phases,
        studyTypes,
        epochTypes,
        armTypes,
        interventionModels,
        blindingSchemas,
        sdtmDomains,
        oncologyDomains,
        responseCriteria,
        activityCatalog,
        procedureLibrary,
        procedureBurden,
        soaHierarchy,
      ] = await Promise.all([
        terminologyApi.getPhases(),
        terminologyApi.getStudyTypes(),
        terminologyApi.getEpochTypes(),
        terminologyApi.getArmTypes(),
        terminologyApi.getInterventionModels(),
        terminologyApi.getBlindingSchemas(),
        terminologyApi.getSDTMDomains(),
        terminologyApi.getOncologyDomains(),
        terminologyApi.getResponseCriteria(),
        terminologyApi.getActivityCatalog(),
        terminologyApi.getProcedureLibrary(),
        terminologyApi.getProcedureBurden(),
        terminologyApi.getSoaHierarchy(),
      ]);

      set({
        phases,
        studyTypes,
        epochTypes,
        armTypes,
        interventionModels,
        blindingSchemas,
        sdtmDomains,
        oncologyDomains,
        responseCriteria,
        activityCatalog,
        procedureLibrary,
        procedureBurden,
        soaHierarchy,
        loading: false,
      });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
}));

export default useTerminologyStore;
