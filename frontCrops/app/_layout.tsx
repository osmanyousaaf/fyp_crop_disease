import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { AuthProvider } from '../context/AuthContext';
import { SectorProvider } from '../context/SectorContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <AuthProvider>
        <SectorProvider>
        <Stack>
          <Stack.Screen name='index' options={{ headerShown: false, }} />
          <Stack.Screen name='select-sector' options={{ headerShown: false }} />
          <Stack.Screen name='forget-password' options={{ headerShown: false }} />
          <Stack.Screen name='verifyEmail' options={{ headerShown: false }} />
          <Stack.Screen name='confirmation_email' options={{ headerShown: false }} />
          <Stack.Screen name='setPassword' options={{ headerShown: false }} />
          <Stack.Screen name='ScanningProcess' options={{ headerShown: false }} />
          <Stack.Screen name='startScaningProcess' options={{ headerShown: false }} />
          <Stack.Screen name='ResultScreen' options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="dark" />
        </SectorProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}