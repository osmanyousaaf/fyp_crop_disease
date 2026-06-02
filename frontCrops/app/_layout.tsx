import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SectorProvider } from '../context/SectorContext';
import { COLORS } from '../constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

if (__DEV__) {
  console.log('[CropApp] Root layout loaded — Expo SDK 54');
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: 'red', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
            Startup Error
          </Text>
          <ScrollView style={{ maxHeight: 400 }}>
            <Text style={{ color: '#333', fontSize: 13, marginBottom: 8 }}>
              {this.state.error.message}
            </Text>
            <Text style={{ color: '#888', fontSize: 10 }}>
              {this.state.error.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppNavigation() {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.jet} />
        <Text style={{ marginTop: 16, color: COLORS.textSecondary, fontSize: 15 }}>
          Starting app…
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="select-sector" options={{ headerShown: false }} />
        <Stack.Screen name="forget-password" options={{ headerShown: false }} />
        <Stack.Screen name="verifyEmail" options={{ headerShown: false }} />
        <Stack.Screen name="confirmation_email" options={{ headerShown: false }} />
        <Stack.Screen name="setPassword" options={{ headerShown: false }} />
        <Stack.Screen name="ScanningProcess" options={{ headerShown: false }} />
        <Stack.Screen name="startScaningProcess" options={{ headerShown: false }} />
        <Stack.Screen name="ResultScreen" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <AuthProvider>
          <SectorProvider>
            <AppNavigation />
          </SectorProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}