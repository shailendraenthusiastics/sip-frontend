import axios from 'axios'

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const apiBaseUrl = configuredApiBaseUrl || (import.meta.env.DEV ? 'http://localhost:8000/api' : '')

if (!configuredApiBaseUrl && !import.meta.env.DEV) {
  // Surface a clear hint in production when env vars are missing.
  console.warn('VITE_API_BASE_URL is not set. Set it in Vercel project environment variables.')
}

const client = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('stablemoney_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default client
