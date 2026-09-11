import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../services/api/axios';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter Employee ID / Email and Password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', {
        identifier: email.trim(),
        password: password,
      });

      const payload = response.data?.data || response.data;
      const token = payload.tokens?.access_token || payload.access_token;
      const user = payload.user || {};
      const roles: string[] = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : ['VIEWER']);
      const primaryRole = roles[0] || 'VIEWER';
      const userId = user.id || '';
      const employeeId = user.employee_id || user.employee_number || user.id || '';
      const userName = user.name || '';
      const assignedLocationId = user.assigned_location_id || null;

      await login({
        role: primaryRole,
        roles,
        token,
        userId,
        employeeId,
        userName,
        assignedLocationId,
      });
    } catch (err: any) {
      console.error('Login Error:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Invalid Credentials or Backend Offline');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (id: string, pwd: string) => {
    setEmail(id);
    setPassword(pwd);
    setError('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('../../assets/logo_bg_removed.png')} style={{width: 80, height: 80, marginBottom: 16}} resizeMode="contain" />
          <Text style={styles.title}>Login</Text>
          <Text style={styles.subtitle}>Jamalpur Workshop Operations</Text>

          {/* Quick Demo Fill Chips — DEV ONLY */}
          {__DEV__ && (
          <View style={styles.chipRow}>
            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => fillCredentials('admin@rsmts.gov.in', 'Admin@123!')}
            >
              <Text style={styles.chipText}>System Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.chip} 
              onPress={() => fillCredentials('farhanaiyyar04@gmail.com', 'Admin@123!')}
            >
              <Text style={styles.chipText}>Supervisor</Text>
            </TouchableOpacity>
          </View>
          )}
        </View>

        <View style={styles.formContainer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputGroup}>
            <Icon name="email-outline" size={20} color="#A0AEC0" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your mail"
              placeholderTextColor="#A0AEC0"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Icon name="lock-outline" size={20} color="#A0AEC0" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#A0AEC0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Icon name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#A0AEC0" />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity style={styles.checkboxContainer} onPress={() => setRememberMe(!rememberMe)}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Icon name="check" size={12} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkboxLabel}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity>
              <Text style={styles.forgotLink}>Forgot password</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* This flex spacer pushes the contact text to the very bottom of the screen */}
        <View style={{ flex: 1 }} />

        <View style={{ alignItems: 'center', paddingTop: 32 }}>
          <Text style={{ fontSize: 12, color: '#718096' }}>
            Don't have an account? <Text style={{ color: '#38B2AC', fontWeight: '500' }}>Contact administrator</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: '25%',
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A202C',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9999,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 20,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#1A202C',
    fontSize: 15,
    height: '100%',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#38B2AC',
    borderColor: '#38B2AC',
  },
  checkboxLabel: {
    color: '#718096',
    fontSize: 14,
  },
  forgotLink: {
    color: '#38B2AC',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#38B2AC',
    height: 56,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#E53E3E',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  }
});
