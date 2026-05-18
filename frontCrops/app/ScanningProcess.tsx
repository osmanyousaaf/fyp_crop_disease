import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { cacheDirectory, copyAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSector } from '@/context/SectorContext';
import { COLORS } from '@/constants/theme';
import { getApiErrorMessage } from '@/utils/apiError';

const { width, height } = Dimensions.get('window');

/** Full predict payload (minus heatmap file) — avoids React Navigation param size limits on Android. */
const PENDING_PREDICT_JSON_KEY = 'pending_predict_result_v1';

type Phase = 'menu' | 'camera' | 'preview';

/** Ensure base64 segment length is a multiple of 4 (fixes Flask/expo mismatches). */
function normalizeDataUri(dataUri: string): string {
  const trimmed = dataUri.trim();
  const comma = trimmed.indexOf(',');
  if (comma === -1) {
    const body = padBase64Payload(trimmed);
    return `data:image/jpeg;base64,${body}`;
  }
  const header = trimmed.slice(0, comma);
  const body = padBase64Payload(trimmed.slice(comma + 1));
  return `${header},${body}`;
}

function padBase64Payload(b64: string): string {
  let s = b64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const m = s.length % 4;
  if (m) s += '='.repeat(4 - m);
  return s;
}

/** Camera URIs are not always readable as `file://`; copy into cache when needed (Android). */
async function copyToCacheIfNeeded(uri: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  /** Expo Web returns `data:image/...;base64,...` — FileSystem copy/read does not apply. */
  if (uri.startsWith('data:')) return uri;
  const dir = cacheDirectory;
  if (!dir) throw new Error('App cache directory is unavailable');
  const dest = `${dir}captured-${Date.now()}.jpg`;
  await copyAsync({ from: uri, to: dest });
  return dest;
}

async function imageUriToPayloadAndPreview(localUri: string, mimeType: string): Promise<{ previewUri: string; payloadDataUri: string }> {
  if (localUri.startsWith('data:')) {
    const payloadDataUri = normalizeDataUri(localUri);
    return { previewUri: payloadDataUri, payloadDataUri };
  }
  const stableUri = await copyToCacheIfNeeded(localUri);
  const b64 = await readAsStringAsync(stableUri, { encoding: 'base64' });
  return {
    previewUri: stableUri,
    payloadDataUri: normalizeDataUri(`data:${mimeType};base64,${b64}`),
  };
}

export default function PlantScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sector, sectorMeta, isLoading: sectorLoading } = useSector();

  const [phase, setPhase] = useState<Phase>('menu');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [busyImage, setBusyImage] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [payloadBase64, setPayloadBase64] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewSlide = useRef(new Animated.Value(12)).current;
  const analyzePulse = useRef(new Animated.Value(1)).current;
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!sectorLoading && !sector) {
      router.replace({ pathname: '/select-sector' });
    }
  }, [sectorLoading, sector, router]);

  const uploadImageToAPI = async (base64Data: string) => {
    if (!sector) throw new Error('No crop sector selected');
    const api = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
    if (!api) throw new Error('EXPO_PUBLIC_API_URL is not set');
    const res = await axios.post(`${api}/api/predict`, {
      image: normalizeDataUri(base64Data),
      sector,
    });
    return res.data;
  };

  const runAnalysis = async () => {
    if (!payloadBase64 || !capturedImage) {
      Alert.alert('Missing image', 'Choose or capture a photo first.');
      return;
    }
    setIsAnalyzing(true);
    try {
      const apiPromise = await uploadImageToAPI(payloadBase64);
      const data = { ...(apiPromise as Record<string, unknown>) };
      const hm = data.heatmap_png_base64;
      if (typeof hm === 'string' && hm.length > 0) {
        delete data.heatmap_png_base64;
        await AsyncStorage.setItem('pending_heatmap_b64', hm);
      }
      await AsyncStorage.setItem(PENDING_PREDICT_JSON_KEY, JSON.stringify(data));
      router.push({
        pathname: '/ResultScreen',
        params: {
          imageUri: capturedImage,
          fromPending: '1',
        },
      });
    } catch (error: unknown) {
      Alert.alert('Analysis failed', getApiErrorMessage(error, 'Could not reach the server or process the image.'));
      console.error('Predict error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo library access to select an image.');
        return;
      }

      setBusyImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.92,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const mime = asset.mimeType ?? 'image/jpeg';
      if (asset.base64 && asset.base64.length > 0) {
        setCapturedImage(asset.uri);
        setPayloadBase64(normalizeDataUri(`data:${mime};base64,${asset.base64}`));
      } else {
        const { previewUri, payloadDataUri } = await imageUriToPayloadAndPreview(asset.uri, mime);
        setCapturedImage(previewUri);
        setPayloadBase64(payloadDataUri);
      }
      setPhase('preview');
    } catch (e) {
      console.error(e);
      Alert.alert('Gallery error', 'Could not read the selected image.');
    } finally {
      setBusyImage(false);
    }
  };

  const openCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera disabled', 'Allow camera access to take a leaf photo.');
      return;
    }
    setCameraReady(false);
    setPhase('camera');
  };

  useEffect(() => {
    if (phase === 'camera') setCameraReady(false);
  }, [phase]);

  /** If `onCameraReady` never fires (some layouts/devices), still allow capture after a short wait. */
  useEffect(() => {
    if (phase !== 'camera') return;
    const fallbackMs = 2800;
    const id = setTimeout(() => {
      setCameraReady(true);
    }, fallbackMs);
    return () => clearTimeout(id);
  }, [phase]);

  const handleCapture = async () => {
    try {
      const cam = cameraRef.current;
      if (!cam) {
        Alert.alert('Camera', 'Camera is not ready yet. Try again.');
        return;
      }
      setBusyImage(true);
      const photo = await cam.takePictureAsync({
        quality: 0.88,
        /** Web implementation maps frames more reliably with base64 pipeline in some browsers. */
        base64: Platform.OS === 'web',
      });
      if (!photo?.uri) {
        Alert.alert('Capture failed', 'No image was returned.');
        return;
      }
      const { previewUri, payloadDataUri } = await imageUriToPayloadAndPreview(photo.uri, 'image/jpeg');
      setCapturedImage(previewUri);
      setPayloadBase64(payloadDataUri);
      setPhase('preview');
    } catch (error) {
      console.error(error);
      Alert.alert('Capture failed', getApiErrorMessage(error, 'Could not take a picture.'));
    } finally {
      setBusyImage(false);
    }
  };

  useEffect(() => {
    if (phase !== 'preview' || !capturedImage) return;
    previewOpacity.setValue(0);
    previewSlide.setValue(12);
    Animated.parallel([
      Animated.timing(previewOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(previewSlide, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [phase, capturedImage, previewOpacity, previewSlide]);

  useEffect(() => {
    if (!isAnalyzing) {
      analyzePulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(analyzePulse, {
          toValue: 0.55,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(analyzePulse, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isAnalyzing, analyzePulse]);

  const resetToMenu = () => {
    setCapturedImage(null);
    setPayloadBase64(null);
    setPhase('menu');
  };

  /* ---------- Menu (no camera) ---------- */
  if (phase === 'menu') {
    return (
      <View style={[styles.menuRoot, { paddingTop: insets.top + 12 }]}>
        <StatusBar barStyle="dark-content" />
        <TouchableOpacity onPress={() => router.back()} style={styles.menuBack} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={22} color={COLORS.jet} />
          <Text style={styles.menuBackText}>Close</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.menuScroll} keyboardShouldPersistTaps="handled">
          {busyImage ? (
            <View style={styles.menuBusyBanner}>
              <ActivityIndicator color={COLORS.jet} />
              <Text style={styles.menuBusyText}>Preparing image…</Text>
            </View>
          ) : null}

          <Text style={styles.menuTitle}>Analyze leaf</Text>
          <Text style={styles.menuSub}>
            {sectorMeta?.brand ?? 'Sector'} · pick a clear photo of one leaf. Results use the model for your selected lane
            (Canopy Lab vs AgriCore).
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, busyImage && { opacity: 0.55 }]}
            onPress={handleChooseFromGallery}
            disabled={busyImage}
            activeOpacity={0.9}
          >
            <MaterialCommunityIcons name="image-multiple-outline" size={22} color={COLORS.white} style={{ marginRight: 10 }} />
            <Text style={styles.primaryBtnText}>Choose from gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.secondaryBtn, busyImage && { opacity: 0.55 }]} onPress={openCamera} disabled={busyImage} activeOpacity={0.9}>
            <MaterialCommunityIcons name="camera-outline" size={22} color={COLORS.jet} style={{ marginRight: 10 }} />
            <Text style={styles.secondaryBtnText}>Take photo with camera</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  /* ---------- Preview + analyze ---------- */
  if (phase === 'preview' && capturedImage) {
    return (
      <View style={[styles.previewRoot, { paddingTop: insets.top + 12 }]}>
        <StatusBar barStyle="dark-content" />
        <TouchableOpacity onPress={() => setPhase('menu')} style={styles.menuBack} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.jet} />
          <Text style={styles.menuBackText}>Back</Text>
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.previewCard,
            {
              opacity: previewOpacity,
              transform: [{ translateY: previewSlide }],
            },
          ]}
        >
          <Image source={{ uri: capturedImage }} style={styles.previewThumb} resizeMode="contain" />
          <Text style={styles.previewHint}>Check framing, then run analysis.</Text>

          <TouchableOpacity
            style={[styles.primaryBtn, (isAnalyzing || !payloadBase64) && { opacity: 0.65 }]}
            onPress={runAnalysis}
            disabled={isAnalyzing || !payloadBase64}
            activeOpacity={0.9}
          >
            {isAnalyzing ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="leaf" size={22} color={COLORS.white} style={{ marginRight: 10 }} />
                <Text style={styles.primaryBtnText}>Analyze image</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={resetToMenu} disabled={isAnalyzing}>
            <Text style={styles.ghostBtnText}>Choose a different image</Text>
          </TouchableOpacity>

          {isAnalyzing ? (
            <View style={styles.analyzeOverlay} pointerEvents="auto">
              <Animated.View style={{ opacity: analyzePulse, alignItems: 'center' }}>
                <MaterialCommunityIcons name="leaf-circle-outline" size={44} color={COLORS.white} />
                <Text style={styles.analyzeOverlayTitle}>Analyzing</Text>
                <Text style={styles.analyzeOverlaySub}>Sending image to your model…</Text>
                <ActivityIndicator color={COLORS.white} style={{ marginTop: 16 }} />
              </Animated.View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    );
  }

  /* ---------- Full-screen camera ---------- */
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <TouchableOpacity onPress={() => setPhase('menu')} activeOpacity={0.85} style={[styles.closePill, { top: insets.top + 10 }]}>
        <MaterialCommunityIcons name="close" size={22} color="#f8fafc" />
        <Text style={styles.closePillText}>Close</Text>
      </TouchableOpacity>

      {/* Camera must stay empty — children break preview / `onCameraReady` on several platforms (Expo warns about this). */}
      <View style={styles.cameraStage}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(event) => {
            console.error('Camera mount error:', event);
            Alert.alert('Camera error', event.message ?? 'Could not start the camera preview.');
            setPhase('menu');
          }}
        />

        {busyImage ? (
          <View style={[styles.cameraBusyOverlay, styles.cameraOverlayLayer]} pointerEvents="auto">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.cameraBusyText}>Saving photo…</Text>
          </View>
        ) : null}

        <View style={[styles.cameraOverlayLayer, styles.scanningContainer]} pointerEvents="none">
          <View style={[styles.scanFrame, { width: width * 0.85 }]}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        <View style={[styles.cameraOverlayLayer, styles.captureButtonWrap]} pointerEvents="box-none">
          {!cameraReady && !busyImage ? (
            <Text style={styles.cameraWarmupText}>Starting camera…</Text>
          ) : null}
          {/* Pressable + explicit pointerEvents improves hit-testing over `<video>` on web. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
            disabled={busyImage}
            onPress={handleCapture}
            style={({ pressed }) => [
              styles.captureButtonOuter,
              busyImage && { opacity: 0.5 },
              pressed && !busyImage && { opacity: 0.88 },
            ]}
          >
            <View pointerEvents="none" style={styles.captureButtonInner}>
              <MaterialCommunityIcons name="camera-iris" size={22} color={COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.captureButtonText}>Capture</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menuRoot: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
  },
  menuScroll: {
    paddingBottom: 40,
  },
  menuBusyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgSubtle,
    marginBottom: 16,
  },
  menuBusyText: {
    color: COLORS.jetMuted,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 12,
  },
  menuBack: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  menuBackText: {
    color: COLORS.jet,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
  menuTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.jet,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  menuSub: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.jet,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.white,
  },
  secondaryBtnText: {
    color: COLORS.jet,
    fontWeight: '800',
    fontSize: 16,
  },
  previewRoot: {
    flex: 1,
    backgroundColor: COLORS.bgMuted,
    paddingHorizontal: 20,
  },
  previewCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  analyzeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 20,
  },
  analyzeOverlayTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
  },
  analyzeOverlaySub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  previewThumb: {
    width: '100%',
    height: height * 0.42,
    borderRadius: 12,
    backgroundColor: COLORS.bgSubtle,
    marginBottom: 16,
  },
  previewHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  ghostBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  ghostBtnText: {
    color: COLORS.jetMuted,
    fontWeight: '700',
    fontSize: 15,
  },
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  closePill: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  closePillText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  cameraStage: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  cameraOverlayLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraBusyOverlay: {
    backgroundColor: 'rgba(2,6,23,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 40,
  },
  cameraBusyText: {
    color: '#f8fafc',
    marginTop: 12,
    fontWeight: '700',
    fontSize: 15,
  },
  scanningContainer: {
    marginTop: -80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scanFrame: {
    height: 460,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 24,
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#e5e7eb',
    zIndex: 20,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 24,
  },
  captureButtonWrap: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 44,
    zIndex: 30,
  },
  cameraWarmupText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  captureButtonOuter: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  captureButtonInner: {
    minWidth: 220,
    paddingVertical: 16,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.jet,
  },
  captureButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
