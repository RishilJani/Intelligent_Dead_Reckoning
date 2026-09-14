import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '@/components/common/LinearGradient';
import { SkyColors, SkyGradients } from '@/constants/theme';
import { useAuth } from '@/services/authContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, continueAsGuest } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim()) {
      setErrorMessage('Please enter your email.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email, password);
      setIsLoading(false);
      if (result.success) {
        router.replace('/');
      } else {
        setErrorMessage(result.error || 'Invalid credentials.');
      }
    } catch (_err) {
      setIsLoading(false);
      setErrorMessage('An error occurred during login.');
    }
  };

  const handleGuestBack = () => {
    continueAsGuest();
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingTop: Math.max(insets.top + 20, 40), paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
        keyboardShouldPersistTaps="handled">

        {/* Top Header / Brand */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.guestPill}
            onPress={handleGuestBack}
            activeOpacity={0.8}>
            <Text style={styles.guestPillText}>
              ← Back to Map (Guest)
            </Text>
          </TouchableOpacity>

          {/* Circular Logo View */}
          <View style={styles.circularLogoContainer}>
            <Image
              source={require('@/assets/images/logo.jpg')}
              style={styles.circularLogoImage}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Log in to continue navigating, search locations, and access Dead Reckoning.
          </Text>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          {/* Danger Error Message */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.fieldIcon}>✉️</Text>
              <TextInput
                style={styles.textInput}
                placeholder="name@example.com"
                placeholderTextColor="#6b7280"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (errorMessage) setErrorMessage('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.fieldIcon}>🔒</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter password"
                placeholderTextColor="#6b7280"
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (errorMessage) setErrorMessage('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                activeOpacity={0.7}>
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary Action Button (#2C5EAD) */}
          <TouchableOpacity
            style={styles.primaryBtnWrapper}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}>
            <LinearGradient
              colors={SkyGradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtnGradient}>
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Log In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Sign Up Redirection Option */}
          <View style={styles.footerRow}>
            <Text style={styles.footerQuestion}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/signup')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Demo Credentials Info */}
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>💡 Quick Note</Text>
          <Text style={styles.demoText}>
            First-time users can sign up with any username & email, or log in directly to start navigating.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  guestPill: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  guestPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C5EAD',
  },
  circularLogoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#2C5EAD',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C5EAD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 14,
  },
  circularLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 320,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(44, 94, 173, 0.14)',
    backgroundColor: '#ffffff',
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SkyColors.dangerBg,
    borderWidth: 1,
    borderColor: SkyColors.dangerBorder,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    flex: 1,
    color: '#E45742',
    fontSize: 13,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 48,
  },
  fieldIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#000000',
    fontSize: 15,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  eyeIcon: {
    fontSize: 16,
  },
  primaryBtnWrapper: {
    borderRadius: 16,
    height: 50,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#2C5EAD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  footerQuestion: {
    color: '#000000',
    fontSize: 14,
  },
  footerLink: {
    color: '#2C5EAD',
    fontSize: 14,
    fontWeight: '700',
  },
  demoBox: {
    width: '100%',
    maxWidth: 420,
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(44, 94, 173, 0.12)',
  },
  demoTitle: {
    color: '#2C5EAD',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  demoText: {
    color: '#000000',
    fontSize: 12,
    lineHeight: 18,
  },
});
