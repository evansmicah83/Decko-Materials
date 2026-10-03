import { CreateMaterialPayload, MaterialRequest, Material, InventoryBalance, InventoryTransaction, TrackedUnit, Team, Project, Warehouse, AppNotification, AuditLogRecord } from '../types';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = (configuredApiBase || '/api/v1').replace(/\/+$/, '');
const apiBaseIsValidForProduction = (() => {
  if (!import.meta.env.PROD) return true;
  if (!configuredApiBase) return true;
  if (configuredApiBase.startsWith('/api/v1') && !configuredApiBase.startsWith('//')) return true;
  try {
    const apiUrl = new URL(configuredApiBase);
    return apiUrl.protocol === 'https:' && apiUrl.pathname.replace(/\/+$/, '').endsWith('/api/v1');
  } catch {
    return false;
  }
})();

export function getStoredToken(): string | null {
  return localStorage.getItem('decko_token');
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem('decko_token', token);
  } else {
    localStorage.removeItem('decko_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!apiBaseIsValidForProduction) {
    throw new Error('The API URL is invalid. Use the same-origin /api/v1 route or an HTTPS backend URL ending in /api/v1.');
  }

  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error(`Unable to reach the API at ${API_BASE}. Check that the backend is running and allows requests from this website.`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`The API returned a non-JSON response (HTTP ${res.status}). Check that the Vercel API function is deployed.`);
  }

  const data = await res.json();

  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (data: {
    fullName: string;
    email: string;
    employeeId: string;
    phoneNumber?: string;
    role?: string;
    department?: string;
    teamId?: string;
    projectIds?: string[];
    roleTitle?: string;
    password: string;
    confirmPassword?: string;
  }) =>
    request<{ success: boolean; user: any; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  login: (identifier: string, password: string, rememberMe?: boolean) =>
    request<{ success: boolean; token: string; refreshToken?: string; mustChangePassword?: boolean; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, rememberMe })
    }),

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    request<{ success: boolean; token: string; user: any; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    }),

  forgotPassword: (identifier: string) =>
    request<{ success: boolean; message: string; resetToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier })
    }),

  resetPassword: (resetToken: string, newPassword: string, confirmPassword: string) =>
    request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword, confirmPassword })
    }),

  logout: () =>
    request<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST'
    }),

  switchPersona: (role?: string, email?: string) =>
    request<{ success: boolean; token: string; user: any }>('/auth/switch-persona', {
      method: 'POST',
      body: JSON.stringify({ role, email })
    }),

  getMe: () => request<{ success: boolean; user: any }>('/auth/me'),
  getUsers: () => request<{ success: boolean; users: any[] }>('/auth/users'),

  // Material Requests
  getRequests: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ success: boolean; total: number; requests: MaterialRequest[] }>(`/material-requests${qs ? `?${qs}` : ''}`);
  },

  getRequest: (id: string) => request<{ success: boolean; request: MaterialRequest }>(`/material-requests/${id}`),

  createRequest: (payload: any) =>
    request<{ success: boolean; message: string; requestId: string; requestNumber: string }>('/material-requests', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  submitRequest: (id: string) =>
    request<{ success: boolean; message: string; newStatus: string }>(`/material-requests/${id}/submit`, {
      method: 'POST'
    }),

  reviewRequest: (id: string) =>
    request<{ success: boolean; message: string; newStatus: string }>(`/material-requests/${id}/review`, {
      method: 'POST'
    }),

  approveRequest: (id: string, payload: { comment?: string; approvedItems?: Record<string, number> }) =>
    request<{ success: boolean; message: string; newStatus: string }>(`/material-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  rejectRequest: (id: string, reason: string) =>
    request<{ success: boolean; message: string; newStatus: string }>(`/material-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  clarifyRequest: (id: string, comment: string) =>
    request<{ success: boolean; message: string; newStatus: string }>(`/material-requests/${id}/clarification`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    }),

  recordPayment: (id: string, payload: { amount?: number; paymentMethod: string; paymentReference: string; notes?: string; receiptEvidence?: string }) =>
    request<{ success: boolean; message: string; newStatus: string }>(`/material-requests/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  issueMaterials: (id: string, payload: { recipientName: string; recipientId?: string; signature?: string; issuedItems: any[] }) =>
    request<{ success: boolean; message: string; newStatus: string }>(`/material-requests/${id}/issue`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  confirmReceipt: (id: string, payload: { notes?: string; digitalSignature?: string }) =>
    request<{ success: boolean; message: string; newStatus: string }>(`/material-requests/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  recordConsumption: (id: string, consumptions: any[]) =>
    request<{ success: boolean; message: string }>(`/material-requests/${id}/consumption`, {
      method: 'POST',
      body: JSON.stringify({ consumptions })
    }),

  recordReturn: (id: string, items: any[]) =>
    request<{ success: boolean; message: string }>(`/material-requests/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ items })
    }),

  // Materials Master
  getMaterials: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ success: boolean; count: number; materials: Material[] }>(`/materials${qs ? `?${qs}` : ''}`);
  },

  getMaterialCategories: () => request<{ success: boolean; categories: { code: string; label: string }[] }>('/materials/categories'),

  createMaterial: (payload: CreateMaterialPayload) =>
    request<{ success: boolean; message: string; id: string }>('/materials', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Inventory
  getInventoryBalances: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ success: boolean; count: number; balances: InventoryBalance[] }>(`/inventory/balances${qs ? `?${qs}` : ''}`);
  },

  getInventoryTransactions: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ success: boolean; count: number; transactions: InventoryTransaction[] }>(`/inventory/transactions${qs ? `?${qs}` : ''}`);
  },

  getWarehouses: () => request<{ success: boolean; warehouses: Warehouse[] }>('/inventory/warehouses'),

  createWarehouse: (data: { code: string; name: string; location: string; manager?: string }) =>
    request<{ success: boolean; message: string; warehouse: Warehouse }>('/inventory/warehouses', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  adjustStock: (payload: any) =>
    request<{ success: boolean; message: string; previousStock: number; newStock: number }>('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getTrackedUnits: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ success: boolean; count: number; units: TrackedUnit[] }>(`/inventory/tracked-units${qs ? `?${qs}` : ''}`);
  },

  getChainOfCustody: (serial: string) =>
    request<{ success: boolean; unit: any; chain: any[] }>(`/inventory/chain-of-custody/${encodeURIComponent(serial)}`),

  // Teams & Projects
  getTeams: () => request<{ success: boolean; teams: Team[] }>('/teams'),
  getAvailableLeaders: () => request<{ success: boolean; leaders: any[] }>('/teams/leaders/available'),
  createTeam: (data: {
    teamCode: string;
    name: string;
    leaderId?: string | null;
    projectId: string;
    regionId?: string | null;
    regionName?: string | null;
    assignedArea?: string | null;
    contactInfo?: string | null;
  }) => request<{ success: boolean; message: string; team: Team }>('/teams', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTeam: (id: string, data: any) => request<{ success: boolean; message: string }>(`/teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  getTeamMembers: (teamId: string) => request<{ success: boolean; members: any[] }>(`/teams/${teamId}/members`),
  addTeamMember: (teamId: string, data: {
    fullName: string;
    phoneNumber?: string;
    employeeId?: string;
    roleTitle?: string;
    nationalId?: string;
    joinedAt?: string;
  }) => request<{ success: boolean; message: string; member: any }>(`/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteTeamMember: (teamId: string, memberId: string) => request<{ success: boolean; message: string }>(`/teams/${teamId}/members/${memberId}`, {
    method: 'DELETE'
  }),
  getTeamStock: (teamId: string) => request<{ success: boolean; stocks: any[]; tools: any[] }>(`/teams/${teamId}/stock`),
  getProjects: () => request<{ success: boolean; projects: Project[] }>('/projects'),
  createProject: (data: {
    projectCode: string;
    name: string;
    networkType: 'FTTH' | 'FTTB';
    client: string;
    regionName: string;
    budget?: number;
    status?: string;
    contractStartDate: string;
    contractEndDate: string;
  }) => request<{ success: boolean; message: string; project: Project }>('/projects', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateProject: (id: string, data: {
    projectCode: string;
    name: string;
    networkType: 'FTTH' | 'FTTB';
    client: string;
    regionName: string;
    budget: number;
    status: string;
    contractStartDate: string;
    contractEndDate: string;
  }) => request<{ success: boolean; message: string; project: Project }>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteProject: (id: string) => request<{ success: boolean; message: string }>(`/projects/${id}`, {
    method: 'DELETE'
  }),
  getProjectStats: (projectId: string) => request<{ success: boolean; project: Project; statusBreakdown: any[]; topMaterials: any[] }>(`/projects/${projectId}/stats`),

  // Reports
  getReportsSummary: () => request<{ success: boolean; summary: any }>('/reports/summary'),
  getSafaricomReport: () => request<{ success: boolean; records: any[] }>('/reports/safaricom-tracking'),
  getConsumptionReport: () => request<{ success: boolean; records: any[] }>('/reports/material-consumption'),

  // Audit Logs
  getAuditLogs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ success: boolean; count: number; logs: AuditLogRecord[] }>(`/audit-logs${qs ? `?${qs}` : ''}`);
  },

  // Notifications
  getNotifications: () => request<{ success: boolean; unreadCount: number; notifications: AppNotification[] }>('/notifications'),
  markNotificationRead: (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request<{ success: boolean }>('/notifications/read-all', { method: 'POST' }),

  // Search & Settings
  globalSearch: (q: string) => request<{ success: boolean; results: any }>(`/search?q=${encodeURIComponent(q)}`),
  getSettings: () => request<{ success: boolean; settings: Record<string, string> }>('/settings'),
  updateSettings: (settings: Record<string, string>) =>
    request<{ success: boolean; message: string }>('/settings', {
      method: 'POST',
      body: JSON.stringify({ settings })
    })
};
