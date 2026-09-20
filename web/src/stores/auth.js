import { defineStore } from 'pinia'
import { authApi } from '../api'
import { getToken, setAuth, clearAuth } from '../api/http'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken() || '',
    username: localStorage.getItem('hhao1121_username') || '',
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    async login(username, password) {
      const data = await authApi.login({ username, password })
      setAuth(data.token, data.username)
      this.token = data.token
      this.username = data.username
    },
    logout() {
      clearAuth()
      this.token = ''
      this.username = ''
    },
  },
})
