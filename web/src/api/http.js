import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'
import { useAuthStore } from '../stores/auth'

const TOKEN_KEY = 'hhao1121_token'
const USERNAME_KEY = 'hhao1121_username'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuth(token, username) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USERNAME_KEY, username)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 请求拦截：附 token
http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：统一错误提示；401 清 token 跳登录
http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.error || '请求失败，请稍后重试'
    if (status === 401) {
      // 同步清除 localStorage 与 pinia 内存态，否则路由守卫仍认为已登录
      const auth = useAuthStore()
      auth.token = ''
      auth.username = ''
      clearAuth()
      const current = router.currentRoute.value
      if (current.name !== 'login') {
        ElMessage.error('登录已失效，请重新登录')
        router.push({ name: 'login', query: { redirect: current.fullPath } })
      }
    } else {
      ElMessage.error(message)
    }
    return Promise.reject(error)
  },
)

export default http
