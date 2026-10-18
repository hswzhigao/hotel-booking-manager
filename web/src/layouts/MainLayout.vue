<template>
  <el-container class="layout-root">
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="layout-aside">
      <div class="brand" :class="{ 'brand-collapsed': isCollapsed }">
        <span class="brand-logo"><el-icon><OfficeBuilding /></el-icon></span>
        <span v-if="!isCollapsed" class="brand-name">酒店预订管理</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        :collapse-transition="false"
        router
        class="layout-menu"
      >
        <el-menu-item v-for="item in menuItems" :key="item.index" :index="item.index">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon class="collapse-btn desktop-only" @click="isCollapsed = !isCollapsed">
            <Expand v-if="isCollapsed" />
            <Fold v-else />
          </el-icon>
          <el-icon class="mobile-menu-btn mobile-only" @click="mobileMenuVisible = true">
            <Menu />
          </el-icon>
          <span class="page-title desktop-only">{{ pageTitle }}</span>
          <span class="mobile-page-title mobile-only">{{ pageTitle }}</span>
        </div>
        <div class="header-right">
          <el-avatar :size="28" class="user-avatar desktop-only">{{ (auth.username || '用').charAt(0) }}</el-avatar>
          <span class="username desktop-only">{{ auth.username }}</span>
          <el-button text type="danger" @click="onLogout">
            <span class="desktop-only">退出登录</span>
            <span class="mobile-only">退出</span>
          </el-button>
        </div>
      </el-header>
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>

    <!-- 移动端汉堡抽屉菜单：<768px 顶栏唤起，选中即关闭；direction=ltr 左侧滑出 -->
    <el-drawer
      v-model="mobileMenuVisible"
      title="菜单"
      size="70%"
      direction="ltr"
      class="mobile-menu-drawer"
      :append-to-body="true"
    >
      <el-menu :default-active="activeMenu" router class="mobile-menu" @select="mobileMenuVisible = false">
        <el-menu-item v-for="item in menuItems" :key="item.index" :index="item.index">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-drawer>
  </el-container>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Odometer, Tickets, User, Avatar, OfficeBuilding, Collection, Setting, Expand, Fold, Flag, Menu, Notebook,
} from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isCollapsed = ref(false)
const activeMenu = computed(() => route.path)

// V7：顶栏标题跟随当前路由（桌面/移动同源）
const pageTitle = computed(() => route.meta.title || '仪表盘')

// 菜单项统一数组：侧边栏与移动端抽屉共用，避免两份菜单漂移
// V7 更名：预定管理→酒店订单、高尔夫管理→高尔夫订单、客户管理→客户、酒店管理→酒店、
//         预订人管理→预订人、字段管理→基础配置、系统设置→设置；新增「记账本」（/ledger）
const menuItems = [
  { index: '/', icon: Odometer, title: '仪表盘' },
  { index: '/bookings', icon: Tickets, title: '酒店订单' },
  { index: '/golf', icon: Flag, title: '高尔夫订单' },
  { index: '/customers', icon: User, title: '客户' },
  { index: '/holders', icon: Avatar, title: '预订人' },
  { index: '/hotels', icon: OfficeBuilding, title: '酒店' },
  { index: '/ledger', icon: Notebook, title: '记账本' },
  { index: '/fields', icon: Collection, title: '基础配置' },
  { index: '/settings', icon: Setting, title: '设置' },
]

const mobileMenuVisible = ref(false)

function onLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.layout-root {
  height: 100%;
}

.layout-aside {
  border-right: 1px solid #e8ecf2;
  transition: width 0.2s;
  overflow: hidden;
}

.brand {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 0 18px;
  white-space: nowrap;
}

.brand-collapsed {
  justify-content: center;
  padding: 0;
}

.brand-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary);
  color: #fff;
  border-radius: 8px;
  font-size: 16px;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layout-menu {
  border-right: none;
}

.layout-menu:not(.el-menu--collapse) {
  width: 100%;
}

.layout-menu :deep(.el-menu-item) {
  margin: 4px 8px;
  border-radius: 8px;
}

.layout-menu :deep(.el-menu-item:hover) {
  background-color: #f5f7fa;
}

.layout-menu :deep(.el-menu-item.is-active) {
  background-color: #e8eefd;
  color: var(--el-color-primary);
}

.layout-menu :deep(.el-menu-item.is-active .el-icon) {
  color: var(--el-color-primary);
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e8ecf2;
  background: #fff;
  height: 56px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #5e6673;
}

.collapse-btn:hover {
  color: var(--el-color-primary);
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5e6673;
}

.user-avatar {
  background: var(--el-color-primary);
  color: #fff;
  font-size: 14px;
  flex-shrink: 0;
}

.username {
  font-size: 14px;
  color: #1f2329;
}

.layout-main {
  background: #f4f6fa;
  padding: 0;
}

/* ===== V4 移动端（<768px）：隐藏侧边栏，顶栏=汉堡+系统名+退出 ===== */
.mobile-only {
  display: none;
}

.mobile-menu-btn {
  font-size: 22px;
  cursor: pointer;
  color: #5e6673;
}

.mobile-menu-btn:hover {
  color: var(--el-color-primary);
}

.mobile-brand {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-primary);
  white-space: nowrap;
}

.mobile-page-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-menu {
  border-right: none;
}

@media (max-width: 768px) {
  .layout-aside {
    display: none;
  }

  .desktop-only {
    display: none !important;
  }

  .mobile-menu-btn {
    display: inline-flex;
  }

  .mobile-page-title {
    display: inline;
  }

  .header-right .mobile-only {
    display: inline;
  }

  .layout-header {
    padding: 0 12px;
  }

  .layout-main {
    padding: 0;
  }
}
</style>
