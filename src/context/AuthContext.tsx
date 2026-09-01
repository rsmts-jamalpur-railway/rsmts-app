import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextData {
  role: string | null;
  token: string | null;
  userId: string | null;
  employeeId: string | null;
  assignedLocationId: string | null;
  permissions: string[];
  isLoading: boolean;
  login: (role: string, token: string, userId: string, employeeId: string, permissions: string[], assignedLocationId?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [assignedLocationId, setAssignedLocationId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      const storedRole = await AsyncStorage.getItem('@Auth:role');
      const storedToken = await AsyncStorage.getItem('@Auth:token');
      const storedUserId = await AsyncStorage.getItem('@Auth:userId');
      const storedEmployeeId = await AsyncStorage.getItem('@Auth:employeeId');
      const storedAssignedLocationId = await AsyncStorage.getItem('@Auth:assignedLocationId');
      const storedPermissions = await AsyncStorage.getItem('@Auth:permissions');

      if (storedRole && storedToken && storedUserId && storedEmployeeId) {
        setRole(storedRole);
        setToken(storedToken);
        setUserId(storedUserId);
        setEmployeeId(storedEmployeeId);
        setAssignedLocationId(storedAssignedLocationId);
        setPermissions(storedPermissions ? JSON.parse(storedPermissions) : []);
      }
    } catch (error) {
      console.error('Failed to load auth state', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newRole: string, newToken: string, newUserId: string, newEmployeeId: string, newPermissions: string[], newAssignedLocationId?: string | null) => {
    try {
      await AsyncStorage.setItem('@Auth:role', newRole);
      await AsyncStorage.setItem('@Auth:token', newToken);
      await AsyncStorage.setItem('@Auth:userId', newUserId);
      await AsyncStorage.setItem('@Auth:employeeId', newEmployeeId);
      await AsyncStorage.setItem('@Auth:permissions', JSON.stringify(newPermissions));
      
      if (newAssignedLocationId) {
        await AsyncStorage.setItem('@Auth:assignedLocationId', newAssignedLocationId);
      } else {
        await AsyncStorage.removeItem('@Auth:assignedLocationId');
      }
      
      setRole(newRole);
      setToken(newToken);
      setUserId(newUserId);
      setEmployeeId(newEmployeeId);
      setPermissions(newPermissions);
      setAssignedLocationId(newAssignedLocationId || null);
    } catch (error) {
      console.error('Failed to save auth state', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('@Auth:role');
      await AsyncStorage.removeItem('@Auth:token');
      await AsyncStorage.removeItem('@Auth:userId');
      await AsyncStorage.removeItem('@Auth:employeeId');
      await AsyncStorage.removeItem('@Auth:assignedLocationId');
      await AsyncStorage.removeItem('@Auth:permissions');
      
      setRole(null);
      setToken(null);
      setUserId(null);
      setEmployeeId(null);
      setAssignedLocationId(null);
      setPermissions([]);
    } catch (error) {
      console.error('Failed to remove auth state', error);
    }
  };

  const can = useCallback((permission: string) => {
    return permissions.includes(permission);
  }, [permissions]);

  return (
    <AuthContext.Provider value={{ role, token, userId, employeeId, assignedLocationId, permissions, isLoading, login, logout, can }}>
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
