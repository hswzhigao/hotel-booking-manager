import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: '仪表盘' } },
      { path: 'bookings', name: 'bookings', component: () => import('../views/BookingsView.vue'), meta: { title: '预定管理' } },
      { path: 'customers', name: 'customers', component: () => import('../views/CustomersView.vue'), meta: { title: '客户管理' } },
      { path: 'holders', name: 'holders', component: () => import('../views/HoldersView.vue'), meta: { title: '权益人管理' } },
      { path: 'hotels', name: 'hotels', component: () => import('../views/HotelsView.vue'), meta: { title: '酒店管理' } },
      { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: '系统设置' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.token) {
    return { path: '/' }
  }
})

export default router
