import { BoundingBoxImage } from '@/components/BoundingBoxImage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { navigationTracker } from '@/utils/navigation-tracker';
import { getInferenceMode, initializeLocalModel, predict } from '@/utils/prediction-service';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DisplayPrediction = {
  label: string;
  confidence?: number;
  findings?: string[];
  explanation?: string;
  inferenceTime?: number;
  annotatedImage?: string;
  source?: 'local' | 'api';
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
  const [prediction, setPrediction] = useState<DisplayPrediction | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);

  // Initialize local model on mount
  React.useEffect(() => {
    initializeLocalModel().then(success => {
      setModelReady(success);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      navigationTracker.setLastVisitedTab('home');
    }, [])
  );

  // Handle captured image from capture screen
  const { capturedImage, width, height } = useLocalSearchParams<{ capturedImage?: string; width?: string; height?: string }>();

  useEffect(() => {
    if (capturedImage) {
      // Set the captured image as selected image
      setSelectedImage({
        uri: capturedImage,
        width: width ? parseInt(width) : 640,
        height: height ? parseInt(height) : 640,
      } as ImagePicker.ImagePickerAsset);
      setPrediction(null);
      setError(null);
    }
  }, [capturedImage]);

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
    } catch (e) {
      console.error(e);
      setError('Gagal memilih gambar');
    } finally {
      setIsPicking(false);
    }
  };

  const handlePredict = async () => {
    if (!selectedImage || !selectedImage.uri) return;

    setIsPredicting(true);
    setPrediction(null);
    setError(null);
    setStatusMessage('Memulai analisis...');

    try {
      const startTime = Date.now();

      const mode = getInferenceMode();
      setStatusMessage(mode === 'api' ? 'Mengirim ke server...' : 'Memproses lokal...');

      const result = await predict(selectedImage.uri);

      const endTime = Date.now();
      const inferenceTime = endTime - startTime;

      if (result) {
        setPrediction({
          ...result,
          inferenceTime
        });
        setStatusMessage(null);
      } else {
        setError('Gagal mendapatkan hasil prediksi');
        setStatusMessage(null);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat memproses gambar');
      setStatusMessage(null);
    } finally {
      setIsPredicting(false);
    }
  };

  const resetSelection = () => {
    setSelectedImage(null);
    setPrediction(null);
    setError(null);
    setStatusMessage(null);
  };

  // Calculate stats for detections
  const detectionStats = useMemo(() => {
    if (!prediction?.detections) return null;

    const counts: { [key: string]: number } = {};
    prediction.detections.forEach(d => {
      counts[d.class] = (counts[d.class] || 0) + 1;
    });

    return counts;
  }, [prediction]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>Halo, Dokter 👋</Text>
            <Text style={styles.welcomeText}>Dentalogic8</Text>
          </View>
        </View>

        {/* Content */}
        {!selectedImage ? (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.mainActionCard}
              onPress={() => router.push('/capture')}
              activeOpacity={0.9}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                <IconSymbol name="camera.fill" size={32} color={Colors.light.tint} />
              </View>
              <Text style={styles.actionTitle}>Ambil Foto Baru</Text>
              <Text style={styles.actionDescription}>Gunakan kamera untuk mengambil foto gigi.</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionCard}
              onPress={handleUploadImage}
              disabled={isPicking}
              activeOpacity={0.8}
            >
              <View style={styles.secondaryActionLeft}>
                <View style={[styles.smallIconCircle, { backgroundColor: '#F1F5F9' }]}>
                  {isPicking ? <ActivityIndicator size="small" color={Colors.light.tint} /> : <IconSymbol name="photo" size={20} color={Colors.light.icon} />}
                </View>
                <View>
                  <Text style={styles.secondaryActionTitle}>Unggah dari Galeri</Text>
                  <Text style={styles.secondaryActionDescription}>Pilih foto yang sudah ada di HP.</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={20} color={Colors.light.icon} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.selectedContainer}>
            {/* Selected Image Preview */}
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={styles.previewHeaderLabel}>
                  <IconSymbol name="photo.fill" size={16} color={Colors.light.icon} />
                  <Text style={styles.previewLabelText}>Gambar Terpilih</Text>
                </View>
                <TouchableOpacity onPress={resetSelection} style={styles.resetButton}>
                  <Text style={styles.resetButtonText}>Ganti</Text>
                </TouchableOpacity>
              </View>

              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
                contentFit="contain"
              />

              {/* Predict Button */}
              <TouchableOpacity
                style={[styles.predictButton, (isPredicting || !modelReady) && styles.predictButtonDisabled]}
                onPress={handlePredict}
                disabled={!!predictionDisabledReason || isPredicting || !modelReady}
                activeOpacity={0.8}
              >
                {isPredicting ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.predictButtonText}>{statusMessage || 'Memproses...'}</Text>
                  </View>
                ) : (
                  <Text style={styles.predictButtonText}>Analisis Karies</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorBanner}>
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#B91C1C" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* Prediction Result */}
            {prediction && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Hasil Analisis</Text>

                {/* Show annotated image from API, or original image with overlay for local */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFullscreenImage(selectedImage.uri)}
                  style={styles.annotatedContainer}
                >
                  {prediction.annotatedImage ? (
                    <Image
                      source={{ uri: prediction.annotatedImage }}
                      style={styles.annotatedImage}
                      contentFit="contain"
                    />
                  ) : prediction.detections ? (
                    <BoundingBoxImage
                      imageUri={selectedImage.uri}
                      detections={prediction.detections}
                      imageWidth={640}
                      imageHeight={640}
                      actualWidth={selectedImage.width}
                      actualHeight={selectedImage.height}
                      style={styles.annotatedImage}
                    />
                  ) : (
                    <Image
                      source={{ uri: selectedImage.uri }}
                      style={styles.annotatedImage}
                      contentFit="contain"
                    />
                  )}
                  <View style={styles.zoomIndication}>
                    <IconSymbol name="magnifyingglass.circle.fill" size={24} color="rgba(255,255,255,0.8)" />
                  </View>
                </TouchableOpacity>

                <View style={styles.mainResult}>
                  <View style={styles.resultHeadingRow}>
                    <Text style={styles.resultLabel}>Klasifikasi Utama</Text>
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>{prediction.label}</Text>
                    </View>
                  </View>

                  {prediction.confidence !== undefined && (
                    <View style={styles.confidenceSection}>
                      <View style={styles.confidenceRow}>
                        <Text style={styles.confidenceLabel}>Tingkat Kepercayaan</Text>
                        <Text style={styles.confidenceValue}>{(prediction.confidence * 100).toFixed(1)}%</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${(prediction.confidence * 100)}%` }]} />
                      </View>
                    </View>
                  )}

                  {detectionStats && (
                    <View style={styles.classDistribution}>
                      <Text style={styles.sectionTitle}>Distribusi Karies</Text>
                      <View style={styles.countsGrid}>
                        {['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].map(cls => (
                          <View key={cls} style={[styles.countItem, detectionStats[cls] ? styles.countItemActive : styles.countItemEmpty]}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: detectionStats[cls] ? '#fff' : '#94A3B8' }}>{cls}</Text>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: detectionStats[cls] ? '#fff' : '#64748B' }}>
                              {detectionStats[cls] || 0}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.secondaryPredictButton}
                    onPress={handlePredict}
                  >
                    <Text style={styles.secondaryPredictButtonText}>Analisis Ulang</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Tips Section */}
        <View style={{ padding: 24, marginTop: 8 }}>
          <Text style={styles.sectionTitle}>Tips Pengambilan Foto</Text>
          <View style={styles.tipItem}>
            <View style={[styles.tipIcon, { backgroundColor: '#ECFDF5' }]}>
              <IconSymbol name="lightbulb.fill" size={16} color="#059669" />
            </View>
            <Text style={styles.tipText}>Gunakan pencahayaan yang cukup agar detail gigi terlihat jelas.</Text>
          </View>
          <View style={styles.tipItem}>
            <View style={[styles.tipIcon, { backgroundColor: '#EFF6FF' }]}>
              <IconSymbol name="viewfinder" size={16} color="#2563EB" />
            </View>
            <Text style={styles.tipText}>Posisikan kamera fokus pada area gigi yang ingin diperiksa.</Text>
          </View>
          <View style={styles.tipItem}>
            <View style={[styles.tipIcon, { backgroundColor: '#FFF7ED' }]}>
              <IconSymbol name="hand.raised.fill" size={16} color="#F59E0B" />
            </View>
            <Text style={styles.tipText}>Pastikan kamera stabil dan tidak goyang saat pengambilan gambar.</Text>
          </View>
        </View>
      </ScrollView>

      {/* Fullscreen Viewer */}
      <Modal visible={fullscreenImage !== null} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.closeModal} onPress={() => setFullscreenImage(null)}>
            <IconSymbol name="xmark" size={24} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            contentContainerStyle={styles.centered}
          >
            {fullscreenImage && (
              prediction?.detections ? (
                <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}>
                  <BoundingBoxImage
                    imageUri={fullscreenImage}
                    detections={prediction.detections}
                    imageWidth={640}
                    imageHeight={640}
                    actualWidth={selectedImage?.width}
                    actualHeight={selectedImage?.height}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : (
                <Image source={{ uri: fullscreenImage }} style={styles.fullImage} contentFit="contain" />
              )
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { paddingBottom: 100 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: { fontSize: 16, color: Colors.light.icon, fontWeight: '500' },
  welcomeText: { fontSize: 22, fontWeight: '800', color: Colors.light.text, marginTop: 2 },

  actionContainer: { paddingHorizontal: 24, gap: 16 },
  mainActionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  actionTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text, marginBottom: 8 },
  actionDescription: { fontSize: 14, color: Colors.light.icon, textAlign: 'center', paddingHorizontal: 20 },

  secondaryActionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  secondaryActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  secondaryActionTitle: { fontSize: 15, fontWeight: '600', color: Colors.light.text },
  secondaryActionDescription: { fontSize: 12, color: Colors.light.icon },

  selectedContainer: { paddingHorizontal: 24, gap: 16 },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  previewHeaderLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewLabelText: { fontSize: 13, fontWeight: '600', color: Colors.light.icon },
  resetButton: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FEE2E2' },
  resetButtonText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  previewImage: { width: '100%', height: 280, borderRadius: 16, backgroundColor: '#F1F5F9' },

  predictButton: {
    backgroundColor: Colors.light.tint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
  },
  predictButtonDisabled: { opacity: 0.7 },
  predictButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FEE2E2' },
  errorBannerText: { flex: 1, color: '#B91C1C', fontSize: 13, fontWeight: '500' },

  resultCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: Colors.light.text, marginBottom: 16 },
  annotatedContainer: { width: '100%', height: 240, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F8FAFC', marginBottom: 16 },
  annotatedImage: { width: '100%', height: '100%' },
  zoomIndication: { position: 'absolute', bottom: 12, right: 12 },

  mainResult: { gap: 16 },
  resultHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: 15, color: Colors.light.icon, fontWeight: '500' },
  badgeContainer: { backgroundColor: '#F0F9FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#BAE6FD' },
  badgeText: { color: Colors.light.tint, fontWeight: '700', fontSize: 18 },

  confidenceSection: { gap: 8 },
  confidenceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  confidenceLabel: { fontSize: 13, color: Colors.light.icon },
  confidenceValue: { fontSize: 15, fontWeight: '700', color: Colors.light.text },
  progressBarBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.light.tint, borderRadius: 4 },

  secondaryPredictButton: { marginTop: 20, paddingVertical: 12, alignItems: 'center' },
  secondaryPredictButtonText: { color: Colors.light.tint, fontWeight: '600' },

  classDistribution: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.light.text, marginBottom: 12 },
  countsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countItem: {
    width: '22%',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1
  },
  countItemActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  countItemEmpty: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },

  tipItem: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tipIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  tipText: { flex: 1, fontSize: 13, color: Colors.light.icon, lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeModal: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  centered: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});
