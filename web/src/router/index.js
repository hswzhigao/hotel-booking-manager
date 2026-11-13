import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: '仪表盘' } },
      { path: 'bookings', name: 'bookings', component: () => import('../views/BookingsView.vue'), meta: { title: '酒店订单' } },
      { path: 'golf', name: 'golf', component: () => import('../views/GolfView.vue'), meta: { title: '高尔夫订单' } },
      { path: 'customers', name: 'customers', component: () => import('../views/CustomersView.vue'), meta: { title: '客户' } },
      { path: 'holders', name: 'holders', component: () => import('../views/HoldersView.vue'), meta: { title: '预订人' } },
      { path: 'hotels', name: 'hotels', component: () => import('../views/HotelsView.vue'), meta: { title: '酒店' } },
      { path: 'ledger', name: 'ledger', component: () => import('../views/LedgerView.vue'), meta: { title: '记账本' } },
      { path: 'fields', name: 'fields', component: () => import('../views/FieldsView.vue'), meta: { title: '基础配置' } },
      { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: '设置' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
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

// V7：document.title 跟随当前路由 meta.title
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 酒店预订管理系统` : '酒店预订管理系统'
})

export default router
