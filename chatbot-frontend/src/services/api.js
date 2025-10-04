// import axios from 'axios';

// const API = axios.create({
//   baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
// });

// // Note: Authorization headers are set per request where needed (e.g., adminToken for admin routes, rm_token for user routes)

// export default API;

import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  withCredentials: true, // required if backend uses cookies/session auth
});

// Example usage per request:
// API.get('/orders', { headers: { Authorization: `Bearer ${token}` } });

export default API;

