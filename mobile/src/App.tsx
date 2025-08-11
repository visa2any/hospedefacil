import React from 'react';
import {StatusBar} from 'react-native';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {NavigationContainer} from '@react-navigation/native';
import {Provider as PaperProvider} from 'react-native-paper';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {store, persistor} from '@/store';
import {theme} from '@/theme';
import RootNavigator from '@/navigation/RootNavigator';
import LoadingScreen from '@/components/LoadingScreen';
import NetworkStatusProvider from '@/components/NetworkStatusProvider';

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={<LoadingScreen />} persistor={persistor}>
            <PaperProvider theme={theme}>
              <NavigationContainer theme={theme}>
                <NetworkStatusProvider>
                  <StatusBar 
                    barStyle="dark-content" 
                    backgroundColor={theme.colors.surface} 
                  />
                  <RootNavigator />
                </NetworkStatusProvider>
              </NavigationContainer>
            </PaperProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;