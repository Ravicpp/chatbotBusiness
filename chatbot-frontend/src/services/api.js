import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Note: Authorization headers are set per request where needed (e.g., adminToken for admin routes, rm_token for user routes)

export default API;
