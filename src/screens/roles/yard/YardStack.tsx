import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import YardDashboard from '../YardDashboard';
import NSYInScreen from './NSYInScreen';
import AllocateScreen from './AllocateScreen';
import NSYOutScreen from './NSYOutScreen';

const Stack = createNativeStackNavigator();

export default function YardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="YardDashboardMain" component={YardDashboard} />
      <Stack.Screen name="NSYIn" component={NSYInScreen} />
      <Stack.Screen name="Allocate" component={AllocateScreen} />
      <Stack.Screen name="NSYOut" component={NSYOutScreen} />
      <Stack.Screen name="ReportException" component={require('../common/ReportExceptionScreen').default} />
    </Stack.Navigator>
  );
}
