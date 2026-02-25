import client from './client';

/**
 * Get all reference trials for a protocol.
 */
export async function getReferences(protocolId) {
  const response = await client.get(`/protocols/${protocolId}/references`);
  return response.data;
}

/**
 * Add a parsed reference trial to a protocol.
 * Returns the updated array of all references.
 */
export async function addReference(protocolId, trialData) {
  const response = await client.post(`/protocols/${protocolId}/references`, trialData);
  return response.data;
}

/**
 * Remove a reference trial by NCT ID.
 */
export async function removeReference(protocolId, nctId) {
  const response = await client.delete(`/protocols/${protocolId}/references/${nctId}`);
  return response.data;
}

/**
 * Fetch a study from ClinicalTrials.gov via the backend proxy.
 * Avoids CORS issues and provides better error messages.
 */
export async function fetchStudyFromCtGov(nctId) {
  const response = await client.get(`/ctgov/studies/${nctId}`);
  return response.data;
}
