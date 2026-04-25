import axios, { AxiosError, AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5002/api' : 'https://mansion.gnanabi.info/api');

// Interface for upload response
interface UploadResponse {
  photoUrls?: string[];
  proofUrls?: string[];
  [key: string]: any;
}

interface ApiUploadResponse {
  data: UploadResponse;
}

// Log API configuration
console.log('[API Config]', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  resolved_API_URL: API_URL,
  env_mode: import.meta.env.MODE,
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
});

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const ACCESS_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

const triggerAutoLogout = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('auth:logout'));
};

const storeTokens = (token: string, refreshToken?: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

const refreshAccessToken = async (): Promise<string> => {
  const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!storedRefreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await axios.post(`${API_URL}/auth/refresh`, {
    refreshToken: storedRefreshToken,
  });

  const { token, refreshToken } = response.data || {};

  if (!token) {
    throw new Error('Refresh response missing access token');
  }

  storeTokens(token, refreshToken);
  return token;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = (error.config || {}) as any;
    const requestUrl = originalRequest?.url || '';

    if (status !== 401) {
      return Promise.reject(error);
    }

    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh');
    if (isAuthEndpoint || originalRequest._retry) {
      triggerAutoLogout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newToken = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      triggerAutoLogout();
      return Promise.reject(refreshError);
    }
  }
);

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const fetchWithAuthRetry = async (url: string, init: RequestInit, retryAttempted: boolean = false): Promise<Response> => {
  const response = await fetch(url, init);

  if (response.status !== 401) {
    return response;
  }

  if (retryAttempted) {
    triggerAutoLogout();
    return response;
  }

  try {
    const newToken = await refreshAccessToken();
    const nextHeaders = new Headers(init.headers || {});
    nextHeaders.set('Authorization', `Bearer ${newToken}`);
    return fetchWithAuthRetry(url, { ...init, headers: nextHeaders }, true);
  } catch (error) {
    triggerAutoLogout();
    return response;
  }
};

const xhrRequestWithAuthRetry = (
  method: string,
  url: string,
  body: Document | XMLHttpRequestBodyInit | null,
  parseResponse: (responseText: string) => any,
  onProgress?: (progress: number) => void,
  retryAttempted: boolean = false
): Promise<{ data: any }> => {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete);
        }
      });
    }

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve({ data: parseResponse(xhr.responseText) });
        } catch (parseError) {
          reject(new Error('Failed to parse upload response'));
        }
        return;
      }

      if (xhr.status === 401 && !retryAttempted) {
        try {
          await refreshAccessToken();
          const retryResult = await xhrRequestWithAuthRetry(method, url, body, parseResponse, onProgress, true);
          resolve(retryResult);
          return;
        } catch (refreshError) {
          triggerAutoLogout();
          reject(new Error('Session expired. Please log in again.'));
          return;
        }
      }

      if (xhr.status === 401) {
        triggerAutoLogout();
      }

      reject(new Error(`Upload failed with status ${xhr.status}`));
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'));
    });

    xhr.open(method, url, true);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(body);
  });
};

const AZURE_STORAGE_BASE_URL =
  import.meta.env.VITE_AZURE_STORAGE_BASE_URL ||
  'https://complexstore.blob.core.windows.net';

// Get the base API URL for file serving
const getApiBaseUrl = (): string => {
  if (!API_URL) return window.location.origin;
  
  // If API_URL is absolute, extract the base
  if (API_URL.startsWith('http://') || API_URL.startsWith('https://')) {
    const base = API_URL.replace(/\/api\/?$/, ''); // Remove /api suffix
    // console.log('[File URL] Using absolute API base:', base);
    return base;
  }
  
  // If API_URL is relative, use the current origin
  // console.log('[File URL] Using relative API, origin:', window.location.origin);
  return window.location.origin;
};

const extractFileName = (filePath: string): string => {
  if (!filePath) return '';

  try {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const parsedUrl = new URL(filePath);
      return decodeURIComponent(parsedUrl.pathname.split('/').filter(Boolean).pop() || '');
    }
  } catch {
    return '';
  }

  return decodeURIComponent(filePath.split(/[\\/]/).filter(Boolean).pop() || '');
};

// Helper function to construct file URLs
export const getFileUrl = (filePath: string): string => {
  if (!filePath) return '';
  
  // If it's already an absolute URL, return as is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    // console.log('[File URL] Already absolute:', filePath);
    return filePath;
  }
  
  // If it's a path with /, use the API base URL
  if (filePath.startsWith('/')) {
    const baseUrl = getApiBaseUrl();
    const fullUrl = `${baseUrl}${filePath}`;
    // console.log('[File URL] Constructed URL from path:', { filePath, baseUrl, fullUrl });
    return fullUrl;
  }
  
  // Check if the path contains tenantphotos
  if (filePath.includes('tenantphotos')) {
    const baseUrl = getApiBaseUrl();
    const fullUrl = `${baseUrl}/api/${filePath}`;
    // console.log('[File URL] Constructed URL from tenantphotos path:', { filePath, baseUrl, fullUrl });
    return fullUrl;
  }
  
  // For plain filenames, prepend the API tenantphotos path
  const baseUrl = getApiBaseUrl();
  const fullUrl = `${baseUrl}/api/tenantphotos/${filePath}`;
  // console.log('[File URL] Constructed URL from filename:', { filePath, baseUrl, fullUrl });
  return fullUrl;
};

export const getRentalPaymentProofUrl = (
  filePath: string,
  paymentDate?: string | null,
  containerName?: string | null
): string => {
  if (!filePath) return '';

  const fileName = extractFileName(filePath);
  const parsedPaymentDate = paymentDate ? new Date(paymentDate) : null;

  if (fileName && containerName) {
    return `${AZURE_STORAGE_BASE_URL}/${containerName}/${encodeURIComponent(fileName)}`;
  }

  if (fileName && parsedPaymentDate && !Number.isNaN(parsedPaymentDate.getTime())) {
    const derivedContainerName = `${parsedPaymentDate.getFullYear()}${parsedPaymentDate.getMonth() + 1}`;
    return `${AZURE_STORAGE_BASE_URL}/${derivedContainerName}/${encodeURIComponent(fileName)}`;
  }

  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }

  const normalizedPath = filePath.replace(/^\/+/, '');
  const baseUrl = getApiBaseUrl();

  if (normalizedPath.startsWith('api/payments/')) {
    return `${baseUrl}/${normalizedPath}`;
  }

  if (normalizedPath.startsWith('payments/')) {
    return `${baseUrl}/${normalizedPath}`;
  }

  return `${baseUrl}/api/payments/${encodeURIComponent(normalizedPath)}`;
};

export const getGuestCheckinFileUrl = (filePath: string): string => {
  if (!filePath) return '';
  const baseUrl = getApiBaseUrl();
  console.log('[Guest Check-in File URL] Generating URL for:', { filePath, baseUrl });
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    try {
      const parsedUrl = new URL(filePath);
      const fileName = parsedUrl.pathname.split('/').filter(Boolean).pop();
      const isAzureBlobUrl = parsedUrl.hostname.includes('.blob.core.windows.net');
      const isGuestCheckinPath = /(^|\/)(guest-checkin|guest-checkins)(\/|$)/i.test(parsedUrl.pathname);

      if (fileName && (isAzureBlobUrl || isGuestCheckinPath)) {
        return `${baseUrl}/api/guest-checkin/${encodeURIComponent(fileName)}`;
      }
    } catch {
      return filePath;
    }

    return filePath;
  }

  const normalizedPath = filePath.replace(/^\/+/, '');

  if (normalizedPath.startsWith('api/guest-checkin/')) {
    return `${baseUrl}/${normalizedPath}`;
  }

  if (normalizedPath.startsWith('guest-checkin/')) {
    return `${baseUrl}/${normalizedPath}`;
  }

  return `${baseUrl}/api/guest-checkin/${normalizedPath}`;
};

export const getComplaintFileUrl = (filePath: string): string => {
  if (!filePath) return '';

  const baseUrl = getApiBaseUrl();
  console.log('[Complaint File URL] Generating URL for:', { filePath, baseUrl });
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }

  const normalizedPath = filePath.replace(/^\/+/, '');

  if (normalizedPath.startsWith('api/complains/')) {
    return `${baseUrl}/${normalizedPath}`;
  }

  if (normalizedPath.startsWith('complains/')) {
    return `${baseUrl}/${normalizedPath}`;
  }

  return `${baseUrl}/api/complains/${normalizedPath}`;
};

export const apiService = {
  getHealth: () => api.get('/health'),
  getDatabaseStatus: () => api.get('/database/status'),
  getTables: () => api.get('/tables'),
  
  // Authentication APIs
  login: (username: string, password: string) => 
    api.post('/auth/login', { username, password }),
  
  // Tenant Management APIs
  getAllTenantsWithOccupancy: () => api.get('/tenants/with-occupancy'),
  getTenantById: (tenantId: number) => api.get(`/tenants/${tenantId}`),
  getTenantOccupancyHistory: (tenantId: number) => api.get(`/tenants/${tenantId}/occupancy-history`),
  createTenant: (data: any) => api.post('/tenants', data),
  updateTenant: (tenantId: number, data: any) => api.put(`/tenants/${tenantId}`, data),
  deleteTenant: (tenantId: number) => api.delete(`/tenants/${tenantId}`),
  searchTenants: (field: string, query: string) => 
    api.get(`/tenants/search?field=${field}&query=${query}`),
  checkPhoneNumber: (phone: string, excludeTenantId?: number) => {
    let url = `/tenants/check-phone/${encodeURIComponent(phone)}`;
    if (excludeTenantId) {
      url += `?excludeId=${excludeTenantId}`;
    }
    return api.get(url);
  },
  searchCities: (query: string) => 
    api.get(`/cities/search?query=${encodeURIComponent(query)}`),
  uploadTenantFiles: (formData: FormData, onProgress?: (progress: number) => void): Promise<ApiUploadResponse> => {
    console.log('[Tenant Upload] Starting multi-file upload');

    return xhrRequestWithAuthRetry(
      'POST',
      `${API_URL}/tenants/upload`,
      formData,
      (responseText) => JSON.parse(responseText),
      onProgress
    ) as Promise<ApiUploadResponse>;
  },
  
  // Rental Collection APIs
  getRentalSummary: () => api.get('/rental/summary'),
  getUnpaidTenants: () => api.get('/rental/unpaid-tenants'),
  getUnpaidDetails: (month: string) => api.get(`/rental/unpaid-details/${month}`),
  getPaymentsByMonth: (monthYear: string) => api.get(`/rental/payments/${monthYear}`),
  saveRentalReview: (
    occupancyId: number,
    data: { monthYear: string; decision: 'approved' | 'rejected' | null; comment: string | null }
  ) => api.put(`/rental/reviews/${occupancyId}`, data),
  getRentalCollectionByOccupancy: (occupancyId: number) => api.get(`/rental/occupancy/${occupancyId}`),
  getRentalSummaryByOccupancy: (occupancyId: number) => api.get(`/rental/occupancy/${occupancyId}/summary`),
  getPaymentBalance: () => api.get('/rental/payment-balance'),
  updateRentalPayment: (occupancyId: number, data: { collectedAmount: number; month: string }) => 
    api.put(`/rental/payment/${occupancyId}`, data),
  updateRentalRecord: (recordId: number, data: any) => 
    api.put(`/rental/record/${recordId}`, data),
  uploadPaymentScreenshot: (formData: FormData, onProgress?: (progress: number) => void) => {
    console.log('[Payment Upload] Starting payment screenshot upload');
    return xhrRequestWithAuthRetry(
      'POST',
      `${API_URL}/rental/upload-payment`,
      formData,
      (responseText) => JSON.parse(responseText),
      onProgress
    );
  },
  
  // Room Occupancy APIs
  getRoomOccupancyData: () => api.get('/rooms/occupancy'),
  getOccupancyLinks: () => api.get('/occupancy/links'),  // Explicit room-tenant linking
  getVacantRooms: () => api.get('/rooms/vacant'),  // Get list of vacant rooms
  checkoutOccupancy: (occupancyId: number, checkOutDate: string, depositRefunded?: number, charges?: number) => 
    api.post(`/occupancy/${occupancyId}/checkout`, { checkOutDate, depositRefunded, charges }),
  checkInTenant: (tenantId: number, roomId: number, checkInDate: string, checkOutDate: string, rentFixed: number, depositReceived?: number) =>
    api.post('/occupancy/checkin', { tenantId, roomId, checkInDate, checkOutDate, rentFixed, depositReceived }),
  getRooms: () => api.get('/rooms'),
  
  // Complaints Management APIs
  getComplaints: () => api.get('/complaints'),
  getComplaintTypes: () => api.get('/complaints/types'),
  getComplaintStatuses: () => api.get('/complaints/statuses'),
  createComplaint: (data: any) => api.post('/complaints', data),
  updateComplaint: (complaintId: number, data: any) => api.put(`/complaints/${complaintId}`, data),
  deleteComplaint: (complaintId: number) => api.delete(`/complaints/${complaintId}`),
  uploadComplaintFiles: (formData: FormData) => {
    // Use fetch instead of axios for FormData to avoid header issues
    const token = localStorage.getItem('authToken');
    const headers: any = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    // Remove Content-Type header - browser will set it with boundary for FormData
    console.log('[Upload] Starting file upload with FormData');
    
    return fetchWithAuthRetry(`${API_URL}/complaints/upload`, {
      method: 'POST',
      headers: headers,
      body: formData
    })
    .then(response => {
      console.log('[Upload] Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('[Upload] Response data:', data);
      return { data };
    })
    .catch(error => {
      console.error('[Upload] Error:', error);
      throw error;
    });
  },
  updateRoom: (roomId: number, data: { rent: number }) => api.put(`/rooms/${roomId}`, data),

  // Service Details APIs
  getServiceDetails: () => api.get('/services/details'),
  getServiceDetailById: (serviceId: number) => api.get(`/services/details/${serviceId}`),
  createServiceDetail: (data: any) => api.post('/services/details', data),
  updateServiceDetail: (serviceId: number, data: any) => api.put(`/services/details/${serviceId}`, data),
  deleteServiceDetail: (serviceId: number) => api.delete(`/services/details/${serviceId}`),
  searchServiceDetails: (field: string, query: string) => 
    api.get(`/services/details/search?field=${field}&query=${query}`),

  // EB Service Payments APIs
  getEBServicePayments: () => api.get('/services/payments'),
  getEBServicePaymentById: (paymentId: number) => api.get(`/services/payments/${paymentId}`),
  createEBServicePayment: (data: any) => api.post('/services/payments', data),
  updateEBServicePayment: (paymentId: number, data: any) => api.put(`/services/payments/${paymentId}`, data),
  deleteEBServicePayment: (paymentId: number) => api.delete(`/services/payments/${paymentId}`),
  searchEBServicePayments: (field: string, query: string) => 
    api.get(`/services/payments/search?field=${field}&query=${query}`),
  
  // User Management APIs
  getUsers: () => api.get('/users'),
  getUserById: (userId: number) => api.get(`/users/${userId}`),
  createUser: (data: any) => api.post('/users', data),
  updateUser: (userId: number, data: any) => api.put(`/users/${userId}`, data),
  deleteUser: (userId: number) => api.delete(`/users/${userId}`),
  
  // User Role APIs
  getUserRoles: () => api.get('/user-roles'),
  createUserRole: (data: any) => api.post('/user-roles', data),
  deleteUserRole: (userRoleId: number) => api.delete(`/user-roles/${userRoleId}`),
  
  // Role Detail APIs
  getRoleDetails: () => api.get('/roles'),
  getRoleDetailById: (roleId: number) => api.get(`/roles/${roleId}`),
  createRoleDetail: (data: any) => api.post('/roles', data),
  updateRoleDetail: (roleId: number, data: any) => api.put(`/roles/${roleId}`, data),
  deleteRoleDetail: (roleId: number) => api.delete(`/roles/${roleId}`),

  // Transaction APIs
  getTransactions: () => api.get('/transactions'),
  getTransactionById: (transactionId: number) => api.get(`/transactions/${transactionId}`),
  createTransaction: (data: any) => api.post('/transactions', data),
  updateTransaction: (transactionId: number, data: any) => api.put(`/transactions/${transactionId}`, data),
  deleteTransaction: (transactionId: number) => api.delete(`/transactions/${transactionId}`),
  getTransactionTypes: () => api.get('/transaction-types'),

  // Stock Management APIs
  getStockDetails: () => api.get('/stock'),
  getStockById: (stockId: number) => api.get(`/stock/${stockId}`),
  createStock: (data: any) => api.post('/stock', data),
  updateStock: (stockId: number, data: any) => api.put(`/stock/${stockId}`, data),
  deleteStock: (stockId: number) => api.delete(`/stock/${stockId}`),

  // Daily Room Status APIs
  getDailyStatuses: () => api.get('/daily-status'),
  getDailyStatusById: (statusId: number) => api.get(`/daily-status/${statusId}`),
  createDailyStatus: (data: any) => api.post('/daily-status', data),
  updateDailyStatus: (statusId: number, data: any) => api.put(`/daily-status/${statusId}`, data),
  deleteDailyStatus: (statusId: number) => api.delete(`/daily-status/${statusId}`),
  getDailyGuestCheckins: (statusId: number) => api.get(`/daily-status/${statusId}/guest-checkins`),
  createDailyGuestCheckin: (statusId: number, data: {
    guestName: string;
    phoneNumber: string;
    purpose: string;
    visitingRoomNo?: string;
    rentAmount: number;
    depositAmount: number;
    checkInTime?: string;
    proofUrl?: string;
    photoUrl?: string;
  }) => api.post(`/daily-status/${statusId}/guest-checkins`, data),
  updateDailyGuestCheckin: (
    statusId: number,
    guestCheckinId: number,
    data: {
      guestName?: string;
      phoneNumber?: string;
      purpose?: string;
      visitingRoomNo?: string;
      rentAmount?: number;
      depositAmount?: number;
      checkInTime?: string;
      checkOutTime?: string;
      proofUrl?: string;
      photoUrl?: string;
    }
  ) => api.put(`/daily-status/${statusId}/guest-checkins/${guestCheckinId}`, data),
  deleteDailyGuestCheckin: (statusId: number, guestCheckinId: number) =>
    api.delete(`/daily-status/${statusId}/guest-checkins/${guestCheckinId}`),
  uploadGuestCheckinFiles: (statusId: number, guestCheckinId: number, formData: FormData) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetchWithAuthRetry(`${API_URL}/daily-status/${statusId}/guest-checkins/${guestCheckinId}/upload`, {
      method: 'POST',
      headers,
      body: formData
    }).then(response => {
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }
      return response.json();
    }).then(data => ({ data }));
  },
  uploadGuestCheckinFile: (
    statusId: number,
    guestCheckinId: number,
    fieldName: 'proof' | 'photo',
    file: File,
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append(fieldName, file);

    return xhrRequestWithAuthRetry(
      'POST',
      `${API_URL}/daily-status/${statusId}/guest-checkins/${guestCheckinId}/upload`,
      formData,
      (responseText) => JSON.parse(responseText),
      onProgress
    );
  },
  getDailyStatusMedia: (statusId: number) => api.get(`/daily-status/${statusId}/media`),
  getDailyStatusAllMedia: () => api.get('/all-media/'), // New endpoint to fetch all media files
  uploadDailyStatusMedia: (formData: FormData, onProgress?: (progress: number) => void) => {
    console.log('[Upload] Starting daily status media upload');
    return xhrRequestWithAuthRetry(
      'POST',
      `${API_URL}/daily-status/upload`,
      formData,
      (responseText) => JSON.parse(responseText),
      onProgress
    );
  },
  deleteDailyStatusMedia: (mediaId: number) => api.delete(`/daily-status/media/${mediaId}`),

  // Service Room Allocation APIs
  getServiceAllocations: () => api.get('/service-allocations'),
  getServiceAllocationById: (allocationId: number) => api.get(`/service-allocations/${allocationId}`),
  getServiceAllocationsWithPayments: () => api.get('/service-allocations-with-payments'),
  getServiceAllocationsForReading: () => api.get('/service-allocations-for-reading'),
  createServiceAllocation: (data: any) => api.post('/service-allocations', data),
  updateServiceAllocation: (allocationId: number, data: any) => api.put(`/service-allocations/${allocationId}`, data),
  deleteServiceAllocation: (allocationId: number) => api.delete(`/service-allocations/${allocationId}`),

  // Service Consumption APIs
  getServiceConsumption: (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.serviceAllocId) params.append('serviceAllocId', filters.serviceAllocId);
    if (filters?.roomId) params.append('roomId', filters.roomId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    return api.get(`/service-consumption${params.toString() ? '?' + params.toString() : ''}`);
  },
  getServiceConsumptionById: (consumptionId: number) => api.get(`/service-consumption/${consumptionId}`),
  getPreviousMonthEndingReading: (serviceAllocId: number, month: number, year: number) =>
    api.get(`/service-consumption/previous-month-reading/${serviceAllocId}/${month}/${year}`),
  createServiceConsumption: (data: any) => api.post('/service-consumption', data),
  deleteServiceConsumption: (consumptionId: number) => api.delete(`/service-consumption/${consumptionId}`),
  
  // Tenant Service Charges (Pro-Rata Electricity Distribution) APIs
  calculateProRataCharges: (serviceConsumptionId: number, chargePerUnit: number = 15) =>
    api.post(`/tenant-service-charges/calculate/${serviceConsumptionId}`, { chargePerUnit }),
  getTenantChargesForMonth: (billingYear: number, billingMonth: number, tenantId?: number, roomId?: number) => {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenantId', tenantId.toString());
    if (roomId) params.append('roomId', roomId.toString());
    return api.get(`/tenant-service-charges/${billingYear}/${billingMonth}${params.toString() ? '?' + params.toString() : ''}`);
  },
  getRoomBillingSummary: (billingYear: number, billingMonth: number, roomId?: number) => {
    const params = new URLSearchParams();
    if (roomId) params.append('roomId', roomId.toString());
    return api.get(`/room-billing-summary/${billingYear}/${billingMonth}${params.toString() ? '?' + params.toString() : ''}`);
  },
  getMonthlyBillingReport: (billingYear: number, billingMonth: number) =>
    api.get(`/monthly-billing-report/${billingYear}/${billingMonth}`),
  getRoomMonthlyEbReport: (billingYear: number, billingMonth: number, roomId?: number) => {
    const params = new URLSearchParams();
    if (roomId) params.append('roomId', roomId.toString());
    return api.get(`/eb-room-monthly-report/${billingYear}/${billingMonth}${params.toString() ? '?' + params.toString() : ''}`);
  },
  getTenantMonthlyBill: (tenantId: number) =>
    api.get(`/tenant-monthly-bill/${tenantId}`),
  recalculateMonthlyCharges: (billingYear: number, billingMonth: number, chargePerUnit: number = 15) =>
    api.post(`/tenant-service-charges/recalculate/${billingYear}/${billingMonth}`, { chargePerUnit }),
  getAllTenantServiceCharges: (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.billingYear) params.append('billingYear', filters.billingYear);
    if (filters?.billingMonth) params.append('billingMonth', filters.billingMonth);
    if (filters?.tenantId) params.append('tenantId', filters.tenantId);
    if (filters?.roomId) params.append('roomId', filters.roomId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', filters.page);
    if (filters?.limit) params.append('limit', filters.limit);
    return api.get(`/tenant-service-charges${params.toString() ? '?' + params.toString() : ''}`);
  },
  updateChargeStatus: (chargeId: number, status: string, notes?: string) =>
    api.put(`/tenant-service-charges/${chargeId}/status`, { status, notes }),
  
  // Diagnostic APIs
  getRentalSchema: () => api.get('/diagnostic/rental-schema'),
  getRentalSample: () => api.get('/diagnostic/rental-sample'),

  // Azure Blob Storage APIs
  getTenantMainPhotoFromAzure: (tenantId: number, format: 'url' | 'blob' = 'url') => 
    api.get(`/tenants/${tenantId}/main-photo/azure${format === 'url' ? '?format=url' : ''}`),
  getTenantMainPhotoUrl: (tenantId: number) => 
    api.get(`/tenants/${tenantId}/main-photo/azure?format=url`),
};

// Helper functions
export const login = async (username: string, password: string) => {
  const response = await apiService.login(username, password);
  return response.data;
};

export const getRoomOccupancyData = async () => {
  const response = await apiService.getRoomOccupancyData();
  return response.data;
};

export const getOccupancyLinks = async () => {
  const response = await apiService.getOccupancyLinks();
  return response.data;
};

export const getComplaints = async () => {
  const response = await apiService.getComplaints();
  return response.data;
};

export const getComplaintTypes = async () => {
  const response = await apiService.getComplaintTypes();
  return response.data;
};

export const getComplaintStatuses = async () => {
  const response = await apiService.getComplaintStatuses();
  return response.data;
};

export const getRooms = async () => {
  const response = await apiService.getRooms();
  return response.data;
};

export default api;
