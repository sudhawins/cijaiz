import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const API_BASE_URL = API_URL === '/api' ? '' : API_URL.replace('/api', '');

// Log API configuration for debugging
console.log('API_URL:', API_URL);
console.log('API_BASE_URL:', API_BASE_URL);

// Simple cache for GET requests
const responseCache = new Map();

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('[API Interceptor] Auth token added to request:', {
      url: config.url,
      method: config.method,
      tokenPresent: !!token,
      tokenLength: token?.length
    });
  } else {
    console.warn('[API Interceptor] No auth token found in localStorage');
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor for caching and error logging
apiClient.interceptors.response.use((response) => {
  if (response.config.method === 'get') {
    const cacheKey = `${response.config.method}:${response.config.url}`;
    responseCache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now()
    });
  }
  return response;
}, (error) => {
  // Enhanced error logging for auth issues
  if (error.response?.status === 401) {
    const errorData = error.response?.data;
    console.error('[API] 401 Unauthorized Error:', {
      url: error.config?.url,
      message: errorData?.error || error.message,
      details: errorData?.details,
      tokenInStorage: !!localStorage.getItem('authToken'),
      tokenLength: localStorage.getItem('authToken')?.length
    });
    
    // Optionally clear token and redirect to login
    if (errorData?.error?.includes('token')) {
      console.warn('[API] Token-related error detected - user may need to re-login');
    }
  } else {
    console.error('[API] Response error:', error.message, error.response?.status);
  }
  return Promise.reject(error);
});

// Categories
export const getCategories = () => apiClient.get('/categories');
export const getCategoryById = (id) => apiClient.get(`/categories/${id}`);
export const createCategory = (data) => apiClient.post('/categories', data);
export const updateCategory = (id, data) => apiClient.put(`/categories/${id}`, data);
export const deleteCategory = (id) => apiClient.delete(`/categories/${id}`);

// Subcategories
export const getSubcategories = (params) => apiClient.get('/subcategories', { params });
export const getSubcategoryById = (id) => apiClient.get(`/subcategories/${id}`);
export const getSubcategoriesByCategory = (categoryId) => apiClient.get(`/subcategories/category/${categoryId}`);
export const createSubcategory = (data) => apiClient.post('/subcategories', data);
export const updateSubcategory = (id, data) => apiClient.put(`/subcategories/${id}`, data);
export const deleteSubcategory = (id) => apiClient.delete(`/subcategories/${id}`);

// Wishlist
export const addToWishlist = (productId) => apiClient.post('/wishlist', { productId });
export const getWishlist = () => apiClient.get('/wishlist');
export const removeFromWishlist = (productId) => apiClient.delete(`/wishlist/${productId}`);

// Authentication
export const registerUser = (email, password, name, phoneNumber = null, shippingAddress = null) => 
  apiClient.post('/auth/register', { email, password, name, phoneNumber, shippingAddress });

export const loginUser = (email, password) => 
  apiClient.post('/auth/login', { email, password });

export const getCurrentUser = () => 
  apiClient.get('/auth/me');

export const updateUserProfile = (data) =>
  apiClient.put('/auth/me', data);

export const getUserRoles = () => 
  apiClient.get('/auth/roles');

export const logout = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

// Admin - User & Role Management
export const getAllUsers = () => 
  apiClient.get('/auth/users');

export const getAdminUserById = (userId) => 
  apiClient.get(`/auth/users/${userId}`);

export const updateUserRole = (userId, roleId) => 
  apiClient.put(`/auth/users/${userId}/role`, { roleId });

export const resetUserPassword = (userId) =>
  apiClient.put(`/auth/users/${userId}/reset-password`, {});

export const getProducts = (params) => {
  const token = localStorage.getItem('authToken');
  console.log('[getProducts] Calling with params:', params);
  console.log('[getProducts] Token present:', !!token);
  if (token) {
    console.log('[getProducts] Token length:', token.length);
  }
  return apiClient.get('/products', { params });
};
export const getProductById = (id) => apiClient.get(`/products/${id}`);
export const createProduct = (data) => apiClient.post('/products', data);
export const updateProduct = (id, data) => apiClient.put(`/products/${id}`, data);
export const deleteProduct = (id) => apiClient.delete(`/products/${id}`);

// Product Images
export const getProductImages = (productId) => apiClient.get(`/product-images/product/${productId}`);

export const getPrimaryImage = (productId) => apiClient.get(`/product-images/primary/${productId}`);

export const uploadProductImage = (productId, file) => {
  const formData = new FormData();
  formData.append('image', file);
  return apiClient.post(`/product-images/upload/${productId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const uploadProductImages = (productId, files) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('images', file);
  });
  return apiClient.post(`/product-images/bulk-upload/${productId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const deleteProductImage = (imageId) => apiClient.delete(`/product-images/${imageId}`);

export const setProductImagePrimary = (imageId) => apiClient.put(`/product-images/${imageId}/set-primary`);

export const reorderProductImages = (productId, imageOrder) => 
  apiClient.put(`/product-images/reorder/${productId}`, { imageOrder });


// Cart
export const getCartItems = (sessionId) => apiClient.get(`/cart/${sessionId}`);
export const addToCart = (data) => apiClient.post('/cart', data);
export const updateCartItem = (itemId, data) => apiClient.put(`/cart/${itemId}`, data);
export const removeFromCart = (itemId) => apiClient.delete(`/cart/${itemId}`);
export const clearCart = (sessionId) => apiClient.delete(`/cart/session/${sessionId}`);

// Orders
export const getOrders = (params = {}) => apiClient.get('/orders', { params });
export const getSellerOrders = (params = {}) => apiClient.get('/orders/seller/orders', { params });
export const getOrderById = (id) => apiClient.get(`/orders/${id}`);
export const getOrderShippingBreakdown = (id) => apiClient.get(`/orders/${id}/shipping-breakdown`);
export const createOrder = (data) => apiClient.post('/orders', data);
export const updateOrderStatus = (id, data) => apiClient.put(`/orders/${id}`, data);

// Shipping and Cities API
export const getAllCities = () => apiClient.get('/shipping/all');
export const getShippingZones = () => apiClient.get('/shipping/shipping-zones');
export const searchCities = (query) => apiClient.get('/shipping/search', { params: { query } });
export const getCityByName = (cityName) => apiClient.get(`/shipping/by-city/${cityName}`);
export const getCitiesByState = (state) => apiClient.get(`/shipping/by-state/${state}`);
export const getShippingCharge = (zoneCode) => apiClient.get(`/shipping/shipping/${zoneCode}`);
export const getAllStates = () => apiClient.get('/shipping/states/all');
export const getLocationFromIP = () => apiClient.get('/shipping/location-from-ip');
export const getShippingRateByCity = (city, qty = 1, orderAmount = 0) => 
  apiClient.get('/shipping/rate-by-city', { params: { city, qty, orderAmount } });
export const calculateShippingForItems = (city, items) =>
  apiClient.post('/shipping/calculate', { city, items });

// Shipping Management API (Seller & Admin Only)
export const addCity = (cityData) => apiClient.post('/shipping/manage/cities', cityData);
export const updateCity = (id, cityData) => apiClient.put(`/shipping/manage/cities/${id}`, cityData);
export const deleteCity = (id) => apiClient.delete(`/shipping/manage/cities/${id}`);

export const addShippingZone = (zoneData) => apiClient.post('/shipping/manage/zones', zoneData);
export const updateShippingZone = (id, zoneData) => apiClient.put(`/shipping/manage/zones/${id}`, zoneData);
export const deleteShippingZone = (id) => apiClient.delete(`/shipping/manage/zones/${id}`);

// Discount and Rewards API
export const validateCoupon = (code, orderAmount, customerEmail) => 
  apiClient.post('/discounts/validate-coupon', { code, orderAmount, customerEmail });

export const applyCoupon = (orderId, code, discountAmount) => 
  apiClient.post('/discounts/apply-coupon', { orderId, code, discountAmount });

export const getActiveDiscounts = () => apiClient.get('/discounts/active-discounts');

export const getCustomerLoyalty = (customerEmail) => 
  apiClient.get(`/discounts/loyalty/${customerEmail}`);

export const earnRewardPoints = (orderId, customerEmail, orderAmount) => 
  apiClient.post('/discounts/earn-rewards', { orderId, customerEmail, orderAmount });

export const redeemPoints = (customerEmail, pointsToRedeem, orderId) => 
  apiClient.post('/discounts/redeem-points', { customerEmail, pointsToRedeem, orderId });

export const getTierBenefits = (tier) => apiClient.get(`/discounts/tier-benefits/${tier}`);

export const getTransactionHistory = (customerEmail) => 
  apiClient.get(`/discounts/history/${customerEmail}`);

// Seller/Admin Coupon Management API
export const getSellerCoupons = () => apiClient.get('/discounts/seller/coupons');

export const createCoupon = (couponData) => 
  apiClient.post('/discounts/seller/coupons', couponData);

export const updateCoupon = (id, couponData) => 
  apiClient.put(`/discounts/seller/coupons/${id}`, couponData);

export const deleteCoupon = (id) => 
  apiClient.delete(`/discounts/seller/coupons/${id}`);

// Seller/Admin Customer Rewards Management API
export const getSellerCustomers = () => apiClient.get('/discounts/seller/customers');

export const getSellerCustomerDetail = (email) => 
  apiClient.get(`/discounts/seller/customers/${encodeURIComponent(email)}`);

export const adjustCustomerPoints = (customerEmail, pointsAdjustment, reason) => {
  console.log('[API] adjustCustomerPoints called with:', {
    url: `${API_URL}/discounts/seller/adjust-points`,
    customerEmail,
    pointsAdjustment,
    reason
  });
  return apiClient.post('/discounts/seller/adjust-points', { 
    customerEmail, 
    pointsAdjustment, 
    reason 
  }).then(response => {
    console.log('[API] adjustCustomerPoints success:', response.data);
    return response;
  }).catch(error => {
    console.error('[API] adjustCustomerPoints error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.response?.config?.url,
      method: error.response?.config?.method,
      data: error.response?.data
    });
    throw error;
  });
};

export const getCouponStats = () => apiClient.get('/discounts/seller/coupon-stats');

export const getAvailableRewards = (customerEmail) => 
  apiClient.get(`/discounts/available-rewards/${encodeURIComponent(customerEmail)}`);

export const getAllRewards = () => apiClient.get('/discounts/all-rewards');

export const getRewardsStats = () => apiClient.get('/discounts/rewards-stats');

export const getRewardsByStatus = (status) => apiClient.get(`/discounts/rewards-by-status/${status}`);

// Diagnostic endpoint
export const checkDiscountsHealth = () => apiClient.get('/discounts/health');

export { API_BASE_URL };
