import axios from 'axios';

const API_URL = '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to handle FormData correctly
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let browser set Content-Type for FormData (includes boundary)
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

// Audio API
export const audioAPI = {
  upload: (formData, folder, impersonatedUserId, options = {}) => {
    // Debug: Check if formData is actually FormData
    if (!(formData instanceof FormData)) {
      console.error('ERROR: formData is not a FormData instance!', typeof formData, formData);
      return Promise.reject(new Error('Invalid formData'));
    }
    
    // Add folder as query parameter
    let queryParams = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    // Add impersonated user ID if present
    if (impersonatedUserId) {
      queryParams += (queryParams ? '&' : '?') + `impersonatedUserId=${impersonatedUserId}`;
    }
    
    return api.post(`/audio/upload${queryParams}`, formData, {
      timeout: 1800000, // 30 min timeout for large uploads
      ...options
    });
  },
  getMyFiles: () => api.get('/audio/my-files'),
  getAllFiles: () => api.get('/audio/all'),
  getUserFiles: (userId) => api.get(`/audio/user/${userId}`),
  getStreamUrl: (id) => `${API_URL}/audio/stream/${id}`,
  delete: (id) => api.delete(`/audio/${id}`),
  updateBroadcastTime: (id, broadcastTime) => api.put(`/audio/${id}/broadcast-time`, { broadcastTime }),
};

// MP3 Tags API
export const mp3TagsAPI = {
  read: (fileId) => api.get(`/mp3tags/${fileId}`),
  write: (fileId, tags) => api.put(`/mp3tags/${fileId}`, tags),
  remove: (fileId) => api.delete(`/mp3tags/${fileId}`),
};

// Folder API
export const folderAPI = {
  getAll: () => api.get('/folders'),
  create: (data) => api.post('/folders', data),
  delete: (id) => api.delete(`/folders/${id}`),
};

// User API
export const userAPI = {
  getAll: () => api.get('/users'),
  create: (userData) => api.post('/users', userData),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  delete: (id) => api.delete(`/users/${id}`),
  updateOwnProfile: (data) => api.patch('/users/profile/me', data),
  updateUserProfile: (userId, data) => api.patch(`/users/${userId}/profile`, data),
};

export default api;
