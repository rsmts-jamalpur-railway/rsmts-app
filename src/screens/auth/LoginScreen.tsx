import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image, SafeAreaView } from 'react-native';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>RSMTS</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>V1.0.</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Jamalpur Workshop Operations</Text>
            <Text style={styles.subtext}>Rolling Stock Management Terminal</Text>

            <View style={styles.offlineReadyRow}>
              <View style={styles.emeraldDotSmall} />
              <Text style={styles.offlineReadyText}>Offline-first sync ready</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Sign In</Text>
              <Text style={styles.formSubtitle}>Enter your railway credentials to continue</Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View style={styles.inputGroup}>
                <Icon name="email-outline" size={20} color="#64748b" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="abc@gmail.com"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={styles.inputGroup}>
                <Icon name="lock-outline" size={20} color="#64748b" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                  <Icon name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.optionsRow}>
              <TouchableOpacity style={styles.checkboxContainer} onPress={() => setRememberMe(!rememberMe)}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Icon name="check" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxLabel}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity>
                <Text style={styles.forgotLink}>Forgot password?</Text>
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
                <View style={styles.loginBtnContent}>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Icon name="chevron-right" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* This flex spacer pushes the footer to the very bottom */}
          <View style={{ flex: 1 }} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have an account? <Text style={styles.footerLink}>Contact administrator</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 10,
  },
  emeraldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  topBarText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.5,
  },
  topBarTextMuted: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '500',
    color: '#94a3b8',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  versionBadge: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  versionText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    color: '#475569',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 4,
  },
  subtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  offlineReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  emeraldDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  offlineReadyText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#64748b',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    width: '100%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
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
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#002A4F',
    borderColor: '#002A4F',
  },
  checkboxLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
  },
  forgotLink: {
    color: '#002A4F',
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#002A4F',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 16,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
  },
  footerLink: {
    color: '#002A4F',
    fontWeight: '600',
  },
  systemStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  systemStatusText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#94a3b8',
  }
});
