export const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const apiUrl = (path) => `${apiBaseUrl}${path}`;
export const authConfig = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});
