/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DatabaseProvider from '@nozbe/watermelondb/react/DatabaseProvider';
import { database } from './src/database';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <DatabaseProvider database={database}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

export default App;
