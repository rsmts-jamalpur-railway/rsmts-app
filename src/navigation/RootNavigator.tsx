import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

// Real screen imports
import Splash from '../screens/Splash';
import LoginScreen from '../screens/auth/LoginScreen';
import YardMasterFlow from '../screens/roles/YardMasterFlow';
import RepairShopFlow from '../screens/roles/RepairShopFlow';
import QAFlow from '../screens/roles/QAFlow';
import AdminGodMode from '../screens/roles/AdminGodMode';
import SearchWagon from '../screens/common/SearchWagon';

import SyncTestHarnessScreen, { SYNC_TEST_HARNESS_ENABLED } from '../screens/SyncTestHarnessScreen';

const Stack = createNativeStackNavigator();

// Placeholder Shell Imports
import { View, Text } from 'react-native';

import AppTabs from './AppTabs';

const WhiteTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FFFFFF',
  },
};

export default function RootNavigator() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return <Splash onFinish={() => {}} />;
  }

  // The Role Resolver
  return (
    <NavigationContainer theme={WhiteTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {role === null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            {__DEV__ && SYNC_TEST_HARNESS_ENABLED && <Stack.Screen name="SyncTestHarness" component={SyncTestHarnessScreen} />}
            
            {/* The primary tab navigator handles rendering the correct shell based on role */}
            <Stack.Screen name="App" component={AppTabs} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

