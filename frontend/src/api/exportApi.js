import client from './client';

/**
 * Export protocol as USDM v3.0 JSON.
 * @param {string} protocolId - Protocol UUID.
 * @returns {Promise<Object>} USDM JSON object.
 */
export async function exportUSDM(protocolId) {
  const response = await client.get(`/protocols/${protocolId}/export/usdm`);
  return response.data;
}

/**
 * Export protocol as ICH M11 document (DOCX). Returns a Blob for download.
 * @param {string} protocolId - Protocol UUID.
 * @returns {Promise<Blob>} DOCX file blob.
 */
export async function exportICHM11(protocolId) {
  const response = await client.get(`/protocols/${protocolId}/export/ich-m11`, {
    responseType: 'blob',
  });
  return response.data;
}
