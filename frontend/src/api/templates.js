import client from './client';

/**
 * List all available protocol templates.
 * @returns {Promise<Array>} Array of template summaries.
 */
export async function listTemplates() {
  const response = await client.get('/templates');
  return response.data;
}

/**
 * Get a specific template by ID with full detail.
 * @param {string} id - Template identifier.
 * @returns {Promise<Object>} Template object.
 */
export async function getTemplate(id) {
  const response = await client.get(`/templates/${id}`);
  return response.data;
}
