import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {store} from '@/store';
import {logout} from '@/store/slices/authSlice';
import {ApiResponse, ApiError} from '@/types';

// API Configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000/api' // Development
  : 'https://api.hospedefacil.com.br/api'; // Production

const API_TIMEOUT = 10000; // 10 seconds

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'HospedeFacil-Mobile/1.0.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const token = await AsyncStorage.getItem('auth_token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.warn('Failed to get auth token from storage:', error);
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle errors and token refresh
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Clear stored token and logout user
          await AsyncStorage.removeItem('auth_token');
          store.dispatch(logout());
          
          return Promise.reject(error);
        }

        // Handle network errors
        if (!error.response) {
          return Promise.reject({
            error: 'Network Error',
            message: 'Verifique sua conexão com a internet e tente novamente.',
          } as ApiError);
        }

        // Format API error response
        const apiError: ApiError = {
          error: error.response.data?.error || 'Erro desconhecido',
          message: error.response.data?.message || 'Algo deu errado. Tente novamente.',
          details: error.response.data?.details,
        };

        return Promise.reject(apiError);
      }
    );
  }

  // Generic request methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data.data;
  }

  // Multipart form data upload
  async uploadFile<T>(url: string, formData: FormData): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  }

  // Update base URL (useful for development/production switching)
  updateBaseURL(baseURL: string) {
    this.client.defaults.baseURL = baseURL;
  }

  // Add custom headers
  setHeader(key: string, value: string) {
    this.client.defaults.headers.common[key] = value;
  }

  // Remove custom headers
  removeHeader(key: string) {
    delete this.client.defaults.headers.common[key];
  }

  // Get current configuration
  getConfig() {
    return {
      baseURL: this.client.defaults.baseURL,
      timeout: this.client.defaults.timeout,
      headers: this.client.defaults.headers,
    };
  }
}

// Create singleton instance
export const apiService = new ApiService();
export default apiService;