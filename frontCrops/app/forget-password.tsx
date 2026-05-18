import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AuthChrome } from '../components/AuthChrome';
import { ScreenHeader } from '../components/ScreenHeader';
import { COLORS } from '../constants/theme';
import { getApiErrorMessage } from '../utils/apiError';

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'error'; text: string } | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const router = useRouter();

  const submit = async () => {
    setBanner(null);
    if (!email.trim()) {
      setEmailErr('Email is required.');
      return;
    }
    if (!emailOk(email)) {
      setEmailErr('Enter a valid email address.');
      return;
    }
    setEmailErr(null);
    setLoading(true);
    const api = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
    try {
      await axios.post(`${api}/api/forget-password`, { email: email.trim() });
      router.push({ pathname: '/verifyEmail', params: { email: email.trim() } });
    } catch (err: unknown) {
      setBanner({ type: 'error', text: getApiErrorMessage(err, 'Could not send reset code.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthChrome>
      <View className="px-6 pt-2 flex-1">
        <ScreenHeader
          title="Forgot password"
          subtitle="We will email a 6-digit code. Use it on the next screen to choose a new password."
          onBack={() => router.push('/')}
          backLabel="Sign in"
        />

        {banner ? (
          <View style={styles.bannerErr}>
            <Text style={styles.bannerErrText}>{banner.text}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setEmailErr(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@farm.com"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
          {emailErr ? <Text style={styles.fieldErr}>{emailErr}</Text> : <View style={{ height: 16, marginBottom: 12 }} />}

          <TouchableOpacity onPress={submit} disabled={loading} activeOpacity={0.92} style={[styles.primaryBtn, loading && { opacity: 0.85 }]}>
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Send reset code</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </AuthChrome>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  bannerErr: {
    marginBottom: 20,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    backgroundColor: COLORS.errorBg,
    borderColor: COLORS.errorBorder,
  },
  bannerErrText: { color: COLORS.errorText, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 20,
  },
  label: {
    color: COLORS.jetMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgMuted,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.jet,
    marginBottom: 8,
  },
  fieldErr: { color: '#B91C1C', fontSize: 12, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: COLORS.jet,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
