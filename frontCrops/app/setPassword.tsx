import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AuthChrome } from '../components/AuthChrome';
import { ScreenHeader } from '../components/ScreenHeader';
import { COLORS } from '../constants/theme';
import { getApiErrorMessage } from '../utils/apiError';

const SetNewPasswordScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[]; code?: string | string[] }>();
  const emailRaw = params.email;
  const codeRaw = params.code;
  const email =
    typeof emailRaw === 'string' ? emailRaw : Array.isArray(emailRaw) ? (emailRaw[0] ?? '') : '';
  const code =
    typeof codeRaw === 'string' ? codeRaw : Array.isArray(codeRaw) ? (codeRaw[0] ?? '') : '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'error'; text: string } | null>(null);
  const [fieldErr, setFieldErr] = useState<{ password?: string; confirm?: string }>({});

  const submit = async () => {
    setBanner(null);
    const next: typeof fieldErr = {};
    if (password.length < 6) next.password = 'Use at least 6 characters.';
    if (password !== confirm) next.confirm = 'Passwords do not match.';
    setFieldErr(next);
    if (Object.keys(next).length) return;
    if (!email || !code) {
      setBanner({ type: 'error', text: 'Missing email or code. Start over from Forgot password.' });
      return;
    }

    setLoading(true);
    const api = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
    try {
      await axios.post(`${api}/api/auth/reset`, {
        email: email.trim(),
        code,
        new_password: password,
      });
      router.replace('/confirmation_email');
    } catch (err: unknown) {
      setBanner({ type: 'error', text: getApiErrorMessage(err, 'Could not reset password.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthChrome>
      <View className="px-6 pt-2 flex-1">
        <ScreenHeader
          title="New password"
          subtitle="Pick something memorable and unique to this app."
          onBack={() => router.back()}
        />

        {banner ? (
          <View style={styles.bannerErr}>
            <Text style={styles.bannerErrText}>{banner.text}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setFieldErr((p) => ({ ...p, password: undefined }));
              }}
              secureTextEntry={!showPw}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              style={styles.passwordInput}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={12} style={{ padding: 8 }}>
              {showPw ? <EyeOff color={COLORS.textSecondary} size={22} /> : <Eye color={COLORS.textSecondary} size={22} />}
            </TouchableOpacity>
          </View>
          {fieldErr.password ? (
            <Text style={styles.fieldErr}>{fieldErr.password}</Text>
          ) : (
            <Text style={styles.hint}>Minimum 6 characters.</Text>
          )}

          <Text style={[styles.label, { marginTop: 16 }]}>Confirm password</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                setFieldErr((p) => ({ ...p, confirm: undefined }));
              }}
              secureTextEntry={!showConfirm}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              style={styles.passwordInput}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={12} style={{ padding: 8 }}>
              {showConfirm ? (
                <EyeOff color={COLORS.textSecondary} size={22} />
              ) : (
                <Eye color={COLORS.textSecondary} size={22} />
              )}
            </TouchableOpacity>
          </View>
          {fieldErr.confirm ? <Text style={styles.fieldErr}>{fieldErr.confirm}</Text> : <View style={{ height: 12 }} />}

          <TouchableOpacity
            onPress={submit}
            disabled={loading}
            activeOpacity={0.92}
            style={[styles.primaryBtn, loading && { opacity: 0.85 }]}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Save password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </AuthChrome>
  );
};

export default SetNewPasswordScreen;

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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgMuted,
    paddingRight: 8,
    marginBottom: 4,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.jet,
    minWidth: 0,
  },
  fieldErr: { color: '#B91C1C', fontSize: 12, marginBottom: 16 },
  hint: { color: COLORS.textMuted, fontSize: 11, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: COLORS.jet,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
