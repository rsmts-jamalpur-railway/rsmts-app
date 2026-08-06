import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

// Real screen imports
import Splash from '../screens/Splash';
import LoginScreen from '../screens/auth/LoginScreen';
import YardMasterFlow from '../screens/roles/YardMasterFlow';
import RepairShopFlow from '../screens/roles/RepairShopFlow';
import QAFlow from '../screens/roles/QAFlow';
import AdminGodMode from '../screens/roles/AdminGodMode';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return <Splash onFinish={() => {}} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {role === null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            {role === 'SSE_TPT_Rail' && <Stack.Screen name="Yard" component={YardMasterFlow} />}
            {role === 'Shop_Incharge' && <Stack.Screen name="Shop" component={RepairShopFlow} />}
            {role === 'WRS_5_Staff' && <Stack.Screen name="QA" component={QAFlow} />}
            {(role === 'Administrator' || role === 'Management') && <Stack.Screen name="Admin" component={AdminGodMode} />}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

