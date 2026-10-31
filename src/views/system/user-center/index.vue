<template>
  <main class="profile-page">
    <header class="profile-header">
      <div class="profile-identity">
        <el-avatar :size="76" :src="profile.avatar || undefined">
          {{ profile.fullname?.slice(0, 1) || profile.username?.slice(0, 1) || '?' }}
        </el-avatar>
        <div class="profile-identity-copy">
          <h1>个人资料</h1>
          <p>{{ profile.username }}</p>
          <el-upload
            ref="avatarUploaderRef"
            accept="image/png,image/jpeg,image/webp"
            :auto-upload="false"
            :show-file-list="false"
            :disabled="avatarUploading"
            :on-change="handleAvatarChange"
          >
            <el-button size="small" :loading="avatarUploading">更换头像</el-button>
          </el-upload>
          <span class="avatar-hint">支持 PNG、JPG、WebP，文件不超过 5 MB</span>
        </div>
      </div>
      <el-tag :type="profile.status === 'active' ? 'success' : 'danger'">
        {{ profile.status === 'active' ? '账号正常' : '账号已禁用' }}
      </el-tag>
    </header>

    <section class="profile-section">
      <div class="section-heading">
        <h2>基本信息</h2>
        <span>更新用于账户联系的信息</span>
      </div>
      <el-form ref="profileFormRef" :model="profile" :rules="profileRules" label-position="top" class="profile-form">
        <el-form-item label="用户名">
          <el-input :model-value="profile.username" disabled />
        </el-form-item>
        <el-form-item label="姓名" prop="fullname">
          <el-input v-model.trim="profile.fullname" maxlength="100" autocomplete="name" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model.trim="profile.phone" maxlength="20" autocomplete="tel" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model.trim="profile.email" maxlength="100" autocomplete="email" />
        </el-form-item>
        <div class="form-actions">
          <el-button type="primary" :loading="profileSaving" @click="saveProfile">保存资料</el-button>
        </div>
      </el-form>
    </section>

    <section class="profile-section password-section">
      <div class="section-heading">
        <h2>修改密码</h2>
        <span>确认当前密码后设置新密码</span>
      </div>
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-position="top" class="password-form">
        <el-form-item label="当前密码" prop="oldPassword">
          <el-input v-model="passwordForm.oldPassword" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <div class="form-actions">
          <el-button type="primary" :loading="passwordSaving" @click="savePassword">更新密码</el-button>
        </div>
      </el-form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { changePassword, getCurrentUser, updateMyProfile, uploadMyAvatar } from '@/api/platform-auth';
import { useUserStore } from '@/store/modules/user';
import type { UploadFile, UploadInstance } from 'element-plus';

defineOptions({ name: 'UserCenter' });

const userStore = useUserStore();
const profileFormRef = ref<FormInstance>();
const passwordFormRef = ref<FormInstance>();
const avatarUploaderRef = ref<UploadInstance>();
const profileSaving = ref(false);
const passwordSaving = ref(false);
const avatarUploading = ref(false);
const profile = reactive({
  user_id: 0,
  username: '',
  fullname: '',
  phone: '',
  email: '',
  avatar: '',
  status: 'active'
});
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });

const profileRules: FormRules = {
  fullname: [
    { required: true, message: '请输入姓名', trigger: 'blur' },
    { min: 2, max: 100, message: '姓名长度需为 2 到 100 个字符', trigger: 'blur' }
  ],
  phone: [{ max: 20, message: '联系电话不能超过 20 个字符', trigger: 'blur' }],
  email: [{ type: 'email', message: '请输入有效邮箱地址', trigger: 'blur' }]
};

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 128, message: '新密码长度需为 6 到 128 个字符', trigger: 'blur' }
  ],
  confirmPassword: [{
    validator: (_rule, value, callback) => {
      if (!value) callback(new Error('请再次输入新密码'));
      else if (value !== passwordForm.newPassword) callback(new Error('两次输入的新密码不一致'));
      else callback();
    },
    trigger: 'blur'
  }]
};

const readCurrentUser = async () => {
  const response = await getCurrentUser();
  if (response.code !== 0 || !response.data) throw new Error(response.message || '读取个人资料失败');
  Object.assign(profile, response.data);
  userStore.setUserInfo({ ...userStore.getUserInfo, avatar: profile.avatar } as Api.Auth.UserInfo);
};

const handleAvatarChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw;
  if (!file) return;

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const allowedName = /\.(png|jpe?g|webp)$/i.test(file.name);
  if (!allowedTypes.includes(file.type) && !allowedName) {
    ElMessage.warning('请选择 PNG、JPG 或 WebP 图片');
    avatarUploaderRef.value?.clearFiles();
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('头像文件不能超过 5 MB');
    avatarUploaderRef.value?.clearFiles();
    return;
  }

  avatarUploading.value = true;
  try {
    const response = await uploadMyAvatar(file);
    if (response.code !== 0 || !response.data?.avatar) {
      throw new Error(response.message || '上传头像失败');
    }
    profile.avatar = response.data.avatar;
    userStore.setUserInfo({ ...userStore.getUserInfo, avatar: profile.avatar } as Api.Auth.UserInfo);
    ElMessage.success('头像已更新');
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '上传头像失败');
  } finally {
    avatarUploading.value = false;
    avatarUploaderRef.value?.clearFiles();
  }
};

const saveProfile = async () => {
  if (!profileFormRef.value || !(await profileFormRef.value.validate().catch(() => false))) return;
  profileSaving.value = true;
  try {
    const response = await updateMyProfile({ fullname: profile.fullname, phone: profile.phone, email: profile.email });
    if (response.code !== 0) throw new Error(response.message || '保存个人资料失败');
    Object.assign(profile, response.data);
    userStore.setUserInfo({
      ...userStore.getUserInfo,
      fullname: profile.fullname,
      phone: profile.phone,
      email: profile.email,
      avatar: profile.avatar
    } as Api.Auth.UserInfo);
    ElMessage.success('个人资料已更新');
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '保存个人资料失败');
  } finally {
    profileSaving.value = false;
  }
};

const savePassword = async () => {
  if (!passwordFormRef.value || !(await passwordFormRef.value.validate().catch(() => false))) return;
  passwordSaving.value = true;
  try {
    const response = await changePassword(passwordForm.oldPassword, passwordForm.newPassword);
    if (response.code !== 0) throw new Error(response.message || '修改密码失败');
    passwordForm.oldPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
    passwordFormRef.value.clearValidate();
    ElMessage.success('密码已更新');
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '修改密码失败');
  } finally {
    passwordSaving.value = false;
  }
};

onMounted(() => {
  readCurrentUser().catch((error: any) => ElMessage.error(error?.message || '读取个人资料失败'));
});
</script>

<style scoped>
.profile-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.profile-header,
.section-heading,
.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.profile-header {
  margin-bottom: 24px;
}

.profile-identity {
  display: flex;
  align-items: center;
  gap: 18px;
}

.profile-identity-copy h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.profile-identity-copy p {
  margin: 5px 0 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.avatar-hint {
  display: block;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.profile-header h1,
.section-heading h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.profile-header p,
.section-heading span {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.profile-section {
  padding: 24px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.section-heading {
  margin-bottom: 20px;
}

.profile-form,
.password-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 20px;
}

.password-form {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.form-actions {
  grid-column: 1 / -1;
  justify-content: flex-end;
  padding-top: 4px;
}

@media (max-width: 720px) {
  .profile-page {
    padding: 16px;
  }

  .profile-form,
  .password-form {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
