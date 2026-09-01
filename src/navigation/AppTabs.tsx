import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';

import YardStack from '../screens/roles/yard/YardStack';
import RepairStack from '../screens/roles/repair/RepairStack';
import MfgStack from '../screens/roles/mfg/MfgStack';
import QAStack from '../screens/roles/qa/QAStack';
import SearchScreen from '../screens/common/SearchWagon';
import SyncStatusScreen from '../screens/roles/common/SyncStatusScreen';

const Tab = createBottomTabNavigator();

export default function AppTabs() {
  const { role } = useAuth();

  const getDashboardComponent = () => {
    switch (role) {
      case 'YARD_MASTER': return YardStack;
      case 'REPAIR_SUPERVISOR': return RepairStack;
      case 'MFG_SUPERVISOR': return MfgStack;
      case 'QA_INSPECTOR': return QAStack;
      default: return YardStack; // Fallback handled by RootNavigator
    }
  };

  return (
    <Tab.Navigator
      screenOptions={{
        header: () => <Header />,
        tabBarActiveTintColor: '#0A74DA',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          elevation: 0,
        }
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={getDashboardComponent()}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="view-dashboard-outline" color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="magnify" color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Sync"
        component={SyncStatusScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="sync" color={color} size={size} />
        }}
      />
    </Tab.Navigator>
  );
}
