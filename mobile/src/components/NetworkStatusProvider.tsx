import React, {useEffect} from 'react';
import {useDispatch} from 'react-redux';
import NetInfo from '@react-native-community/netinfo';
import {setNetworkStatus} from '@/store/slices/networkSlice';
import {AppDispatch} from '@/store';

interface NetworkStatusProviderProps {
  children: React.ReactNode;
}

const NetworkStatusProvider: React.FC<NetworkStatusProviderProps> = ({children}) => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      dispatch(setNetworkStatus({
        isConnected: state.isConnected || false,
        isInternetReachable: state.isInternetReachable || false,
      }));
    });

    return unsubscribe;
  }, [dispatch]);

  return <>{children}</>;
};

export default NetworkStatusProvider;