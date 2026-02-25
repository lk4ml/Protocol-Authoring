import client from './client';

/**
 * Get the study design portion of a protocol (arms, epochs, cells, elements, interventionModel, blindingSchema).
 * @param {string} protocolId - Protocol UUID.
 * @returns {Promise<Object>} Design data with studyArms, studyEpochs, studyCells, studyElements, interventionModel, blindingSchema.
 */
export async function getDesign(protocolId) {
  const response = await client.get(`/protocols/${protocolId}/design`);
  return response.data;
}

/**
 * Save the full study design. Merges design keys into the protocol's study_design_data.
 * @param {string} protocolId - Protocol UUID.
 * @param {Object} data - Design data containing studyArms, studyEpochs, studyCells, studyElements, interventionModel, blindingSchema.
 * @returns {Promise<Object>} Updated design data.
 */
export async function saveDesign(protocolId, data) {
  const response = await client.put(`/protocols/${protocolId}/design`, data);
  return response.data;
}
