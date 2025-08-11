import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {apiService} from '@/services/api';
import {Property, PropertiesState} from '@/types';

const initialState: PropertiesState = {
  favorites: [],
  viewed: [],
  cache: {},
  isLoading: false,
  error: null,
};

// Async thunks

// Get property details
export const getProperty = createAsyncThunk(
  'properties/getProperty',
  async (propertyId: string, {rejectWithValue}) => {
    try {
      const response = await apiService.get<Property>(`/properties/${propertyId}`);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao carregar propriedade');
    }
  }
);

// Toggle favorite
export const toggleFavorite = createAsyncThunk(
  'properties/toggleFavorite',
  async (propertyId: string, {rejectWithValue, getState}) => {
    try {
      const state = getState() as any;
      const isFavorite = state.properties.favorites.includes(propertyId);
      
      if (isFavorite) {
        await apiService.delete(`/properties/${propertyId}/favorite`);
      } else {
        await apiService.post(`/properties/${propertyId}/favorite`);
      }
      
      return {propertyId, isFavorite: !isFavorite};
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao favoritar propriedade');
    }
  }
);

// Get user favorites
export const getFavorites = createAsyncThunk(
  'properties/getFavorites',
  async (_, {rejectWithValue}) => {
    try {
      const response = await apiService.get<{propertyIds: string[]}>('/properties/favorites');
      return response.propertyIds;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao carregar favoritos');
    }
  }
);

const propertiesSlice = createSlice({
  name: 'properties',
  initialState,
  reducers: {
    addToViewed: (state, action: PayloadAction<string>) => {
      const propertyId = action.payload;
      if (!state.viewed.includes(propertyId)) {
        state.viewed.unshift(propertyId);
        // Keep only last 50 viewed properties
        if (state.viewed.length > 50) {
          state.viewed = state.viewed.slice(0, 50);
        }
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    updatePropertyInCache: (state, action: PayloadAction<Property>) => {
      state.cache[action.payload.id] = action.payload;
    },
    removeFromCache: (state, action: PayloadAction<string>) => {
      delete state.cache[action.payload];
    },
    clearCache: (state) => {
      state.cache = {};
    },
  },
  extraReducers: (builder) => {
    // Get Property
    builder
      .addCase(getProperty.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getProperty.fulfilled, (state, action) => {
        state.isLoading = false;
        state.cache[action.payload.id] = action.payload;
        state.error = null;
      })
      .addCase(getProperty.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Toggle Favorite
    builder
      .addCase(toggleFavorite.pending, (state) => {
        state.error = null;
      })
      .addCase(toggleFavorite.fulfilled, (state, action) => {
        const {propertyId, isFavorite} = action.payload;
        if (isFavorite) {
          if (!state.favorites.includes(propertyId)) {
            state.favorites.push(propertyId);
          }
        } else {
          state.favorites = state.favorites.filter(id => id !== propertyId);
        }
        state.error = null;
      })
      .addCase(toggleFavorite.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Get Favorites
    builder
      .addCase(getFavorites.fulfilled, (state, action) => {
        state.favorites = action.payload;
      });
  },
});

export const {
  addToViewed,
  clearError,
  updatePropertyInCache,
  removeFromCache,
  clearCache,
} = propertiesSlice.actions;

export default propertiesSlice.reducer;