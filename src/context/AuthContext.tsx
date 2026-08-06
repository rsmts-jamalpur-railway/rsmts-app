import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextData {
  role: string | null;
  token: string | null;
  userId: string | null;
  isLoading: boolean;
  login: (role: string, token: string, userId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      const storedRole = await AsyncStorage.getItem('@Auth:role');
      const storedToken = await AsyncStorage.getItem('@Auth:token');
      const storedUserId = await AsyncStorage.getItem('@Auth:userId');

      if (storedRole && storedToken && storedUserId) {
        setRole(storedRole);
        setToken(storedToken);
        setUserId(storedUserId);
      }
    } catch (error) {
      console.error('Failed to load auth state', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newRole: string, newToken: string, newUserId: string) => {
    try {
      await AsyncStorage.setItem('@Auth:role', newRole);
      await AsyncStorage.setItem('@Auth:token', newToken);
      await AsyncStorage.setItem('@Auth:userId', newUserId);
      setRole(newRole);
      setToken(newToken);
      setUserId(newUserId);
    } catch (error) {
      console.error('Failed to save auth state', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('@Auth:role');
      await AsyncStorage.removeItem('@Auth:token');
      await AsyncStorage.removeItem('@Auth:userId');
      setRole(null);
      setToken(null);
      setUserId(null);
    } catch (error) {
      console.error('Failed to remove auth state', error);
    }
  };

  return (
    <AuthContext.Provider value={{ role, token, userId, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
