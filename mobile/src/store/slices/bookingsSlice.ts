import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {apiService} from '@/services/api';
import {Booking, BookingsState} from '@/types';

const initialState: BookingsState = {
  bookings: [],
  currentBooking: null,
  isLoading: false,
  error: null,
};

// Async thunks

// Get user bookings
export const getBookings = createAsyncThunk(
  'bookings/getBookings',
  async (params: {
    status?: string;
    page?: number;
    limit?: number;
  } = {}, {rejectWithValue}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.append('status', params.status);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      
      const response = await apiService.get<{bookings: Booking[]}>(`/bookings?${queryParams}`);
      return response.bookings;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao carregar reservas');
    }
  }
);

// Get booking details
export const getBooking = createAsyncThunk(
  'bookings/getBooking',
  async (bookingId: string, {rejectWithValue}) => {
    try {
      const response = await apiService.get<Booking>(`/bookings/${bookingId}`);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao carregar reserva');
    }
  }
);

// Create booking
export const createBooking = createAsyncThunk(
  'bookings/createBooking',
  async (bookingData: {
    propertyId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    adults: number;
    children: number;
    infants: number;
    specialRequests?: string;
  }, {rejectWithValue}) => {
    try {
      const response = await apiService.post<Booking>('/bookings', bookingData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao criar reserva');
    }
  }
);

// Cancel booking
export const cancelBooking = createAsyncThunk(
  'bookings/cancelBooking',
  async (params: {
    bookingId: string;
    reason?: string;
  }, {rejectWithValue}) => {
    try {
      const response = await apiService.post<Booking>(`/bookings/${params.bookingId}/cancel`, {
        reason: params.reason,
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao cancelar reserva');
    }
  }
);

// Update booking
export const updateBooking = createAsyncThunk(
  'bookings/updateBooking',
  async (params: {
    bookingId: string;
    data: Partial<Booking>;
  }, {rejectWithValue}) => {
    try {
      const response = await apiService.put<Booking>(`/bookings/${params.bookingId}`, params.data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao atualizar reserva');
    }
  }
);

// Host actions

// Confirm booking (host)
export const confirmBooking = createAsyncThunk(
  'bookings/confirmBooking',
  async (bookingId: string, {rejectWithValue}) => {
    try {
      const response = await apiService.post<Booking>(`/bookings/${bookingId}/confirm`);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao confirmar reserva');
    }
  }
);

// Reject booking (host)
export const rejectBooking = createAsyncThunk(
  'bookings/rejectBooking',
  async (params: {
    bookingId: string;
    reason: string;
  }, {rejectWithValue}) => {
    try {
      const response = await apiService.post<Booking>(`/bookings/${params.bookingId}/reject`, {
        reason: params.reason,
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao rejeitar reserva');
    }
  }
);

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    setCurrentBooking: (state, action: PayloadAction<Booking | null>) => {
      state.currentBooking = action.payload;
    },
    updateBookingInList: (state, action: PayloadAction<Booking>) => {
      const index = state.bookings.findIndex(b => b.id === action.payload.id);
      if (index !== -1) {
        state.bookings[index] = action.payload;
      }
      if (state.currentBooking?.id === action.payload.id) {
        state.currentBooking = action.payload;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    clearBookings: (state) => {
      state.bookings = [];
      state.currentBooking = null;
    },
  },
  extraReducers: (builder) => {
    // Get Bookings
    builder
      .addCase(getBookings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getBookings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.bookings = action.payload;
        state.error = null;
      })
      .addCase(getBookings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Get Booking
    builder
      .addCase(getBooking.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getBooking.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentBooking = action.payload;
        state.error = null;
      })
      .addCase(getBooking.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create Booking
    builder
      .addCase(createBooking.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentBooking = action.payload;
        state.bookings.unshift(action.payload);
        state.error = null;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Cancel Booking
    builder
      .addCase(cancelBooking.fulfilled, (state, action) => {
        const index = state.bookings.findIndex(b => b.id === action.payload.id);
        if (index !== -1) {
          state.bookings[index] = action.payload;
        }
        if (state.currentBooking?.id === action.payload.id) {
          state.currentBooking = action.payload;
        }
      });

    // Update Booking
    builder
      .addCase(updateBooking.fulfilled, (state, action) => {
        const index = state.bookings.findIndex(b => b.id === action.payload.id);
        if (index !== -1) {
          state.bookings[index] = action.payload;
        }
        if (state.currentBooking?.id === action.payload.id) {
          state.currentBooking = action.payload;
        }
      });

    // Confirm Booking
    builder
      .addCase(confirmBooking.fulfilled, (state, action) => {
        const index = state.bookings.findIndex(b => b.id === action.payload.id);
        if (index !== -1) {
          state.bookings[index] = action.payload;
        }
        if (state.currentBooking?.id === action.payload.id) {
          state.currentBooking = action.payload;
        }
      });

    // Reject Booking
    builder
      .addCase(rejectBooking.fulfilled, (state, action) => {
        const index = state.bookings.findIndex(b => b.id === action.payload.id);
        if (index !== -1) {
          state.bookings[index] = action.payload;
        }
        if (state.currentBooking?.id === action.payload.id) {
          state.currentBooking = action.payload;
        }
      });
  },
});

export const {
  setCurrentBooking,
  updateBookingInList,
  clearError,
  clearBookings,
} = bookingsSlice.actions;

export default bookingsSlice.reducer;