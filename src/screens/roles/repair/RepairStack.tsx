import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RepairDashboard from '../RepairDashboard';
import IncomingScreen from './IncomingScreen';
import ActiveRepairsScreen from './ActiveRepairsScreen';
import OnHoldScreen from './OnHoldScreen';
import PendingQAScreen from './PendingQAScreen';

const Stack = createNativeStackNavigator();

export default function RepairStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RepairDashboardMain" component={RepairDashboard} />
      <Stack.Screen name="Incoming" component={IncomingScreen} />
      <Stack.Screen name="ActiveRepairs" component={ActiveRepairsScreen} />
      <Stack.Screen name="OnHold" component={OnHoldScreen} />
      <Stack.Screen name="PendingQA" component={PendingQAScreen} />
      <Stack.Screen name="ReportException" component={require('../common/ReportExceptionScreen').default} />
    </Stack.Navigator>
  );
}
