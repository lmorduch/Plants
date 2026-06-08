import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getPlants = () => api.get('/plants').then(r => r.data);
export const getPlant = (id) => api.get(`/plants/${id}`).then(r => r.data);
export const createPlant = (data) => api.post('/plants', data).then(r => r.data);
export const updatePlant = (id, data) => api.put(`/plants/${id}`, data).then(r => r.data);
export const deletePlant = (id) => api.delete(`/plants/${id}`).then(r => r.data);

export const getLogs = (plantId) => api.get(`/plants/${plantId}/logs`).then(r => r.data);
export const addLog = (plantId, data) => api.post(`/plants/${plantId}/logs`, data).then(r => r.data);
export const deleteLog = (plantId, logId) => api.delete(`/plants/${plantId}/logs/${logId}`).then(r => r.data);

export const getSchedules = (plantId) => api.get(`/plants/${plantId}/schedules`).then(r => r.data);
export const upsertSchedule = (plantId, type, data) =>
  api.put(`/plants/${plantId}/schedules/${type}`, data).then(r => r.data);

export const getUpcoming = (days = 7) => api.get(`/schedule/upcoming?days=${days}`).then(r => r.data);

export const analyzePlant = (formData) => api.post('/analyze', formData).then(r => r.data);

export default api;
