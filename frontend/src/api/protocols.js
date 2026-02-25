import client from './client';

/**
 * Create a new protocol, optionally from a template.
 * @param {Object} data - { template, protocolNumber, fullTitle, shortTitle, phase, studyType, therapeuticArea, indication, sponsorName, sampleSize }
 * @returns {Promise<Object>} The created protocol object.
 */
export async function createProtocol(data) {
  const response = await client.post('/protocols', data);
  return response.data;
}

/**
 * List all protocols (summary view).
 * @returns {Promise<Array>} Array of protocol summaries.
 */
export async function listProtocols() {
  const response = await client.get('/protocols');
  return response.data;
}

/**
 * Get a single protocol by ID (full detail including studyDesignData and narrativeSections).
 * @param {string} id - Protocol UUID.
 * @returns {Promise<Object>} Full protocol object.
 */
export async function getProtocol(id) {
  const response = await client.get(`/protocols/${id}`);
  return response.data;
}

/**
 * Update protocol metadata fields.
 * @param {string} id - Protocol UUID.
 * @param {Object} data - Partial update with any subset of protocol metadata fields.
 * @returns {Promise<Object>} Updated protocol object.
 */
export async function updateProtocol(id, data) {
  const response = await client.put(`/protocols/${id}`, data);
  return response.data;
}

/**
 * Delete a protocol.
 * @param {string} id - Protocol UUID.
 * @returns {Promise<Object>} Deletion confirmation.
 */
export async function deleteProtocol(id) {
  const response = await client.delete(`/protocols/${id}`);
  return response.data;
}
