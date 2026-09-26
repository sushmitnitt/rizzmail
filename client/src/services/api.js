import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Auth Endpoints
export const sendOTP = (phoneNumber) => api.post('/auth/send-otp', { phoneNumber });
export const verifyOTP = (phoneNumber, otp) => api.post('/auth/verify-otp', { phoneNumber, otp });
export const updateProfileAPI = (profileData) => api.post('/auth/update-profile', profileData);
export const deleteMessageAPI = (emailId) => api.delete(`/email/message/${emailId}`);
// Email Endpoints (Aliased to prevent 404s)
export const fetchMessages = (phone) => api.get(`/email/messages/${phone}`);
export const sendEmailAPI = (emailData) => api.post('/email/send', emailData);
export const deleteAccountAPI = (phone) => api.delete(`/email/account/${phone}`);

export default api;