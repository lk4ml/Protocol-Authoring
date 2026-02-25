import { useState, useEffect } from 'react';
import cdiscLibraryService from '../services/cdiscLibraryService';

/**
 * Custom hook to fetch and manage CDISC data
 */
export function useCDISCData() {
  const [data, setData] = useState({
    phases: [],
    studyTypes: [],
    interventionModels: [],
    blindingSchemas: [],
    sdtmDomains: [],
    biomedicalConcepts: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    async function fetchCDISCData() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }));
        
        const [
          phases,
          studyTypes,
          interventionModels,
          blindingSchemas,
          sdtmDomains,
          biomedicalConcepts
        ] = await Promise.all([
          cdiscLibraryService.getStudyPhases(),
          cdiscLibraryService.getStudyTypes(),
          cdiscLibraryService.getInterventionModels(),
          cdiscLibraryService.getBlindingSchemas(),
          cdiscLibraryService.getSDTMDomains(),
          cdiscLibraryService.getBiomedicalConcepts()
        ]);

        setData({
          phases,
          studyTypes,
          interventionModels,
          blindingSchemas,
          sdtmDomains,
          biomedicalConcepts,
          loading: false,
          error: null
        });
      } catch (error) {
        console.error('Error fetching CDISC data:', error);
        setData(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    }

    fetchCDISCData();
  }, []);

  return data;
}

