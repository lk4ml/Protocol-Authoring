import client from './client';

/**
 * Get clinical trial phases terminology.
 * @returns {Promise<Array>} Array of phase coded values.
 */
export async function getPhases() {
  const response = await client.get('/terminology/phases');
  return response.data;
}

/**
 * Get study types terminology.
 * @returns {Promise<Array>} Array of study type coded values.
 */
export async function getStudyTypes() {
  const response = await client.get('/terminology/study-types');
  return response.data;
}

/**
 * Get epoch types terminology.
 * @returns {Promise<Array>} Array of epoch type coded values.
 */
export async function getEpochTypes() {
  const response = await client.get('/terminology/epoch-types');
  return response.data;
}

/**
 * Get arm types terminology.
 * @returns {Promise<Array>} Array of arm type coded values.
 */
export async function getArmTypes() {
  const response = await client.get('/terminology/arm-types');
  return response.data;
}

/**
 * Get intervention models terminology.
 * @returns {Promise<Array>} Array of intervention model coded values.
 */
export async function getInterventionModels() {
  const response = await client.get('/terminology/intervention-models');
  return response.data;
}

/**
 * Get blinding schemas terminology.
 * @returns {Promise<Array>} Array of blinding schema coded values.
 */
export async function getBlindingSchemas() {
  const response = await client.get('/terminology/blinding-schemas');
  return response.data;
}

/**
 * Get standard SDTM domains terminology.
 * @returns {Promise<Array>} Array of SDTM domain coded values.
 */
export async function getSDTMDomains() {
  const response = await client.get('/terminology/sdtm-domains');
  return response.data;
}

/**
 * Get oncology-specific SDTM domains terminology.
 * @returns {Promise<Array>} Array of oncology domain coded values.
 */
export async function getOncologyDomains() {
  const response = await client.get('/terminology/sdtm-domains/oncology');
  return response.data;
}

/**
 * Get response evaluation criteria terminology.
 * @returns {Promise<Array>} Array of response criteria coded values.
 */
export async function getResponseCriteria() {
  const response = await client.get('/terminology/response-criteria');
  return response.data;
}

/**
 * Get CDISC-sourced activity catalog for Schedule of Activities.
 * Generated from COSMoS Biomedical Concepts and SDTM Dataset Specializations.
 * @returns {Promise<Object>} Object with activities[] and schedulingPatterns[].
 */
export async function getActivityCatalog() {
  const response = await client.get('/terminology/activity-catalog');
  return response.data;
}

/**
 * Get curated procedure library organized by therapeutic area.
 * @returns {Promise<Object>} Object with therapeuticAreas[], coreProcedures[], taProcedures{}.
 */
export async function getProcedureLibrary() {
  const response = await client.get('/terminology/procedure-library');
  return response.data;
}

/**
 * Get procedure burden metrics (time, cost, blood volume, RVU) per procedure.
 * @returns {Promise<Object>} Object with procedures{}, tubeTypes{}, _meta{}.
 */
export async function getProcedureBurden() {
  const response = await client.get('/terminology/procedure-burden');
  return response.data;
}

/**
 * Get SOA hierarchy definitions — groups, subgroups, and auto-assignment rules.
 * @returns {Promise<Object>} Object with soaGroups[], activityGroups[], autoAssignRules{}.
 */
export async function getSoaHierarchy() {
  const response = await client.get('/terminology/soa-hierarchy');
  return response.data;
}
