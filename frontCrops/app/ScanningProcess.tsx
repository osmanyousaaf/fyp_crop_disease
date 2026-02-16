import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// import {File} from 'expo-file-system';
import axios from 'axios';

const { width, height } = Dimensions.get('window');


export default function PlantScannerScreen() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [imageBase64, setImageBase64] = useState<string>()
  const [scanProgress, setScanProgress] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const cameraRef = useRef<any>(null);

  // Animation values
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const scanHeightAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      // Request media library permissions for gallery access
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  const uploadImageToAPI = async (base64Data: string) => {
    try {
      console.log("API URL:", process.env.EXPO_PUBLIC_API_URL)
      const response = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/predict`, { image: base64Data }).then((res) => {
        return res.data;
      }).catch((error) => {
        console.error('API Upload Error:', error);
        throw error;
      })
      return response;
    } catch (error) {
      console.error('API Upload Error:', error);
      throw error;
    }

  };

  const startScanAnimation = async (imageUri: string, base64Data: string) => {
    // Reset animations
    scanLineAnim.setValue(0);
    scanHeightAnim.setValue(0);
    fadeAnim.setValue(0);

    // Fade in overlay
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Scanning line and height animation (synchronized)
    const scanAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanHeightAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanHeightAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ]),
      ])
    );
    scanAnimation.start();

    try {
      // Start API call in background

      const apiPromise = await uploadImageToAPI(base64Data);

      // Progress simulation - synced with API call
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 1;
        setScanProgress(progress);

        // Slow down progress near the end to wait for API
        if (progress >= 95) {
          clearInterval(progressInterval);
        }
      }, 50); // Initial speed


      // Complete the progress
      const finalProgress = setInterval(() => {
        progress += 1;
        setScanProgress(progress);

        if (progress >= 100) {
          clearInterval(finalProgress);
          scanAnimation.stop();
          setTimeout(() => {
            // Navigate to result screen with data
            router.push({
              pathname: '/ResultScreen',
              params: {
                diseaseData: JSON.stringify(apiPromise),
                imageUri: imageUri,
              },
            });
          }, 500);


          console.log('api response bro', apiPromise)
        }
      }, 20);

    } catch (error) {
      // Stop animations on error
      scanAnimation.stop();
      setIsScanning(false);
      setScanProgress(0);
      setShowImagePreview(false);

      Alert.alert(
        'Analysis Failed',
        'Failed to analyze the plant image. Please try again.',
        [{ text: 'OK' }]
      );

      console.error('Scan error:', error);
    }

  };

  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to access your photo library.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        // 🟢 FIX: Replace deprecated MediaTypeOptions.Images with MediaType.Image
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        const mimeType = result.assets[0].mimeType;
        const base64 = result.assets[0].base64;
        const formattedBase64 = `data:${mimeType};base64,${base64}`;

        setImageBase64(formattedBase64);
        setCapturedImage(imageUri);
        setShowImagePreview(true);
        setIsScanning(true);
        await startScanAnimation(imageUri, formattedBase64);

      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleCapture = async () => {
    if (cameraRef.current && !isScanning) {
      try {
        // Capture button press animation
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 0.9,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();

        // Take photo
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true
        });

        console.log('Photo captured:', photo.uri);
        const formattedBase64 = `data:image/jpeg;base64,${photo.base64}`;

        setCapturedImage(photo.uri);
        setImageBase64(formattedBase64);
        setShowImagePreview(true);
        setIsScanning(true);

        // Start scanning animation and API call
        await startScanAnimation(photo.uri, formattedBase64);

      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to capture image. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setIsScanning(false);
    setScanProgress(0);
    setShowImagePreview(false);
    scanLineAnim.stopAnimation();
    scanHeightAnim.stopAnimation();
    setCapturedImage(null);
    setImageBase64('')
  };

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  const scanHeight = scanHeightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>No access to camera</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => Camera.requestCameraPermissionsAsync()}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Camera View or Image Preview */}
      {showImagePreview && capturedImage ? (
        <View style={styles.imagePreviewContainer}>
          <Image
            source={{ uri: capturedImage }}
            style={styles.previewImage}
            resizeMode="cover"
          />

          {/* Scanning Frame on top of preview */}
          <View style={styles.scanningContainer}>
            <View style={[styles.scanFrame, { width: width * 0.85 }]}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />

              {/* Scanning animation overlay */}
              {isScanning && (
                <>
                  <Animated.View
                    style={[
                      styles.scanOverlay,
                      {
                        height: scanHeight,
                        opacity: fadeAnim,
                      }
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        transform: [{ translateY: scanLineTranslateY }],
                      }
                    ]}
                  />
                </>
              )}
            </View>

            {/* Progress indicator */}
            {isScanning && (
              <Animated.View
                style={[styles.progressContainer, { opacity: fadeAnim }]}
              >
                <MaterialCommunityIcons
                  name="loading"
                  size={20}
                  color="#4CAF50"
                />
                <Text style={styles.progressText}>
                  {scanProgress}% Analysing
                </Text>
              </Animated.View>
            )}
          </View>

          {/* Cancel Button */}
          {isScanning && (
            <Animated.View
              style={[styles.cancelButtonContainer, { opacity: fadeAnim }]}
            >
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          {/* Scanning Frame */}
          <View style={styles.scanningContainer}>
            <View style={[styles.scanFrame, { width: width * 0.85 }]}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          {/* Gallery Button */}
          {!isScanning && (
            <View style={styles.galleryButtonContainer}>
              <TouchableOpacity
                style={styles.galleryButton}
                onPress={handlePickImage}
              >
                <MaterialCommunityIcons
                  name="image-multiple"
                  size={28}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Capture Button */}
          {!isScanning && (
            <View style={styles.captureButtonContainer}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={handleCapture}
                >
                  <Text style={styles.captureButtonText}>Capture</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  imagePreviewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    width: width,
    height: height,
    position: 'absolute',
  },
  scanningContainer: {
    flex: 1,
    marginTop: -100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    height: 500,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 20,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
    zIndex: 20,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 20,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'gray',
    shadowColor: 'gray',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 30,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  galleryButtonContainer: {
    position: 'absolute',
    bottom: 60,
    left: 10,
  },
  galleryButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  captureButtonContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  captureButton: {
    width: 240,
    height: 50,
    borderRadius: 40,
    backgroundColor: 'green',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButtonContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  cancelButton: {
    width: 240,
    height: 50,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    color: 'white'
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
});