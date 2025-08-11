import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';

import {AuthStackParamList} from '@/types';

// Auth screens
import WelcomeScreen from '@/screens/auth/WelcomeScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import VerifyEmailScreen from '@/screens/auth/VerifyEmailScreen';
import VerifyPhoneScreen from '@/screens/auth/VerifyPhoneScreen';

const Stack = createStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName=\"Welcome\"
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: 'white'},
      }}>
      <Stack.Screen 
        name=\"Welcome\" 
        component={WelcomeScreen}
      />
      <Stack.Screen 
        name=\"Login\" 
        component={LoginScreen}
        options={{
          headerShown: true,
          title: 'Entrar',
          headerBackTitle: 'Voltar',
        }}
      />
      <Stack.Screen 
        name=\"Register\" 
        component={RegisterScreen}
        options={{
          headerShown: true,
          title: 'Criar Conta',
          headerBackTitle: 'Voltar',
        }}
      />
      <Stack.Screen 
        name=\"ForgotPassword\" 
        component={ForgotPasswordScreen}
        options={{
          headerShown: true,
          title: 'Esqueci a Senha',
          headerBackTitle: 'Voltar',
        }}
      />
      <Stack.Screen 
        name=\"VerifyEmail\" 
        component={VerifyEmailScreen}
        options={{
          headerShown: true,
          title: 'Verificar Email',
          headerBackTitle: 'Voltar',
          headerLeft: () => null, // Prevent going back
        }}
      />
      <Stack.Screen 
        name=\"VerifyPhone\" 
        component={VerifyPhoneScreen}
        options={{
          headerShown: true,
          title: 'Verificar Telefone',
          headerBackTitle: 'Voltar',
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;