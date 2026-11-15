/**
 * PharmaCare Pro API Client
 * Wraps all REST API calls with JWT management
 */
const API = (() => {
  const BASE_URL = '/api';

  function getToken() {
    return localStorage.getItem('pharma_token') || '';
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem('pharma_token', token);
    } else {
      localStorage.removeItem('pharma_token');
    }
  }

  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = options.headers || {};

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err.message);
      throw err;
    }
  }

  return {
    getToken,
    setToken,

    // Health
    getHealth: () => request('/health'),

    // Auth
    register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    getMe: () => request('/auth/me'),

    // Categories
    getCategories: () => request('/categories'),
    createCategory: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

    // Medicines
    getMedicines: (params = {}) => {
      const query = new URLSearchParams();
      if (params.search) query.append('search', params.search);
      if (params.category) query.append('category', params.category);
      if (params.requiresPrescription !== undefined && params.requiresPrescription !== '') {
        query.append('requiresPrescription', params.requiresPrescription);
      }
      if (params.page) query.append('page', params.page);
      if (params.limit) query.append('limit', params.limit);
      return request(`/medicines?${query.toString()}`);
    },
    getMedicineById: (id) => request(`/medicines/${id}`),
    createMedicine: (data) => request('/medicines', { method: 'POST', body: JSON.stringify(data) }),
    updateMedicine: (id, data) => request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMedicine: (id) => request(`/medicines/${id}`, { method: 'DELETE' }),

    // Batches
    getBatches: (medicineId) => request(medicineId ? `/batches?medicineId=${medicineId}` : '/batches'),
    getExpiringBatches: (days = 30) => request(`/batches/expiring?days=${days}`),
    createBatch: (data) => request('/batches', { method: 'POST', body: JSON.stringify(data) }),
    updateBatch: (id, data) => request(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBatch: (id) => request(`/batches/${id}`, { method: 'DELETE' }),

    // Prescriptions
    uploadPrescription: (formData) => request('/prescriptions', { method: 'POST', body: formData }),
    getMyPrescriptions: () => request('/prescriptions/my'),
    getAllPrescriptions: (status) => request(status ? `/prescriptions?status=${status}` : '/prescriptions'),
    reviewPrescription: (id, status) => request(`/prescriptions/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status }) }),

    // Orders
    createOrder: (orderData) => request('/orders', { method: 'POST', body: JSON.stringify(orderData) }),
    getMyOrders: () => request('/orders/my'),
    getOrderById: (id) => request(`/orders/${id}`),
    getAllOrders: (params = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.append('status', params.status);
      if (params.userId) query.append('userId', params.userId);
      return request(`/orders?${query.toString()}`);
    },
    updateOrderStatus: (id, status) => request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

    // Payments
    processPayment: (orderId, method) => request('/payments', { method: 'POST', body: JSON.stringify({ order_id: orderId, method }) }),
    getPaymentByOrderId: (orderId) => request(`/payments/order/${orderId}`),

    // Reports
    getSalesReport: (from, to) => {
      const q = new URLSearchParams();
      if (from) q.append('from', from);
      if (to) q.append('to', to);
      return request(`/reports/sales?${q.toString()}`);
    },
    getLowStockReport: (threshold = 10) => request(`/reports/low-stock?threshold=${threshold}`),
    getTopMedicinesReport: (limit = 5) => request(`/reports/top-medicines?limit=${limit}`),

    // Users (Admin)
    getUsers: () => request('/users'),
    getUserById: (id) => request(`/users/${id}`),
    updateUserRole: (id, role) => request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

    // AI Subsystem (Role-Based Assistant)
    sendAiChat: (message, conversationHistory = []) => request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationHistory })
    })
  };
})();

