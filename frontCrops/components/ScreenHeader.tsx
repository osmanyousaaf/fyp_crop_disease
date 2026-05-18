import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS } from '../constants/theme';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn} activeOpacity={0.7}>
        <ChevronLeft size={22} color={COLORS.jet} />
        <Text style={styles.backLabel}>{backLabel}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  backLabel: {
    color: COLORS.jetMuted,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 2,
  },
  title: {
    color: COLORS.jet,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 12,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 340,
  },
});
