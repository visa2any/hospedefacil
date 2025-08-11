import {configureStore, combineReducers} from '@reduxjs/toolkit';
import {persistStore, persistReducer} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import slices
import authSlice from './slices/authSlice';
import propertiesSlice from './slices/propertiesSlice';
import bookingsSlice from './slices/bookingsSlice';
import searchSlice from './slices/searchSlice';
import messagesSlice from './slices/messagesSlice';
import networkSlice from './slices/networkSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'properties', 'search'], // Only persist these slices
  blacklist: ['network', 'messages'], // Don't persist these slices
};

// Combine reducers
const rootReducer = combineReducers({
  auth: authSlice,
  properties: propertiesSlice,
  bookings: bookingsSlice,
  search: searchSlice,
  messages: messagesSlice,
  network: networkSlice,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: __DEV__,
});

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;