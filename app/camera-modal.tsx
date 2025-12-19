
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import * as Brightness from 'expo-brightness';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CameraModal() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'on' | 'off' | 'auto'>('off');
  const [frontCameraFlash, setFrontCameraFlash] = useState(false);
  const [originalBrightness, setOriginalBrightness] = useState<number>(1.0);
  const cameraRef = useRef<CameraView>(null);
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // Determine where user came from by checking navigation state
  const getPreviousScreen = () => {
    // Check if we have a specific previous screen parameter
    if (params.from) {
      return params.from as string;
    }

    // Default logic: check current navigation state
    // This is a simple approach - in a real app you might want more sophisticated tracking
    return 'home'; // default to home
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
          // Set brightness to maximum when front camera flash is active
          await Brightness.setBrightnessAsync(1.0);
        } else {
          // Restore original brightness when flash is off or camera is switched
          await Brightness.setBrightnessAsync(originalBrightness);
        }
      } catch (error) {
        console.warn('Could not control brightness:', error);
      }
    };

    controlBrightness();
  }, [facing, frontCameraFlash, originalBrightness]);

  // Cleanup: restore original brightness when component unmounts
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

  const pickImageFromGallery = async () => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Izin Diperlukan',
          'Mohon berikan izin untuk mengakses galeri foto Anda untuk mengunggah gambar.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for dental scans
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedImage = result.assets[0];
        console.log('Image selected from gallery:', selectedImage.uri);
        Alert.alert('Berhasil', 'Gambar berhasil dipilih dari galeri!');
        // Handle the selected image here - same as camera capture
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      Alert.alert('Kesalahan', 'Gagal memilih gambar dari galeri');
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => {
      const newFacing = current === 'back' ? 'front' : 'back';
      // Reset front camera flash when switching cameras
      if (newFacing === 'back') {
        setFrontCameraFlash(false);
      }
      return newFacing;
    });
  };

  const toggleFlash = () => {
    if (facing === 'front') {
      // For front camera, simulate flash with white border and higher contrast
      setFrontCameraFlash(current => !current);
    } else {
      // For back camera, use normal flash
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
        });

        // Handle the captured photo here
        console.log('Photo taken:', photo.uri);
        Alert.alert('Berhasil', 'Foto berhasil diambil!');
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Kesalahan', 'Gagal mengambil foto');
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (!permission) {
    // Camera permissions are still loading
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
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
        </SafeAreaView>
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
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
  headerRight: {
    width: 44,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
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
  // Front camera flash simulation styles
  frontCameraFlash: {
    // 100% contrast for maximum flash simulation
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
