<template>
  <div class="page-card">
    <el-card shadow="never" class="settings-card">
      <template #header>修改密码</template>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="90px"
        style="max-width: 420px"
      >
        <el-form-item label="旧密码" prop="old_password">
          <el-input v-model="form.old_password" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input v-model="form.new_password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirm_password">
          <el-input v-model="form.confirm_password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSubmit">确认修改</el-button>
        </el-form-item>
      </el-form>
      <el-alert
        title="修改密码后请妥善保管；旧密码将立即失效。"
        type="info"
        :closable="false"
        show-icon
        style="max-width: 420px"
      />
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { authApi } from '../api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const formRef = ref(null)
const saving = ref(false)

const form = reactive({
  old_password: '',
  new_password: '',
  confirm_password: '',
})

const rules = {
  old_password: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少 6 位', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== form.new_password) {
          callback(new Error('两次输入的新密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

async function onSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await authApi.changePassword({
      old_password: form.old_password,
      new_password: form.new_password,
    })
    ElMessage.success('密码修改成功，请使用新密码重新登录')
    auth.logout()
    // 跟随部署基础路径（如 /hotel/），避免跳转到域名根
    window.location.href = `${import.meta.env.BASE_URL}login`
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.settings-card {
  max-width: 640px;
}
</style>
