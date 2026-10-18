<template>
  <div class="login-page">
    <el-card class="login-card">
      <h2 class="login-title">酒店预订管理系统</h2>
      <p class="login-subtitle">酒店 · 高尔夫预订管理</p>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @keyup.enter="onSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :prefix-icon="Lock"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-btn" :loading="loading" @click="onSubmit">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <div class="login-tip">默认账号：admin / admin123（首次登录后请在「设置」中修改密码）</div>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const formRef = ref(null)
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function onSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await auth.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } catch (e) {
    // 错误提示已由 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1d2b4f 0%, #3b6cf6 100%);
}

.login-card {
  width: 380px;
  padding: 8px 12px;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(16, 24, 40, 0.28);
}

/* V4 移动端：登录卡不出屏 */
@media (max-width: 768px) {
  .login-card {
    width: calc(100% - 32px);
    max-width: 380px;
  }
}

.login-title {
  text-align: center;
  margin: 4px 0 6px;
  color: #1f2329;
}

.login-subtitle {
  text-align: center;
  margin: 0 0 24px;
  font-size: 13px;
  color: #909399;
}

.login-btn {
  width: 100%;
  height: 44px;
  border-radius: 8px;
}

.login-tip {
  text-align: center;
  font-size: 12px;
  color: #909399;
}
</style>
