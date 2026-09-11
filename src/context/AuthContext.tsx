import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export interface UserProfile {
  id: string;
  name?: string;
  roles: string[];
  assigned_location_id?: string | null;
  employee_id?: string | null;
}

export interface LoginParams {
  role?: string;
  roles?: string[];
  token: string;
  userId: string;
  employeeId?: string;
  userName?: string;
  assignedLocationId?: string | null;
  permissions?: string[];
}

interface AuthContextData {
  role: string | null;
  roles: string[];
  token: string | null;
  userId: string | null;
  employeeId: string | null;
  userName: string | null;
  assignedLocationId: string | null;
  permissions: string[];
  isLoading: boolean;
  login: (
    paramsOrRole: LoginParams | string,
    token?: string,
    userId?: string,
    employeeId?: string,
    permissions?: string[],
    assignedLocationId?: string | null
  ) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (newRole: string) => Promise<void>;
  can: (permission: string) => boolean;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  YARD_CONTROLLER: [
    'yard:receive', 'yard:allocate', 'yard:dispatch', 'yard:reallocate', 'yard:cancel', 'yard:view', 'exception:report'
  ],
  YARD_MASTER: [
    'yard:receive', 'yard:allocate', 'yard:dispatch', 'yard:reallocate', 'yard:cancel', 'yard:view', 'exception:report'
  ],
  REPAIR_SUPERVISOR: [
    'repair:start', 'repair:hold', 'repair:resume', 'repair:close', 'repair:reject', 'repair:missing', 'repair:view', 'exception:report'
  ],
  MANUFACTURING_SUPERVISOR: [
    'mfg:start', 'mfg:close', 'mfg:view', 'exception:report'
  ],
  MFG_SUPERVISOR: [
    'mfg:start', 'mfg:close', 'mfg:view', 'exception:report'
  ],
  QA_INSPECTOR: [
    'qa:inspect', 'qa:view', 'exception:report'
  ],
  SYSTEM_ADMIN: ['*'],
  MANAGEMENT: ['*'],
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [assignedLocationId, setAssignedLocationId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStorageData();

    // Listen for token expiry emitted by the axios 401 interceptor.
    // Resets in-memory state so RootNavigator redirects to Login immediately.
    const sub = DeviceEventEmitter.addListener('AUTH_SESSION_EXPIRED', async () => {
      try {
        await AsyncStorage.removeItem('@Auth:role');
        await AsyncStorage.removeItem('@Auth:roles');
        await AsyncStorage.removeItem('@Auth:token');
        await AsyncStorage.removeItem('@Auth:userId');
        await AsyncStorage.removeItem('@Auth:employeeId');
        await AsyncStorage.removeItem('@Auth:userName');
        await AsyncStorage.removeItem('@Auth:assignedLocationId');
        await AsyncStorage.removeItem('@Auth:permissions');
      } catch (e) {
        console.error('Failed to clear async storage on expiry', e);
      }
      setRole(null);
      setRoles([]);
      setToken(null);
      setUserId(null);
      setEmployeeId(null);
      setUserName(null);
      setAssignedLocationId(null);
      setPermissions([]);
    });
    return () => sub.remove();
  }, []);

  const loadStorageData = async () => {
    const startTime = Date.now();
    try {
      const storedRole = await AsyncStorage.getItem('@Auth:role');
      const storedRoles = await AsyncStorage.getItem('@Auth:roles');
      const storedToken = await AsyncStorage.getItem('@Auth:token');
      const storedUserId = await AsyncStorage.getItem('@Auth:userId');
      const storedEmployeeId = await AsyncStorage.getItem('@Auth:employeeId');
      const storedUserName = await AsyncStorage.getItem('@Auth:userName');
      const storedAssignedLocationId = await AsyncStorage.getItem('@Auth:assignedLocationId');
      const storedPermissions = await AsyncStorage.getItem('@Auth:permissions');

      if (storedToken && (storedRole || storedRoles)) {
        const parsedRoles = storedRoles ? JSON.parse(storedRoles) : storedRole ? [storedRole] : [];
        setRole(storedRole || parsedRoles[0] || null);
        setRoles(parsedRoles);
        setToken(storedToken);
        setUserId(storedUserId);
        setEmployeeId(storedEmployeeId || storedUserId);
        setUserName(storedUserName);
        setAssignedLocationId(storedAssignedLocationId);
        setPermissions(storedPermissions ? JSON.parse(storedPermissions) : []);
      }
    } catch (error) {
      console.error('Failed to load auth state', error);
    } finally {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 3000 - elapsed); // Minimum 3 seconds
      setTimeout(() => {
        setIsLoading(false);
      }, remainingTime);
    }
  };

  const login = async (
    paramsOrRole: LoginParams | string,
    argToken?: string,
    argUserId?: string,
    argEmployeeId?: string,
    argPermissions?: string[],
    argAssignedLocationId?: string | null
  ) => {
    try {
      let finalRole = 'VIEWER';
      let finalRoles: string[] = [];
      let finalToken = '';
      let finalUserId = '';
      let finalEmployeeId = '';
      let finalUserName = '';
      let finalAssignedLoc: string | null = null;
      let finalPermissions: string[] = [];

      if (typeof paramsOrRole === 'object') {
        finalToken = paramsOrRole.token;
        finalUserId = paramsOrRole.userId;
        finalEmployeeId = paramsOrRole.employeeId || paramsOrRole.userId;
        finalUserName = paramsOrRole.userName || '';
        finalRoles = paramsOrRole.roles && paramsOrRole.roles.length > 0
          ? paramsOrRole.roles
          : paramsOrRole.role ? [paramsOrRole.role] : ['VIEWER'];
        finalRole = paramsOrRole.role || finalRoles[0] || 'VIEWER';
        finalAssignedLoc = paramsOrRole.assignedLocationId || null;
        finalPermissions = paramsOrRole.permissions || [];
      } else {
        finalRole = paramsOrRole;
        finalRoles = [paramsOrRole];
        finalToken = argToken || '';
        finalUserId = argUserId || '';
        finalEmployeeId = argEmployeeId || argUserId || '';
        finalPermissions = argPermissions || [];
        finalAssignedLoc = argAssignedLocationId || null;
      }

      await AsyncStorage.setItem('@Auth:role', finalRole);
      await AsyncStorage.setItem('@Auth:roles', JSON.stringify(finalRoles));
      await AsyncStorage.setItem('@Auth:token', finalToken);
      await AsyncStorage.setItem('@Auth:userId', finalUserId);
      await AsyncStorage.setItem('@Auth:employeeId', finalEmployeeId);
      if (finalUserName) await AsyncStorage.setItem('@Auth:userName', finalUserName);
      await AsyncStorage.setItem('@Auth:permissions', JSON.stringify(finalPermissions));
      
      if (finalAssignedLoc) {
        await AsyncStorage.setItem('@Auth:assignedLocationId', finalAssignedLoc);
      } else {
        await AsyncStorage.removeItem('@Auth:assignedLocationId');
      }
      
      setRole(finalRole);
      setRoles(finalRoles);
      setToken(finalToken);
      setUserId(finalUserId);
      setEmployeeId(finalEmployeeId);
      setUserName(finalUserName || null);
      setPermissions(finalPermissions);
      setAssignedLocationId(finalAssignedLoc);
    } catch (error) {
      console.error('Failed to save auth state', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('@Auth:role');
      await AsyncStorage.removeItem('@Auth:roles');
      await AsyncStorage.removeItem('@Auth:token');
      await AsyncStorage.removeItem('@Auth:userId');
      await AsyncStorage.removeItem('@Auth:employeeId');
      await AsyncStorage.removeItem('@Auth:userName');
      await AsyncStorage.removeItem('@Auth:assignedLocationId');
      await AsyncStorage.removeItem('@Auth:permissions');
      
      setRole(null);
      setRoles([]);
      setToken(null);
      setUserId(null);
      setEmployeeId(null);
      setUserName(null);
      setAssignedLocationId(null);
      setPermissions([]);
    } catch (error) {
      console.error('Failed to remove auth state', error);
    }
  };

  const switchRole = useCallback(async (newRole: string) => {
    setRole(newRole);
    await AsyncStorage.setItem('@Auth:role', newRole);
  }, []);

  const can = useCallback((permission: string) => {
    if (role === 'SYSTEM_ADMIN' || role === 'MANAGEMENT' || roles?.includes('SYSTEM_ADMIN') || roles?.includes('MANAGEMENT')) {
      return true;
    }
    if (permissions.includes(permission) || permissions.includes('*')) {
      return true;
    }
    const derived = (role && ROLE_PERMISSIONS[role]) || [];
    if (derived.includes(permission) || derived.includes('*')) {
      return true;
    }
    for (const r of (roles || [])) {
      const perms = ROLE_PERMISSIONS[r] || [];
      if (perms.includes(permission) || perms.includes('*')) {
        return true;
      }
    }
    return false;
  }, [role, roles, permissions]);

  return (
    <AuthContext.Provider value={{
      role,
      roles,
      token,
      userId,
      employeeId,
      userName,
      assignedLocationId,
      permissions,
      isLoading,
      login,
      logout,
      switchRole,
      can,
    }}>
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
