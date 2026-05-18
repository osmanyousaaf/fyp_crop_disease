import React, { useEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppChrome } from '@/components/AppChrome';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSector } from '@/context/SectorContext';

const StartScaningProcess = () => {
  const { navigate } = useRouter();
  const { isGuest, token: authToken, logout } = useAuth();
  const { sector, sectorMeta, isLoading: sectorLoading } = useSector();

  useEffect(() => {
    if (!sectorLoading && !sector) {
      navigate({ pathname: '/select-sector' });
    }
  }, [sectorLoading, sector, navigate]);

  return (
    <AppChrome edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigate({ pathname: '/select-sector' })}
            activeOpacity={0.85}
            style={styles.sectorPill}
          >
            <Text style={styles.sectorPillText}>{sectorMeta?.brand ?? 'Detector'} · tap to switch</Text>
          </TouchableOpacity>
          {!isGuest && authToken ? (
            <TouchableOpacity onPress={logout} activeOpacity={0.85} style={styles.logoutPill}>
              <MaterialCommunityIcons name="logout" size={18} color="#B91C1C" />
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.guestPill}>
              <MaterialCommunityIcons name="account-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.guestText}>Guest</Text>
            </View>
          )}
        </View>

        <View style={styles.heroWrap}>
          <View style={styles.heroCard}>
            <Image
              source={require('../assets/images/app-logo.png')}
              style={styles.heroLogo}
              resizeMode="contain"
            />
            <Text style={styles.heroTag}>Scan your plant · spot disease early · protect your harvest</Text>
            <Text style={styles.heroTitle}>Clinical-grade leaf analysis in seconds</Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          {[
            { icon: 'leaf' as const, label: 'CNN model', sub: '38 classes' },
            { icon: 'chart-donut' as const, label: 'Severity', sub: '0–100%' },
            { icon: 'gradient-horizontal' as const, label: 'Grad-CAM', sub: 'Focus map' },
          ].map((item, i) => (
            <View key={item.label} style={[styles.featureCard, i > 0 && { marginLeft: 12 }]}>
              <MaterialCommunityIcons name={item.icon} size={22} color={COLORS.jetMuted} />
              <Text style={styles.featureLabel}>{item.label}</Text>
              <Text style={styles.featureSub}>{item.sub}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ctaSection}>
          <View style={styles.ctaCard}>
            <Text style={styles.ctaBody}>
              Capture a clear leaf photo or pick one from your gallery. Results include confidence, severity
              breakdown, and optional Grad-CAM overlay.
            </Text>
            <TouchableOpacity onPress={() => navigate('/ScanningProcess')} activeOpacity={0.92} style={styles.ctaBtn}>
              <MaterialCommunityIcons name="camera-iris" size={22} color={COLORS.white} style={{ marginRight: 10 }} />
              <Text style={styles.ctaBtnText}>Start scanning</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </AppChrome>
  );
};

export default StartScaningProcess;

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectorPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  sectorPillText: {
    color: COLORS.jetMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    backgroundColor: COLORS.errorBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  guestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  guestText: {
    color: COLORS.jetMuted,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  heroWrap: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  heroCard: {
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  heroLogo: {
    width: '100%',
    maxWidth: 360,
    height: 112,
    marginBottom: 20,
  },
  heroTag: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  heroTitle: {
    color: COLORS.jet,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 30,
    paddingHorizontal: 8,
  },
  featureRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  featureCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  featureLabel: {
    color: COLORS.jet,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },
  featureSub: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  ctaSection: {
    paddingHorizontal: 20,
  },
  ctaCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 24,
  },
  ctaBody: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.jet,
    borderRadius: 16,
    paddingVertical: 17,
  },
  ctaBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
