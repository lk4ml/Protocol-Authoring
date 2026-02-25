import axios from 'axios';

/**
 * CDISC Library API Service
 * Fetches controlled terminology and standards from CDISC Library REST API
 * Documentation: https://www.cdisc.org/cdisc-library
 */
class CDISCLibraryService {
  constructor() {
    // CDISC Library API base URL (public API endpoint)
    // Note: Some endpoints may require authentication for full access
    this.baseUrl = 'https://api.cdisc.org/api';
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get cached data or fetch from API
   */
  async getCachedOrFetch(key, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Fetch controlled terminology by codelist
   * @param {string} codelistName - Name of the codelist (e.g., 'C66731' for Study Phase)
   */
  async getControlledTerminology(codelistName) {
    try {
      // CDISC Library API endpoint for controlled terminology
      // This is a simplified version - actual API may vary
      const response = await axios.get(`${this.baseUrl}/mdr/ct/packages`, {
        params: {
          codelist: codelistName,
          format: 'json'
        }
      });
      return response.data;
    } catch (error) {
      console.warn(`CDISC Library API error for ${codelistName}:`, error.message);
      // Fallback to local cache or return empty array
      return this.getFallbackTerminology(codelistName);
    }
  }

  /**
   * Get Study Phases from CDISC CT
   */
  async getStudyPhases() {
    return this.getCachedOrFetch('studyPhases', async () => {
      try {
        // CDISC CT codelist for Study Phase
        const data = await this.getControlledTerminology('C66731');
        if (data && data.items) {
          return data.items.map(item => ({
            code: item.code,
            decode: item.decode,
            label: item.decode.replace(' Trial', '')
          }));
        }
      } catch (error) {
        console.warn('Failed to fetch study phases from CDISC Library:', error);
      }
      return this.getFallbackTerminology('studyPhases');
    });
  }

  /**
   * Get Study Types from CDISC CT
   */
  async getStudyTypes() {
    return this.getCachedOrFetch('studyTypes', async () => {
      try {
        const data = await this.getControlledTerminology('C98388');
        if (data && data.items) {
          return data.items.map(item => ({
            code: item.code,
            decode: item.decode
          }));
        }
      } catch (error) {
        console.warn('Failed to fetch study types from CDISC Library:', error);
      }
      return this.getFallbackTerminology('studyTypes');
    });
  }

  /**
   * Get Intervention Models from CDISC CT
   */
  async getInterventionModels() {
    return this.getCachedOrFetch('interventionModels', async () => {
      try {
        const data = await this.getControlledTerminology('C82639');
        if (data && data.items) {
          return data.items.map(item => ({
            code: item.code,
            decode: item.decode
          }));
        }
      } catch (error) {
        console.warn('Failed to fetch intervention models from CDISC Library:', error);
      }
      return this.getFallbackTerminology('interventionModels');
    });
  }

  /**
   * Get Blinding Schemas from CDISC CT
   */
  async getBlindingSchemas() {
    return this.getCachedOrFetch('blindingSchemas', async () => {
      try {
        const data = await this.getControlledTerminology('C49656');
        if (data && data.items) {
          return data.items.map(item => ({
            code: item.code,
            decode: item.decode
          }));
        }
      } catch (error) {
        console.warn('Failed to fetch blinding schemas from CDISC Library:', error);
      }
      return this.getFallbackTerminology('blindingSchemas');
    });
  }

  /**
   * Get SDTM Domains
   */
  async getSDTMDomains() {
    return this.getCachedOrFetch('sdtmDomains', async () => {
      try {
        // CDISC Library endpoint for SDTM domains
        const response = await axios.get(`${this.baseUrl}/mdr/sdtm/domains`, {
          params: { format: 'json' }
        });
        if (response.data && response.data.domains) {
          return response.data.domains.map(domain => ({
            id: domain.code,
            name: domain.name,
            class: domain.class
          }));
        }
      } catch (error) {
        console.warn('Failed to fetch SDTM domains from CDISC Library:', error);
      }
      return this.getFallbackTerminology('sdtmDomains');
    });
  }

  /**
   * Get Biomedical Concepts
   * Note: CDISC Biomedical Concepts may be available through CDISC Library or separate API
   */
  async getBiomedicalConcepts(domain = null) {
    return this.getCachedOrFetch(`biomedicalConcepts_${domain || 'all'}`, async () => {
      try {
        // This endpoint may vary - CDISC BC API structure
        const response = await axios.get(`${this.baseUrl}/mdr/biomedical-concepts`, {
          params: {
            domain: domain,
            format: 'json'
          }
        });
        if (response.data && response.data.concepts) {
          return response.data.concepts;
        }
      } catch (error) {
        console.warn('Failed to fetch biomedical concepts from CDISC Library:', error);
      }
      return this.getFallbackTerminology('biomedicalConcepts');
    });
  }

  /**
   * Fallback terminology when API is unavailable
   * These are minimal fallbacks - should be replaced with actual API data
   */
  getFallbackTerminology(type) {
    const fallbacks = {
      studyPhases: [
        { code: 'C49686', decode: 'Phase 0 Trial', label: 'Phase 0' },
        { code: 'C15600', decode: 'Phase I Trial', label: 'Phase I' },
        { code: 'C15693', decode: 'Phase I/II Trial', label: 'Phase I/II' },
        { code: 'C15601', decode: 'Phase II Trial', label: 'Phase II' },
        { code: 'C15694', decode: 'Phase II/III Trial', label: 'Phase II/III' },
        { code: 'C15602', decode: 'Phase III Trial', label: 'Phase III' },
        { code: 'C49688', decode: 'Phase IIIb Trial', label: 'Phase IIIb' },
        { code: 'C15603', decode: 'Phase IV Trial', label: 'Phase IV' },
      ],
      studyTypes: [
        { code: 'C98388', decode: 'Interventional Study' },
        { code: 'C17048', decode: 'Observational Study' },
        { code: 'C15273', decode: 'Expanded Access Study' },
      ],
      interventionModels: [
        { code: 'C82639', decode: 'Parallel' },
        { code: 'C82638', decode: 'Crossover' },
        { code: 'C82636', decode: 'Sequential' },
        { code: 'C82637', decode: 'Factorial' },
        { code: 'C98779', decode: 'Single Group' },
      ],
      blindingSchemas: [
        { code: 'C49656', decode: 'Open Label' },
        { code: 'C49657', decode: 'Single Blind' },
        { code: 'C49658', decode: 'Double Blind' },
        { code: 'C82865', decode: 'Triple Blind' },
      ],
      sdtmDomains: [
        { id: 'DM', name: 'Demographics', class: 'Special-Purpose' },
        { id: 'CO', name: 'Comments', class: 'Special-Purpose' },
        { id: 'SE', name: 'Subject Elements', class: 'Special-Purpose' },
        { id: 'SV', name: 'Subject Visits', class: 'Special-Purpose' },
        { id: 'CM', name: 'Concomitant Medications', class: 'Interventions' },
        { id: 'EX', name: 'Exposure', class: 'Interventions' },
        { id: 'PR', name: 'Procedures', class: 'Interventions' },
        { id: 'AE', name: 'Adverse Events', class: 'Events' },
        { id: 'CE', name: 'Clinical Events', class: 'Events' },
        { id: 'DS', name: 'Disposition', class: 'Events' },
        { id: 'DV', name: 'Protocol Deviations', class: 'Events' },
        { id: 'MH', name: 'Medical History', class: 'Events' },
        { id: 'EG', name: 'ECG Test Results', class: 'Findings' },
        { id: 'IE', name: 'Inclusion/Exclusion', class: 'Findings' },
        { id: 'LB', name: 'Laboratory', class: 'Findings' },
        { id: 'PE', name: 'Physical Exam', class: 'Findings' },
        { id: 'PC', name: 'PK Concentrations', class: 'Findings' },
        { id: 'QS', name: 'Questionnaires', class: 'Findings' },
        { id: 'RS', name: 'Disease Response', class: 'Findings' },
        { id: 'TR', name: 'Tumor Results', class: 'Findings' },
        { id: 'TU', name: 'Tumor Identification', class: 'Findings' },
        { id: 'VS', name: 'Vital Signs', class: 'Findings' },
      ],
      biomedicalConcepts: []
    };
    return fallbacks[type] || [];
  }
}

export default new CDISCLibraryService();

