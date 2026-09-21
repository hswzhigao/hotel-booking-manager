<template>
  <el-container class="layout-root">
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="layout-aside">
      <div class="brand">
        <span v-if="!isCollapsed">酒店预订管理</span>
        <span v-else>酒</span>
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
          <span class="page-title desktop-only">{{ route.meta.title || '' }}</span>
          <span class="mobile-brand mobile-only">酒店预订管理</span>
        </div>
        <div class="header-right">
          <el-icon class="desktop-only"><UserFilled /></el-icon>
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

    <!-- 移动端汉堡抽屉菜单：<768px 顶栏唤起，选中即关闭 -->
    <el-drawer
      v-model="mobileMenuVisible"
      title="菜单"
      size="70%"
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
  Odometer, Tickets, User, Avatar, OfficeBuilding, Setting, Expand, Fold, UserFilled, Flag, Menu,
} from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isCollapsed = ref(false)
const activeMenu = computed(() => route.path)

// 菜单项统一数组：侧边栏与移动端抽屉共用，避免两份菜单漂移
const menuItems = [
  { index: '/', icon: Odometer, title: '仪表盘' },
  { index: '/bookings', icon: Tickets, title: '预定管理' },
  { index: '/golf', icon: Flag, title: '高尔夫管理' },
  { index: '/customers', icon: User, title: '客户管理' },
  { index: '/holders', icon: Avatar, title: '预订人管理' },
  { index: '/hotels', icon: OfficeBuilding, title: '酒店管理' },
  { index: '/settings', icon: Setting, title: '系统设置' },
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
  border-right: 1px solid #e4e7ed;
  transition: width 0.2s;
  overflow: hidden;
}

.brand {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  white-space: nowrap;
}

.layout-menu {
  border-right: none;
}

.layout-menu:not(.el-menu--collapse) {
  width: 100%;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #606266;
}

.collapse-btn:hover {
  color: #409eff;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606266;
}

.username {
  font-size: 14px;
}

.layout-main {
  background: #f5f7fa;
  padding: 0;
}

/* ===== V4 移动端（<768px）：隐藏侧边栏，顶栏=汉堡+系统名+退出 ===== */
.mobile-only {
  display: none;
}

.mobile-menu-btn {
  font-size: 22px;
  cursor: pointer;
  color: #606266;
}

.mobile-menu-btn:hover {
  color: #409eff;
}

.mobile-brand {
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  white-space: nowrap;
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

  .mobile-brand {
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
