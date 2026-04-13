import axios, { AxiosInstance } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)))
  failedQueue = []
}

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error)

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const refresh = localStorage.getItem('refresh_token')
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh })
      localStorage.setItem('access_token', data.accessToken)
      localStorage.setItem('refresh_token', data.refreshToken)
      processQueue(null, data.accessToken)
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch (err) {
      processQueue(err, null)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/password', { currentPassword, newPassword }).then((r) => r.data),
}

// ─── Context ──────────────────────────────────────────────────────────────────
export const contextApi = {
  get: () => api.get('/context').then((r) => r.data),
}

// ─── Incidents ────────────────────────────────────────────────────────────────
export const incidentsApi = {
  list: (params?: { status?: string }) =>
    api.get('/incidents', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/incidents/${id}`).then((r) => r.data),
  create: (body: object) => api.post('/incidents', body).then((r) => r.data),
  escalate: (id: string) => api.post(`/incidents/${id}/escalate`).then((r) => r.data),
  resolve: (id: string, note?: string) =>
    api.post(`/incidents/${id}/resolve`, { note }).then((r) => r.data),
  archive: (id: string) =>
    api.post(`/incidents/${id}/archive`).then((r) => r.data),
  addNote: (id: string, body: string) =>
    api.post(`/incidents/${id}/notes`, { body }).then((r) => r.data),
}

// ─── Operations ───────────────────────────────────────────────────────────────
export const operationsApi = {
  list: (shiftId: string) =>
    api.get('/operations', { params: { shiftId } }).then((r) => r.data),
  create: (body: object) => api.post('/operations', body).then((r) => r.data),
  submit: (id: string) => api.post(`/operations/${id}/submit`).then((r) => r.data),
}

// ─── Shifts ───────────────────────────────────────────────────────────────────
export const shiftsApi = {
  active: () => api.get('/shifts/active').then((r) => r.data),
  list: () => api.get('/shifts').then((r) => r.data),
  open: (id: string) => api.post(`/shifts/${id}/open`).then((r) => r.data),
  handover: (id: string) => api.post(`/shifts/${id}/handover`).then((r) => r.data),
  close: (id: string) => api.post(`/shifts/${id}/close`).then((r) => r.data),
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  users: {
    list: () => api.get('/admin/users').then((r) => r.data),
    setActive: (id: string, isActive: boolean) =>
      api.patch(`/admin/users/${id}`, { isActive }).then((r) => r.data),
  },
  zones: {
    list: () => api.get('/admin/zones').then((r) => r.data),
    create: (body: object) => api.post('/admin/zones', body).then((r) => r.data),
    update: (id: string, body: object) =>
      api.patch(`/admin/zones/${id}`, body).then((r) => r.data),
  },
  services: {
    list: () => api.get('/admin/services').then((r) => r.data),
    create: (body: object) => api.post('/admin/services', body).then((r) => r.data),
    update: (id: string, body: object) =>
      api.patch(`/admin/services/${id}`, body).then((r) => r.data),
  },
}
