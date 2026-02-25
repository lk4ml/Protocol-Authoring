import client from './client';

/**
 * Get the schedule portion of a protocol (encounters, activities, scheduleTimelines).
 * @param {string} protocolId - Protocol UUID.
 * @returns {Promise<Object>} Schedule data with encounters, activities, scheduleTimelines.
 */
export async function getSchedule(protocolId) {
  const response = await client.get(`/protocols/${protocolId}/schedule`);
  return response.data;
}

/**
 * Save the full schedule data. Merges schedule keys into the protocol's study_design_data.
 * @param {string} protocolId - Protocol UUID.
 * @param {Object} data - Schedule data containing encounters, activities, scheduleTimelines.
 * @returns {Promise<Object>} Updated schedule data.
 */
export async function saveSchedule(protocolId, data) {
  const response = await client.put(`/protocols/${protocolId}/schedule`, data);
  return response.data;
}
