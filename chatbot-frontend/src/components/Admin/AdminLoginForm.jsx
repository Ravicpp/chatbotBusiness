// src/components/Admin/AdminLoginForm.jsx
import React, { useState, useCallback } from 'react';
import API from '../../services/api';
import styles from './Admin.module.css';
import { FiUser, FiLock, FiLogIn, FiRefreshCcw } from 'react-icons/fi'; // Import FiRefreshCcw for spinner

// Utility function for token cleanup
const cleanTokenString = (token) => {
    if (!token || typeof token !== 'string') return null;

    let cleanToken = token.trim();

    // 1. Remove surrounding quotes (e.g., if token was stored as a JSON string)
    cleanToken = cleanToken.replace(/^"(.*)"$/, '$1');

    // 2. Remove "Bearer " prefix if present
    if (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.split(' ')[1];
    }
    
    cleanToken = cleanToken.trim();

    // 3. Final sanity check: JWT should have 3 parts separated by dots
    if (cleanToken.split('.').length !== 3) return null;
    return cleanToken;
};

// Core token sanitizer function
const extractAndSanitizeToken = (responseData) => {
    if (!responseData) return null;

    let rawToken = null;

    // Try common top-level key locations
    if (responseData.token) rawToken = responseData.token;
    else if (responseData.accessToken) rawToken = responseData.accessToken;
    else if (responseData.adminToken) rawToken = responseData.adminToken;
    else if (typeof responseData === 'string') rawToken = responseData;

    // Handle case where raw token might be a stringified object (e.g. from axios data)
    if (typeof rawToken === 'string' && rawToken.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(rawToken);
            rawToken = parsed.token || parsed.accessToken || parsed.adminToken || rawToken;
        } catch (e) {
            // If parsing fails, treat it as the raw token string
        }
    }
    
    // If the token is still an object, try to extract from known keys
    if (typeof rawToken === 'object' && rawToken !== null) {
         rawToken = rawToken.token || rawToken.accessToken || rawToken.adminToken || null;
    }

    return cleanTokenString(rawToken);
};

export default function AdminLoginForm({ onLoginSuccess, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = useCallback(async (e) => {
    e?.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/admin/login', { username, password });
      
      const token = extractAndSanitizeToken(res?.data);

      if (!token) {
        console.error('AdminLoginForm: Token extraction failed for response data:', res.data);
        setError('Login successful, but the security token was not received correctly. Please contact support.');
        setLoading(false);
        return;
      }

      // Store the clean token string
      localStorage.setItem('adminToken', token);

      // Call parent success handler
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(token);
      }
    } catch (err) {
      console.error('Admin login error:', err);
      // Centralized error message extraction
      const msg = err?.response?.data?.message || 'Invalid username or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [username, password, onLoginSuccess]); // Dependencies

  return (
    <form className={styles.adminPanel} onSubmit={handleLogin} data-testid="admin-login-form">
      <h2 className={styles.adminTitle}>🔑 Admin Access</h2>
      <p className={styles.adminDescription}>Secure area. Enter your credentials to manage the system.</p>

      {/* Username Input */}
      <div className={styles.inputGroup}>
        <FiUser className={styles.inputIcon} />
        <input
          className={styles.input}
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          disabled={loading}
          aria-label="Username"
          required
        />
      </div>

      {/* Password Input */}
      <div className={styles.inputGroup}>
        <FiLock className={styles.inputIcon} />
        <input
          className={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading}
          aria-label="Password"
          required
        />
      </div>

      {error && <p className={styles.errorText}>⚠️ {error}</p>}

      {/* Action Buttons */}
      <div className={styles.actionRow}>
        {/* Only show cancel if a cancel function is provided */}
        {onCancel && (
            <button 
                type="button" 
                className={styles.ghostBtn} 
                onClick={onCancel} 
                disabled={loading}
            >
                Cancel
            </button>
        )}
        <button 
            type="submit" 
            className={styles.primaryBtn} 
            disabled={loading}
        >
          {loading ? (
            <span className={styles.loadingBtnContent}>
                <FiRefreshCcw className={styles.spin} /> Logging In...
            </span>
          ) : (
            <><FiLogIn /> Login</>
          )}
        </button>
      </div>
    </form>
  );
}