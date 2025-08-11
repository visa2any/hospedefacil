import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {apiService} from '@/services/api';
import {User, AuthState} from '@/types';

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Async thunks

// Login
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: {email: string; password: string}, {rejectWithValue}) => {
    try {
      const response = await apiService.post<{user: User; token: string}>('/auth/login', credentials);
      
      // Store token in AsyncStorage
      await AsyncStorage.setItem('auth_token', response.token);
      
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro no login');
    }
  }
);

// Register
export const register = createAsyncThunk(
  'auth/register',
  async (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }, {rejectWithValue}) => {
    try {
      const response = await apiService.post<{user: User; token: string}>('/auth/register', userData);
      
      // Store token in AsyncStorage
      await AsyncStorage.setItem('auth_token', response.token);
      
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro no cadastro');
    }
  }
);

// Social login
export const socialLogin = createAsyncThunk(
  'auth/socialLogin',
  async (socialData: {
    provider: 'google' | 'facebook' | 'apple';
    token: string;
    userData?: Partial<User>;
  }, {rejectWithValue}) => {
    try {
      const response = await apiService.post<{user: User; token: string}>('/auth/social', socialData);
      
      // Store token in AsyncStorage
      await AsyncStorage.setItem('auth_token', response.token);
      
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro no login social');
    }
  }
);

// Verify token and get user
export const verifyToken = createAsyncThunk(
  'auth/verifyToken',
  async (_, {rejectWithValue}) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await apiService.get<{user: User}>('/auth/me');
      
      return {
        user: response.user,
        token,
      };
    } catch (error: any) {
      // Clear invalid token
      await AsyncStorage.removeItem('auth_token');
      return rejectWithValue(error.message || 'Token inválido');
    }
  }
);

// Update profile
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (userData: Partial<User>, {rejectWithValue}) => {
    try {
      const response = await apiService.put<{user: User}>('/auth/profile', userData);
      return response.user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao atualizar perfil');
    }
  }
);

// Change password
export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }, {rejectWithValue}) => {
    try {
      await apiService.put('/auth/change-password', passwordData);
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao alterar senha');
    }
  }
);

// Forgot password
export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email: string, {rejectWithValue}) => {
    try {
      await apiService.post('/auth/forgot-password', {email});
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao enviar email');
    }
  }
);

// Reset password
export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (resetData: {
    token: string;
    password: string;
  }, {rejectWithValue}) => {
    try {
      await apiService.post('/auth/reset-password', resetData);
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao resetar senha');
    }
  }
);

// Verify email
export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async (token: string, {rejectWithValue}) => {
    try {
      const response = await apiService.post<{user: User}>('/auth/verify-email', {token});
      return response.user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro na verificação');
    }
  }
);

// Verify phone
export const verifyPhone = createAsyncThunk(
  'auth/verifyPhone',
  async (verificationData: {
    phone: string;
    code: string;
  }, {rejectWithValue}) => {
    try {
      const response = await apiService.post<{user: User}>('/auth/verify-phone', verificationData);
      return response.user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro na verificação');
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      // Remove token from AsyncStorage
      AsyncStorage.removeItem('auth_token');
    },
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Register
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Social Login
    builder
      .addCase(socialLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(socialLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(socialLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Verify Token
    builder
      .addCase(verifyToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(verifyToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(verifyToken.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.payload as string;
      });

    // Update Profile
    builder
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Change Password
    builder
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Verify Email
    builder
      .addCase(verifyEmail.fulfilled, (state, action) => {
        state.user = action.payload;
      });

    // Verify Phone
    builder
      .addCase(verifyPhone.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

// Export actions and reducer
export const {logout, clearError, setUser} = authSlice.actions;
export default authSlice.reducer;