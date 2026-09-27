import axios from 'axios';

// Automatically use Render backend in production, fallback to local for development
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://rizzmail-backend.onrender.com/api';

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Auth APIs
export const sendOTP = (phone) => API.post('/auth/send-otp', { phone });
export const verifyOTP = (phone, otp) => API.post('/auth/verify-otp', { phone, otp });
export const updateProfileAPI = (userData) => API.put('/auth/profile', userData);
export const deleteAccountAPI = (phone) => API.delete(`/auth/account/${phone}`);

// Email APIs (Matches the backend routes we just updated)
export const fetchMessages = (phone) => API.get(`/email/messages/${phone}`);
export const sendEmailAPI = (emailData) => API.post('/email/send', emailData);
export const deleteMessageAPI = (id) => API.delete(`/email/message/${id}`);

export default API;