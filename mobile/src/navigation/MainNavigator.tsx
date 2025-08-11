import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';

import {MainTabParamList} from '@/types';
import {RootState} from '@/store';
import {colors, spacing} from '@/theme';

// Tab screens
import SearchScreen from '@/screens/SearchScreen';
import TripsScreen from '@/screens/TripsScreen';
import MessagesScreen from '@/screens/MessagesScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import HostDashboardScreen from '@/screens/host/HostDashboardScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainNavigator: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const unreadMessages = useSelector((state: RootState) => 
    state.messages.conversations.reduce((total, conv) => total + conv.unreadCount, 0)
  );
  
  const isHost = user?.role === 'HOST' || user?.role === 'ADMIN';

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Search':
              iconName = focused ? 'search' : 'search-outline';
              break;
            case 'Trips':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Messages':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'Host':
              iconName = focused ? 'home' : 'home-outline';
              break;
            default:
              iconName = 'circle-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}>
      <Tab.Screen
        name=\"Search\"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Buscar',
        }}
      />
      <Tab.Screen
        name=\"Trips\"
        component={TripsScreen}
        options={{
          tabBarLabel: 'Viagens',
        }}
      />
      <Tab.Screen
        name=\"Messages\"
        component={MessagesScreen}
        options={{
          tabBarLabel: 'Mensagens',
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
        }}
      />
      <Tab.Screen
        name=\"Profile\"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
        }}
      />
      {isHost && (
        <Tab.Screen
          name=\"Host\"
          component={HostDashboardScreen}
          options={{
            tabBarLabel: 'Anfitrião',
          }}
        />
      )}
    </Tab.Navigator>
  );
};

export default MainNavigator;