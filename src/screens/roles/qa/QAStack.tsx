import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QADashboard from '../QADashboard';
import QARepairListScreen from './QARepairListScreen';
import QAMfgListScreen from './QAMfgListScreen';
import RepairQAScreen from './RepairQAScreen';
import ManufacturingQAScreen from './ManufacturingQAScreen';

const Stack = createNativeStackNavigator();

export default function QAStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="QADashboard" component={QADashboard} />
      <Stack.Screen name="QARepairListScreen" component={QARepairListScreen} />
      <Stack.Screen name="QAMfgListScreen" component={QAMfgListScreen} />
      <Stack.Screen name="RepairQAScreen" component={RepairQAScreen} />
      <Stack.Screen name="ManufacturingQAScreen" component={ManufacturingQAScreen} />
      <Stack.Screen name="ReportException" component={require('../common/ReportExceptionScreen').default} />
    </Stack.Navigator>
  );
}
