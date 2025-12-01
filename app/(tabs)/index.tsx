import { Colors } from '@/constants/theme';
import { predictCariesFromServer } from '@/utils/api';
import { navigationTracker } from '@/utils/navigation-tracker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PredictionResult = {
  label: string;
  confidence?: number;
  findings?: string[];
  explanation?: string;
  inferenceTime?: number;
  annotatedImage?: string; // Base64 image with bounding boxes
  detections?: Array<{
    bbox: [number, number, number, number];
    class: string;
    confidence: number;
  }>;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen() {
  const [isPicking, setIsPicking] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Track that user is on home screen
      navigationTracker.setLastVisitedTab('home');
    }, [])
  );

  const predictionDisabledReason = useMemo(() => {
    if (!selectedImage) return 'Pilih gambar intraoral terlebih dahulu';
    return null;
  }, [selectedImage]);

  const handleUploadImage = async () => {
    setPrediction(null);
    setError(null);
    setStatusMessage(null);
    setIsPicking(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError('Izin galeri dibutuhkan untuk mengunggah gambar intraoral');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (err) {
      console.error('Failed to pick image', err);
      setError('Gagal memilih gambar, coba lagi.');
    } finally {
      setIsPicking(false);
    }
  };

  const handlePredict = async () => {
    if (!selectedImage) return;

    setIsPredicting(true);
    setError(null);
    setStatusMessage('Mengirim gambar ke server...');

    try {
      setStatusMessage('Memproses gambar di server...');
      
      // Predict menggunakan server API
      const result = await predictCariesFromServer(selectedImage.uri);
      
      // Format prediction result
      const predictionResult: PredictionResult = {
        label: result.class,
        confidence: result.confidence,
        findings: result.allProbabilities
          .filter(p => p.probability > 0.05) // Show probabilities > 5%
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 3) // Top 3
          .map(p => `${p.class}: ${p.probability.toFixed(1)}%`),
        explanation: `Kelas karies yang terdeteksi: ${result.class}. Keyakinan model: ${result.confidence.toFixed(1)}%`,
        inferenceTime: result.inferenceTime,
        annotatedImage: result.annotatedImage, // Image with bounding boxes
        detections: result.detections, // All detections
      };
      
      setPrediction(predictionResult);
      setStatusMessage('Prediksi selesai');
    } catch (err) {
      console.error('Prediction failed', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Prediksi gagal dijalankan';
      
      // Tambahkan hint untuk troubleshooting
      let fullErrorMessage = errorMessage;
      if (errorMessage.includes('tidak dapat terhubung') || errorMessage.includes('fetch')) {
        fullErrorMessage += '\n\nPastikan server Python berjalan di http://localhost:8000';
      }
      
      setError(fullErrorMessage);
      setPrediction(null);
    } finally {
      setIsPredicting(false);
    }
  };

  const resetSelection = () => {
    setSelectedImage(null);
    setPrediction(null);
    setStatusMessage(null);
    setError(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.light.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: Colors.light.text }]}>
          Unggah Scan Intraoral
        </Text>
        <Text style={[styles.subtitle, { color: Colors.light.icon }]}>
          Pilih foto intraoral dari perangkat Anda dan jalankan analisis karies otomatis menggunakan model AI.
        </Text>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleUploadImage}
          activeOpacity={0.8}
        >
          {isPicking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadButtonText}>Pilih Gambar</Text>
          )}
        </TouchableOpacity>

        {selectedImage && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: Colors.light.text }]}>
                Gambar Terpilih
              </Text>
              <TouchableOpacity onPress={resetSelection}>
                <Text style={[styles.resetText, { color: Colors.light.tint }]}>
                  Ganti
                </Text>
              </TouchableOpacity>
            </View>

            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.previewImage}
              contentFit="cover"
            />

            <TouchableOpacity
              style={[
                styles.predictButton,
                (predictionDisabledReason || isPredicting) && styles.predictButtonDisabled,
              ]}
              onPress={handlePredict}
              disabled={Boolean(predictionDisabledReason) || isPredicting}
            >
              {isPredicting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.predictButtonText}>Prediksi Karies</Text>
              )}
            </TouchableOpacity>

            {predictionDisabledReason && (
              <Text style={[styles.helperText, { color: Colors.light.icon }]}>
                {predictionDisabledReason}
              </Text>
            )}
          </View>
        )}

        {statusMessage && (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: Colors.light.icon }]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {prediction && (
          <View style={styles.predictionCard}>
            <Text style={[styles.predictionTitle, { color: Colors.light.text }]}>
              Hasil Prediksi
            </Text>
            
            {/* Show annotated image with bounding boxes if available */}
            {prediction.annotatedImage && (
              <View style={styles.annotatedImageContainer}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFullscreenImage(prediction.annotatedImage || null)}
                >
                  <Image
                    source={{ uri: prediction.annotatedImage }}
                    style={styles.annotatedImage}
                    contentFit="contain"
                  />
                </TouchableOpacity>
                {prediction.detections && prediction.detections.length > 0 && (
                  <Text style={[styles.helperText, { color: Colors.light.icon, marginTop: 8 }]}>
                    Ditemukan {prediction.detections.length} deteksi (Ketuk gambar untuk zoom)
                  </Text>
                )}
              </View>
            )}
            
            <Text style={[styles.predictionLabel, { color: Colors.light.text }]}>
              Kondisi: <Text style={styles.predictionValue}>{prediction.label}</Text>
            </Text>
            {typeof prediction.confidence === 'number' && (
              <Text style={[styles.predictionLabel, { color: Colors.light.text }]}>
                Keyakinan Model:{' '}
                <Text style={styles.predictionValue}>
                  {prediction.confidence.toFixed(1)}%
                </Text>
              </Text>
            )}
            {prediction.findings && prediction.findings.length > 0 && (
              <View style={styles.findingsContainer}>
                <Text style={[styles.predictionLabel, { color: Colors.light.text }]}>
                  Temuan:
                </Text>
                {prediction.findings.map((finding, index) => (
                  <Text
                    key={finding + index.toString()}
                    style={[styles.findingItem, { color: Colors.light.icon }]}
                  >
                    • {finding}
                  </Text>
                ))}
              </View>
            )}
            {prediction.explanation && (
              <Text style={[styles.explanationText, { color: Colors.light.icon }]}>
                {prediction.explanation}
              </Text>
            )}
            {typeof prediction.inferenceTime === 'number' && (
              <Text style={[styles.helperText, { color: Colors.light.icon }]}>
                Waktu inferensi: {prediction.inferenceTime} ms
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Fullscreen Image Viewer with Zoom */}
      <Modal
        visible={fullscreenImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setFullscreenImage(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕ Tutup</Text>
          </TouchableOpacity>
          <ScrollView
            style={styles.fullscreenScrollView}
            contentContainerStyle={styles.fullscreenScrollContent}
            maximumZoomScale={5}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bouncesZoom={true}
            scrollEnabled={true}
            pinchGestureEnabled={true}
            centerContent={true}
          >
            {fullscreenImage && (
              <Image
                source={{ uri: fullscreenImage }}
                style={styles.fullscreenImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  uploadButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  predictButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  predictButtonDisabled: {
    opacity: 0.5,
  },
  predictButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  resetText: {
    fontWeight: '600',
  },
  statusContainer: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    textAlign: 'center',
    fontSize: 14,
  },
  errorContainer: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '600',
    textAlign: 'center',
  },
  predictionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  predictionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  predictionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  predictionValue: {
    color: Colors.light.tint,
    fontWeight: '700',
    fontSize: 22,
  },
  findingsContainer: {
    gap: 4,
  },
  findingItem: {
    fontSize: 14,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  annotatedImageContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  annotatedImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullscreenScrollView: {
    flex: 1,
    width: '100%',
  },
  fullscreenScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: SCREEN_WIDTH,
    minHeight: SCREEN_HEIGHT,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

