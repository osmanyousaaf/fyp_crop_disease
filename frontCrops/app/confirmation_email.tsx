import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthChrome } from '../components/AuthChrome';
import { COLORS } from '../constants/theme';

export default function ConfirmationEmailScreen() {
  const router = useRouter();

  return (
    <AuthChrome scroll={false}>
      <View className="flex-1 px-6 justify-center">
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="shield-check" size={44} color={COLORS.jet} />
          </View>
          <Text style={styles.title}>You are all set</Text>
          <Text style={styles.body}>
            Password updated successfully. Sign in with your new credentials to run scans and export reports.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.92} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthChrome>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 32,
    alignItems: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.bgSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: COLORS.jet,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: COLORS.jet,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
