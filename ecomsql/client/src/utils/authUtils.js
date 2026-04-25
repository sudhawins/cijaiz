// Authentication utility functions
export const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

export const getUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};

export const setAuthToken = (token) => {
  localStorage.setItem('authToken', token);
};

export const setUser = (user) => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  localStorage.removeItem('userPassword');
};

export const hasRole = (requiredRole) => {
  const user = getUser();
  if (!user) return false;
  return user.roleType === requiredRole;
};

export const hasAnyRole = (requiredRoles) => {
  const user = getUser();
  if (!user) return false;
  return requiredRoles.includes(user.roleType);
};

export const isAdmin = () => {
  return hasRole('Administrator');
};
