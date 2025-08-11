import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {NetworkState} from '@/types';

const initialState: NetworkState = {
  isConnected: true,
  isInternetReachable: true,
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setNetworkStatus: (state, action: PayloadAction<{
      isConnected: boolean;
      isInternetReachable: boolean;
    }>) => {
      state.isConnected = action.payload.isConnected;
      state.isInternetReachable = action.payload.isInternetReachable;
    },
  },
});

export const {setNetworkStatus} = networkSlice.actions;
export default networkSlice.reducer;