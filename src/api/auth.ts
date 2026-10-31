import api, { apiPrefix } from './index'

interface BackendResponse<T> {
  code: number
  message?: string
  data: T
}

interface BackendUser {
  user_id: number
  username: string
  fullname?: string
  phone?: string
  email?: string
  avatar?: string
  is_admin?: boolean
  status?: string
}

export async function fetchLogin(params: Api.Auth.LoginParams): Promise<Api.Auth.LoginResponse> {
  const response = await api.post<BackendResponse<{ token: string }>>(`${apiPrefix}/auth/login`, {
    username: params.userName,
    password: params.password
  })
  const body = response.data
  if (body.code !== 0 || !body.data?.token) {
    throw new Error(body.message || '用户名或密码错误')
  }
  return { token: `Bearer ${body.data.token}`, refreshToken: '' }
}

export async function fetchGetUserInfo(): Promise<Api.Auth.UserInfo> {
  const response = await api.get<BackendResponse<BackendUser>>(`${apiPrefix}/auth/current-user`)
  const body = response.data
  if (body.code !== 0 || !body.data) {
    throw new Error(body.message || '获取用户信息失败')
  }
  const user = body.data
  return {
    userId: Number(user.user_id),
    userName: user.username,
    email: user.email || '',
    avatar: user.avatar || '',
    roles: user.is_admin ? ['R_SUPER', 'R_ADMIN'] : ['R_USER'],
    buttons: [],
    isAdmin: Boolean(user.is_admin),
    fullname: user.fullname || user.username,
    phone: user.phone || '',
    status: user.status || 'enabled'
  } as Api.Auth.UserInfo
}

export async function fetchRegister(params: {
  username: string
  password: string
  confirm_password: string
  fullname?: string
  phone?: string
  email?: string
}) {
  const response = await api.post<BackendResponse<BackendUser>>(`${apiPrefix}/auth/register`, params)
  const body = response.data
  if (body.code !== 0) throw new Error(body.message || '注册失败')
  return body.data
}
