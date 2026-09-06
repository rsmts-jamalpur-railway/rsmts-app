import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MfgDashboard from '../MfgDashboard';
import OrdersScreen from './OrdersScreen';
import ActiveOrdersScreen from './ActiveOrdersScreen';
import PendingQAScreen from './PendingQAScreen';

const Stack = createNativeStackNavigator();

export default function MfgStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MfgDashboardMain" component={MfgDashboard} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="ActiveOrders" component={ActiveOrdersScreen} />
      <Stack.Screen name="PendingQA" component={PendingQAScreen} />
      <Stack.Screen name="ReportException" component={require('../common/ReportExceptionScreen').default} />
    </Stack.Navigator>
  );
}
