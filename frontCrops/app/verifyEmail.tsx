import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Keyboard,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { AuthChrome } from '../components/AuthChrome';
import { ScreenHeader } from '../components/ScreenHeader';
import { COLORS } from '../constants/theme';

const CODE_LENGTH = 6;

const VerifyEmailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const rawEmail = params.email;
  const email =
    typeof rawEmail === 'string' ? rawEmail : Array.isArray(rawEmail) ? (rawEmail[0] ?? '') : '';

  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [banner, setBanner] = useState<{ type: 'error'; text: string } | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const codeString = digits.join('');

  const setDigitAt = (index: number, ch: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = ch;
      return next;
    });
  };

  const onChangeDigit = (raw: string, index: number) => {
    setBanner(null);
    const strip = raw.replace(/\D/g, '');
    if (!strip) {
      setDigitAt(index, '');
      return;
    }
    if (strip.length === 1) {
      setDigitAt(index, strip);
      if (index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
      return;
    }
    const pasted = strip.slice(0, CODE_LENGTH).split('');
    let lastFilled = index;
    setDigits((prev) => {
      const filled = [...prev];
      for (let i = 0; i < pasted.length && index + i < CODE_LENGTH; i++) {
        filled[index + i] = pasted[i];
      }
      lastFilled = Math.min(index + pasted.length - 1, CODE_LENGTH - 1);
      return filled;
    });
    requestAnimationFrame(() => inputRefs.current[lastFilled]?.focus());
    Keyboard.dismiss();
  };

  const onKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setDigitAt(index - 1, '');
    }
  };

  const verify = () => {
    if (codeString.length !== CODE_LENGTH) {
      setBanner({ type: 'error', text: `Enter all ${CODE_LENGTH} digits from your email.` });
      return;
    }
    if (!email.trim()) {
      setBanner({ type: 'error', text: 'Missing email. Start again from Forgot password.' });
      return;
    }
    setBanner(null);
    router.push({ pathname: '/setPassword', params: { email: email.trim(), code: codeString } });
  };

  return (
    <AuthChrome>
      <View className="px-6 pt-2 flex-1">
        <ScreenHeader
          title="Verification code"
          subtitle={`Enter the ${CODE_LENGTH}-digit code sent to ${email || 'your inbox'}.`}
          onBack={() => router.back()}
        />

        {banner ? (
          <View style={styles.bannerErr}>
            <Text style={styles.bannerErrText}>{banner.text}</Text>
          </View>
        ) : null}

        <View style={styles.digitCard}>
          <View style={styles.digitRow}>
            {digits.map((d, index) => (
              <TextInput
                key={index}
                ref={(r) => {
                  inputRefs.current[index] = r;
                }}
                value={d}
                onChangeText={(t) => onChangeDigit(t, index)}
                onKeyPress={(e) => onKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                textAlign="center"
                selectTextOnFocus
                placeholder="·"
                placeholderTextColor={COLORS.textMuted}
                style={styles.digitInput}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity onPress={verify} activeOpacity={0.92} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </AuthChrome>
  );
};

export default VerifyEmailScreen;

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
  digitCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 20,
    marginBottom: 24,
  },
  digitRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  digitInput: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    maxHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.bgMuted,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.jet,
  },
  primaryBtn: {
    backgroundColor: COLORS.jet,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
