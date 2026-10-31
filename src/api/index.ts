import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/store/modules/user';
export const apiPrefix = '/api/v1/mcp'
const removeContentTypeHeader = (headers: any) => {
    if (!headers) return;
    if (typeof headers.delete === 'function') {
        headers.delete('Content-Type');
        headers.delete('content-type');
        return;
    }
    delete headers['Content-Type'];
    delete headers['content-type'];
};

// 创建axios实例
const api = axios.create({
    // baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002',
    timeout: 600000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // 启用跨域认证，确保发送cookie
});

// 请求拦截器
api.interceptors.request.use(
    (config) => {
        // 确保所有请求都使用withCredentials
        config.withCredentials = true;

        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
            config.headers = config.headers || {};
            removeContentTypeHeader(config.headers);
        }
        
        const token = useUserStore().accessToken;
        if (token) {
            config.headers = config.headers || {};
            config.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
        }
        
        // 检查最终的请求头
        // console.log('最终请求头:', JSON.stringify(config.headers));
        // console.log('是否发送cookies:', config.withCredentials);
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 响应拦截器
api.interceptors.response.use(
    (response) => {
        return response;
    },
        async (error) => {
        // 静默 404：带 quiet404 标记的请求（如已删除试卷包的存在性探测）
        // 404 属预期结果，由调用方自行处理，不打全局错误日志
        const isQuiet404 = Boolean(
            error?.config?.quiet404 && error?.response?.status === 404
        );
        if (!isQuiet404) {
            console.error('API请求错误:', error);
        }
        
        // 处理401未授权错误
        if (error.response && error.response.status === 401 && useUserStore().accessToken) {
            console.warn('收到401未授权错误');
            
            ElMessage.error('会话已过期，请重新登录');
            useUserStore().logOut();
        }
        return Promise.reject(error);
    }
);

// 导出API实例
export default api; 
