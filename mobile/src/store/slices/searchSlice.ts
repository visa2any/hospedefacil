import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {apiService} from '@/services/api';
import {SearchFilters, SearchResponse, SearchState, Property} from '@/types';

const initialState: SearchState = {
  filters: {},
  results: [],
  suggestions: [],
  recentSearches: [],
  isLoading: false,
  error: null,
};

// Async thunks

// Search properties
export const searchProperties = createAsyncThunk(
  'search/searchProperties',
  async (filters: SearchFilters, {rejectWithValue}) => {
    try {
      const response = await apiService.post<SearchResponse>('/properties/search', filters);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro na busca');
    }
  }
);

// Get location suggestions
export const getLocationSuggestions = createAsyncThunk(
  'search/getLocationSuggestions',
  async (query: string, {rejectWithValue}) => {
    try {
      if (query.length < 2) return [];
      
      const response = await apiService.get<{suggestions: string[]}>(`/locations/suggestions?q=${encodeURIComponent(query)}`);
      return response.suggestions;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao buscar sugestões');
    }
  }
);

// Get popular destinations
export const getPopularDestinations = createAsyncThunk(
  'search/getPopularDestinations',
  async (_, {rejectWithValue}) => {
    try {
      const response = await apiService.get<{destinations: string[]}>('/locations/popular');
      return response.destinations;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao carregar destinos populares');
    }
  }
);

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<SearchFilters>) => {
      state.filters = action.payload;
    },
    updateFilters: (state, action: PayloadAction<Partial<SearchFilters>>) => {
      state.filters = {...state.filters, ...action.payload};
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    addToRecentSearches: (state, action: PayloadAction<SearchFilters>) => {
      const newSearch = action.payload;
      // Remove if already exists
      state.recentSearches = state.recentSearches.filter(
        search => JSON.stringify(search) !== JSON.stringify(newSearch)
      );
      // Add to beginning
      state.recentSearches.unshift(newSearch);
      // Keep only last 10 searches
      if (state.recentSearches.length > 10) {
        state.recentSearches = state.recentSearches.slice(0, 10);
      }
    },
    removeFromRecentSearches: (state, action: PayloadAction<number>) => {
      state.recentSearches.splice(action.payload, 1);
    },
    clearRecentSearches: (state) => {
      state.recentSearches = [];
    },
    clearResults: (state) => {
      state.results = [];
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuggestions: (state) => {
      state.suggestions = [];
    },
  },
  extraReducers: (builder) => {
    // Search Properties
    builder
      .addCase(searchProperties.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchProperties.fulfilled, (state, action) => {
        state.isLoading = false;
        state.results = action.payload.properties;
        state.error = null;
      })
      .addCase(searchProperties.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Location Suggestions
    builder
      .addCase(getLocationSuggestions.pending, (state) => {
        state.suggestions = [];
      })
      .addCase(getLocationSuggestions.fulfilled, (state, action) => {
        state.suggestions = action.payload;
      })
      .addCase(getLocationSuggestions.rejected, (state) => {
        state.suggestions = [];
      });

    // Popular Destinations
    builder
      .addCase(getPopularDestinations.fulfilled, (state, action) => {
        // You might want to store popular destinations separately
        // For now, we'll just use them as suggestions
        if (state.suggestions.length === 0) {
          state.suggestions = action.payload;
        }
      });
  },
});

export const {
  setFilters,
  updateFilters,
  clearFilters,
  addToRecentSearches,
  removeFromRecentSearches,
  clearRecentSearches,
  clearResults,
  clearError,
  clearSuggestions,
} = searchSlice.actions;

export default searchSlice.reducer;