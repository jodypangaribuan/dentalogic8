
import { BoundingBoxImage } from '@/components/BoundingBoxImage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { predict, PredictionResult } from '@/utils/prediction-service';
import * as Brightness from 'expo-brightness';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CameraModal() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'on' | 'off' | 'auto'>('off');
  const [frontCameraFlash, setFrontCameraFlash] = useState(false);
  const [originalBrightness, setOriginalBrightness] = useState<number>(1.0);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // Determine where user came from by checking navigation state
  const getPreviousScreen = () => {
    if (params.from) {
      return params.from as string;
    }
    return 'home';
  };

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Get original brightness when component mounts
  useEffect(() => {
    const getOriginalBrightness = async () => {
      try {
        const brightness = await Brightness.getBrightnessAsync();
        setOriginalBrightness(brightness);
      } catch (error) {
        console.warn('Could not get brightness:', error);
      }
    };

    getOriginalBrightness();
  }, []);

  // Control brightness when front camera flash is active
  useEffect(() => {
    const controlBrightness = async () => {
      try {
        if (facing === 'front' && frontCameraFlash) {
          await Brightness.setBrightnessAsync(1.0);
        } else {
          await Brightness.setBrightnessAsync(originalBrightness);
        }
      } catch (error) {
        console.warn('Could not control brightness:', error);
      }
    };

    controlBrightness();
  }, [facing, frontCameraFlash, originalBrightness]);

  // Cleanup: restore original brightness on unmount
  useEffect(() => {
    return () => {
      const restoreBrightness = async () => {
        try {
          await Brightness.setBrightnessAsync(originalBrightness);
        } catch (error) {
          console.warn('Could not restore brightness on unmount:', error);
        }
      };
      restoreBrightness();
    };
  }, [originalBrightness]);

  const processImage = async (uri: string) => {
    try {
      setIsAnalyzing(true);
      setCapturedImage(uri);

      // Artificial delay for UX (so user sees "Analyzing..." state)
      // and to allow UI to update before heavy computation
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Starting prediction for:', uri);
      const result = await predict(uri);
      console.log('Prediction result:', result);

      setPredictionResult(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      Alert.alert(
        'Gagal Menganalisis',
        'Terjadi kesalahan saat memproses gambar. Silakan coba lagi.',
        [{ text: 'OK', onPress: resetCapture }]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Izin Diperlukan',
          'Mohon berikan izin untuk mengakses galeri foto Anda.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Kesalahan', 'Gagal memilih gambar dari galeri');
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => {
      const newFacing = current === 'back' ? 'front' : 'back';
      if (newFacing === 'back') {
        setFrontCameraFlash(false);
      }
      return newFacing;
    });
  };

  const toggleFlash = () => {
    if (facing === 'front') {
      setFrontCameraFlash(current => !current);
    } else {
      setFlash(current => {
        if (current === 'off') return 'on';
        if (current === 'on') return 'auto';
        return 'off';
      });
    }
  };

  const takePicture = async () => {
    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: true, // Faster capture
        });

        if (photo) {
          await processImage(photo.uri);
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Kesalahan', 'Gagal mengambil foto');
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setPredictionResult(null);
    setIsAnalyzing(false);
  };

  const handleBack = () => {
    router.back();
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.light.background }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <SafeAreaView style={styles.permissionContainer}>
          <View style={styles.backButtonContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <IconSymbol name="chevron.left" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            <Text style={[styles.title, { color: Colors.light.text }]}>
              Izin Kamera Diperlukan
            </Text>
            <Text style={[styles.subtitle, { color: Colors.light.icon }]}>
              Mohon berikan izin kamera untuk menggunakan fitur pemindaian
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Berikan Izin</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView >
      </View >
    );
  }

  // Render Result View
  if (capturedImage) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.resultContainer}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top + 10, 20) }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={resetCapture}
              activeOpacity={0.7}
            >
              <IconSymbol name="xmark" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerText}>Hasil Analisis</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.resultImageContainer}>
            {predictionResult ? (
              <BoundingBoxImage
                imageUri={capturedImage}
                detections={predictionResult.detections || []}
                style={styles.boundingBoxContainer}
              />
            ) : (
              // This handles the brief moment before prediction result is set but image is captured,
              // or acts as a fallback. However, normally isAnalyzing handles the loading state overlay.
              <ActivityIndicator size="large" color={Colors.light.tint} />
            )}

            {/* Loading Overlay */}
            {isAnalyzing && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Menganalisis gigi...</Text>
              </View>
            )}
          </View>

          {!isAnalyzing && predictionResult && (
            <View style={[styles.resultFooter, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
              <View style={styles.resultSummary}>
                <Text style={styles.resultTitle}>
                  {predictionResult.class === 'Caries' ? 'Karies Terdeteksi' : 'Gigi Sehat'}
                </Text>
                <Text style={styles.resultConfidence}>
                  Confidence: {(predictionResult.confidence * 100).toFixed(1)}%
                </Text>
                <Text style={styles.resultDetails}>
                  {predictionResult.detections?.length
                    ? `${predictionResult.detections.length} area terdeteksi`
                    : 'Tidak ada karies yang terdeteksi'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={resetCapture}
              >
                <Text style={styles.actionButtonText}>Pindai Lagi</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <CameraView
        ref={cameraRef}
        style={[
          styles.camera,
          facing === 'front' && frontCameraFlash && styles.frontCameraFlash
        ]}
        facing={facing}
        flash={facing === 'front' ? 'off' : flash}
        enableTorch={facing === 'front' ? frontCameraFlash : flash !== 'off'}
      />

      {/* Enhanced flash overlay for front camera flash simulation */}
      {facing === 'front' && frontCameraFlash && (
        <>
          <View style={styles.flashScreenOverlay} />
          <View style={styles.flashSpecularOverlay} />
          <View style={styles.flashBrightnessOverlay} />
        </>
      )}

      {isAnalyzing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Memproses gambar...</Text>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 10, 20) }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="chevron.left" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerText}>Pemindaian Gigi</Text>
            <Text style={styles.instructionText}>Posisikan gigi Anda di dalam bingkai</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.flashButton,
              (facing === 'front' ? frontCameraFlash : flash !== 'off') && styles.flashButtonActive
            ]}
            onPress={toggleFlash}
            activeOpacity={0.7}
          >
            <IconSymbol
              name={
                facing === 'front'
                  ? (frontCameraFlash ? 'bolt.fill' : 'bolt.slash')
                  : (flash === 'off' ? 'bolt.slash' : flash === 'on' ? 'bolt.fill' : 'bolt')
              }
              size={20}
              color="white"
            />
          </TouchableOpacity>
        </View>


        <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={pickImageFromGallery}
            >
              <IconSymbol name="photo" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
              disabled={isAnalyzing}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.flipButton}
              onPress={toggleCameraFacing}
            >
              <IconSymbol name="camera.rotate" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  resultImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boundingBoxContainer: {
    flex: 1,
    width: '100%',
  },
  resultFooter: {
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  resultSummary: {
    marginBottom: 20,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  resultConfidence: {
    fontSize: 16,
    color: '#CCC',
    marginBottom: 4,
  },
  resultDetails: {
    fontSize: 14,
    color: '#AAA',
  },
  actionButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    textAlign: 'center',
    flex: 1,
  },
  instructionText: {
    fontSize: 14,
    color: 'white',
    marginTop: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  controls: {
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 40,
  },
  galleryButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  flipButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  permissionContainer: {
    flex: 1,
  },
  backButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  frontCameraFlash: {
    filter: 'contrast(1.0) brightness(2.0) saturate(1.5)',
  },
  flashScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    pointerEvents: 'none',
  },
  flashSpecularOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    pointerEvents: 'none',
    shadowColor: 'white',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 50,
  },
  flashBrightnessOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    pointerEvents: 'none',
    shadowColor: 'white',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
  },
});
