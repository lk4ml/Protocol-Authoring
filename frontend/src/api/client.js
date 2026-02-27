import axios from 'axios';

/**
 * Central API client.
 *
 * Base URL is read from the Vite env variable VITE_API_BASE_URL.
 * During development this defaults to http://localhost:8001/api
 * (set in .env or .env.local).  In production builds supply the
 * variable at build-time: VITE_API_BASE_URL=https://api.example.com/api
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export { API_BASE_URL };
export default client;
