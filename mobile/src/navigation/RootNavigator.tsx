import React, {useEffect} from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {useSelector, useDispatch} from 'react-redux';

import {RootState, AppDispatch} from '@/store';
import {verifyToken} from '@/store/slices/authSlice';
import {RootStackParamList} from '@/types';

// Screens
import SplashScreen from '@/screens/SplashScreen';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import PropertyDetailsScreen from '@/screens/PropertyDetailsScreen';
import BookingScreen from '@/screens/BookingScreen';
import BookingConfirmationScreen from '@/screens/BookingConfirmationScreen';
import PaymentScreen from '@/screens/PaymentScreen';
import MessagesScreen from '@/screens/MessagesScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import EditProfileScreen from '@/screens/EditProfileScreen';
import ReviewsScreen from '@/screens/ReviewsScreen';
import WriteReviewScreen from '@/screens/WriteReviewScreen';
import HostNavigator from './HostNavigator';
import AddPropertyScreen from '@/screens/host/AddPropertyScreen';
import EditPropertyScreen from '@/screens/host/EditPropertyScreen';
import CalendarScreen from '@/screens/host/CalendarScreen';
import AnalyticsScreen from '@/screens/host/AnalyticsScreen';

const Stack = createStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {isAuthenticated, isLoading} = useSelector((state: RootState) => state.auth);
  const [isAppReady, setIsAppReady] = React.useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Try to verify existing token
        await dispatch(verifyToken()).unwrap();
      } catch (error) {
        // Token verification failed, user needs to login
        console.log('Token verification failed:', error);
      } finally {
        setIsAppReady(true);
      }
    };

    initializeApp();
  }, [dispatch]);

  // Show splash screen while app is initializing
  if (!isAppReady || isLoading) {
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name=\"Splash\" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'white'},
      }}>
      {!isAuthenticated ? (
        // Auth flow
        <Stack.Screen 
          name=\"Auth\" 
          component={AuthNavigator}
          options={{animationTypeForReplace: 'pop'}}
        />
      ) : (
        // Main app flow
        <>
          <Stack.Screen name=\"Main\" component={MainNavigator} />
          
          {/* Modal screens */}
          <Stack.Group screenOptions={{presentation: 'modal', headerShown: true}}>
            <Stack.Screen 
              name=\"PropertyDetails\" 
              component={PropertyDetailsScreen}
              options={{title: 'Detalhes da Propriedade'}}
            />
            <Stack.Screen 
              name=\"Booking\" 
              component={BookingScreen}
              options={{title: 'Reservar'}}
            />
            <Stack.Screen 
              name=\"Payment\" 
              component={PaymentScreen}
              options={{title: 'Pagamento'}}
            />
            <Stack.Screen 
              name=\"Messages\" 
              component={MessagesScreen}
              options={{title: 'Mensagens'}}
            />
            <Stack.Screen 
              name=\"Reviews\" 
              component={ReviewsScreen}
              options={{title: 'Avaliações'}}
            />
            <Stack.Screen 
              name=\"WriteReview\" 
              component={WriteReviewScreen}
              options={{title: 'Escrever Avaliação'}}
            />
            <Stack.Screen 
              name=\"EditProfile\" 
              component={EditProfileScreen}
              options={{title: 'Editar Perfil'}}
            />
          </Stack.Group>

          {/* Confirmation screens */}
          <Stack.Screen 
            name=\"BookingConfirmation\" 
            component={BookingConfirmationScreen}
            options={{headerShown: true, title: 'Confirmação'}}
          />

          {/* Host screens */}
          <Stack.Group screenOptions={{headerShown: true}}>
            <Stack.Screen 
              name=\"Host\" 
              component={HostNavigator}
              options={{headerShown: false}}
            />
            <Stack.Screen 
              name=\"AddProperty\" 
              component={AddPropertyScreen}
              options={{title: 'Adicionar Propriedade'}}
            />
            <Stack.Screen 
              name=\"EditProperty\" 
              component={EditPropertyScreen}
              options={{title: 'Editar Propriedade'}}
            />
            <Stack.Screen 
              name=\"Calendar\" 
              component={CalendarScreen}
              options={{title: 'Calendário'}}
            />
            <Stack.Screen 
              name=\"Analytics\" 
              component={AnalyticsScreen}
              options={{title: 'Analytics'}}
            />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;