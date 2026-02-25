import axios from 'axios';

/**
 * TransCelerate Study Definitions Repository (SDR) Service
 * Integrates with the SDR API for USDM validation and storage
 * Reference: https://github.com/transcelerate/ddf-sdr-api
 */
class SDRService {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
    this.apiVersion = 'v5';
  }

  /**
   * Create a study definition in SDR
   * @param {Object} usdm - USDM v4.0 compliant study definition
   * @returns {Promise<Object>} Created study with ID
   */
  async createStudy(usdm) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.apiVersion}/studydefinitions`,
        usdm,
        {
          headers: {
            'Content-Type': 'application/json',
            'usdmVersion': '4.0'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('SDR Create Error:', error);
      if (error.response) {
        throw new Error(`SDR API Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Get study definition by ID
   * @param {string} studyId - Study definition ID
   */
  async getStudy(studyId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.apiVersion}/studydefinitions/${studyId}`
      );
      return response.data;
    } catch (error) {
      console.error('SDR Get Error:', error);
      throw error;
    }
  }

  /**
   * Update study definition
   * @param {string} studyId - Study definition ID
   * @param {Object} usdm - Updated USDM study definition
   */
  async updateStudy(studyId, usdm) {
    try {
      const response = await axios.put(
        `${this.baseUrl}/${this.apiVersion}/studydefinitions/${studyId}`,
        usdm,
        {
          headers: {
            'Content-Type': 'application/json',
            'usdmVersion': '4.0'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('SDR Update Error:', error);
      throw error;
    }
  }

  /**
   * Validate USDM study definition
   * @param {Object} usdm - USDM study definition to validate
   * @returns {Promise<Object>} Validation results with errors and warnings
   */
  async validateUSDM(usdm) {
    const errors = [];
    const warnings = [];

    // Basic USDM v4.0 validation
    if (!usdm.study?.studyTitle?.text) {
      errors.push({
        field: 'study.studyTitle',
        message: 'Study title is required'
      });
    }

    if (!usdm.study?.studyIdentifiers?.length) {
      errors.push({
        field: 'study.studyIdentifiers',
        message: 'At least one study identifier is required'
      });
    }

    if (!usdm.study?.studyDesigns?.length) {
      errors.push({
        field: 'study.studyDesigns',
        message: 'At least one study design is required'
      });
    }

    const design = usdm.study?.studyDesigns?.[0];
    if (design) {
      if (!design.scheduledTimelines?.length) {
        warnings.push({
          field: 'scheduledTimelines',
          message: 'No timeline defined - study schedule may be incomplete'
        });
      }

      if (!design.studyArms?.length) {
        warnings.push({
          field: 'studyArms',
          message: 'No study arms defined'
        });
      }

      if (!design.studyEpochs?.length) {
        warnings.push({
          field: 'studyEpochs',
          message: 'No study epochs defined'
        });
      }

      if (!design.studyPopulations?.length) {
        warnings.push({
          field: 'studyPopulations',
          message: 'No study population defined'
        });
      }
    }

    // Try to validate via SDR API if available
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.apiVersion}/studydefinitions/validate`,
        usdm,
        {
          headers: {
            'Content-Type': 'application/json',
            'usdmVersion': '4.0'
          }
        }
      );
      if (response.data) {
        return {
          valid: response.data.valid || errors.length === 0,
          errors: response.data.errors || errors,
          warnings: response.data.warnings || warnings,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      // If validation endpoint doesn't exist, use local validation
      console.warn('SDR validation endpoint not available, using local validation');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Search studies
   * @param {Object} filters - Search filters
   */
  async searchStudies(filters = {}) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.apiVersion}/studydefinitions`,
        { params: filters }
      );
      return response.data;
    } catch (error) {
      console.error('SDR Search Error:', error);
      throw error;
    }
  }
}

export default new SDRService();

