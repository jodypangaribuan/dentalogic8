import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { predictCariesFromServer } from '@/utils/api';
import { navigationTracker } from '@/utils/navigation-tracker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PredictionResult = {
  label: string;
  confidence?: number;
  findings?: string[];
  explanation?: string;
  inferenceTime?: number;
  annotatedImage?: string;
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
    setStatusMessage('Mengirim ke server...');

    try {
      setStatusMessage('Memproses AI...');
      const result = await predictCariesFromServer(selectedImage.uri);

      const predictionResult: PredictionResult = {
        label: result.class,
        confidence: result.confidence,
        findings: result.allProbabilities
          .filter(p => p.probability > 0.05)
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 3)
          .map(p => `${p.class}: ${p.probability.toFixed(1)}%`),
        explanation: `Sistem mendeteksi ${result.class} dengan tingkat kepercayaan ${result.confidence.toFixed(1)}%.`,
        inferenceTime: result.inferenceTime,
        annotatedImage: result.annotatedImage,
        detections: result.detections,
      };

      setPrediction(predictionResult);
      setStatusMessage(null);
    } catch (err) {
      console.error('Prediction failed', err);
      const errorMessage = err instanceof Error ? err.message : 'Gagal memproses';
      setError(errorMessage);
    } finally {
      setIsPredicting(false);
    }
  };

  const classCounts = useMemo(() => {
    if (!prediction?.detections) return null;
    const counts: Record<string, number> = {
      'D0': 0, 'D1': 0, 'D2': 0, 'D3': 0, 'D4': 0, 'D5': 0, 'D6': 0, 'D7': 0
    };
    prediction.detections.forEach(d => {
      if (counts[d.class] !== undefined) {
        counts[d.class]++;
      }
    });
    return counts;
  }, [prediction]);

  const displayedLabel = useMemo(() => {
    if (!classCounts || !prediction) return prediction?.label || 'D0';

    let maxCount = 0;
    let winner = prediction.label;

    // Find class with most detections
    Object.entries(classCounts).forEach(([cls, count]) => {
      if (count > maxCount) {
        maxCount = count;
        winner = cls;
      }
    });

    return winner;
  }, [classCounts, prediction]);

  const resetSelection = () => {
    setSelectedImage(null);
    setPrediction(null);
    setStatusMessage(null);
    setError(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F8FAFC' }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Greeting */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>Halo!</Text>
            <Text style={styles.welcomeText}>Periksa Kesehatan Gigi Anda</Text>
          </View>
          <View style={styles.avatarContainer}>
            <IconSymbol name="person.circle.fill" size={42} color={Colors.light.tint} />
          </View>
        </View>

        {/* Main Action Area */}
        {!selectedImage ? (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.mainActionCard}
              onPress={() => router.push('/(tabs)/scan')}
              activeOpacity={0.9}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                <IconSymbol name="camera.fill" size={32} color={Colors.light.tint} />
              </View>
              <Text style={styles.actionTitle}>Ambil Foto Baru</Text>
              <Text style={styles.actionDescription}>Gunakan kamera untuk memindai gigi secara langsung.</Text>
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
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={styles.previewHeaderLabel}>
                  <IconSymbol name="doc.text.fill" size={16} color={Colors.light.tint} />
                  <Text style={styles.previewLabelText}>Analisis Gambar</Text>
                </View>
                <TouchableOpacity onPress={resetSelection} style={styles.resetButton}>
                  <Text style={styles.resetButtonText}>Hapus</Text>
                </TouchableOpacity>
              </View>

              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
                contentFit="cover"
              />

              {!prediction && (
                <TouchableOpacity
                  style={[styles.predictButton, isPredicting && styles.predictButtonDisabled]}
                  onPress={handlePredict}
                  disabled={isPredicting}
                >
                  {isPredicting ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                      <Text style={styles.predictButtonText}>{statusMessage || 'Sedang Memproses...'}</Text>
                    </View>
                  ) : (
                    <>
                      <IconSymbol name="sparkles" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.predictButtonText}>Mulai Deteksi AI</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {error && (
              <View style={styles.errorBanner}>
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#EF4444" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {prediction && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Hasil Analisis</Text>

                {prediction.annotatedImage && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setFullscreenImage(prediction.annotatedImage || null)}
                    style={styles.annotatedContainer}
                  >
                    <Image
                      source={{ uri: prediction.annotatedImage }}
                      style={styles.annotatedImage}
                      contentFit="contain"
                    />
                    <View style={styles.zoomIndication}>
                      <IconSymbol name="magnifyingglass.circle.fill" size={24} color="rgba(255,255,255,0.8)" />
                    </View>
                  </TouchableOpacity>
                )}

                <View style={styles.mainResult}>
                  <View style={styles.resultHeadingRow}>
                    <Text style={styles.resultLabel}>Kondisi Terdeteksi</Text>
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>{displayedLabel}</Text>
                    </View>
                  </View>

                  {prediction.confidence && (
                    <View style={styles.confidenceSection}>
                      <View style={styles.confidenceRow}>
                        <Text style={styles.confidenceLabel}>Keyakinan Model</Text>
                        <Text style={styles.confidenceValue}>{prediction.confidence.toFixed(1)}%</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${prediction.confidence}%` }
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  <View style={styles.classDistribution}>
                    <Text style={styles.sectionTitle}>Distribusi Temuan</Text>
                    <View style={styles.countsGrid}>
                      {Object.entries(classCounts || {}).map(([cls, count]) => (
                        <View
                          key={cls}
                          style={[
                            styles.countItem,
                            count > 0 ? styles.countItemActive : styles.countItemEmpty
                          ]}
                        >
                          <Text style={[styles.countClass, count > 0 && styles.countTextActive]}>{cls}</Text>
                          <Text style={[styles.countValue, count > 0 && styles.countTextActive]}>{count}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                </View>

                <TouchableOpacity
                  style={styles.secondaryPredictButton}
                  onPress={resetSelection}
                >
                  <Text style={styles.secondaryPredictButtonText}>Selesai & Tutup</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsHeading}>Tips Hasil Maksimal</Text>
          <View style={styles.tipItem}>
            <View style={[styles.tipIcon, { backgroundColor: '#F0F9FF' }]}>
              <IconSymbol name="lightbulb.fill" size={16} color="#0EA5E9" />
            </View>
            <Text style={styles.tipText}>Gunakan pencahayaan yang terang untuk hasil foto yang jelas.</Text>
          </View>
          <View style={styles.tipItem}>
            <View style={[styles.tipIcon, { backgroundColor: '#F0FDF4' }]}>
              <IconSymbol name="scope" size={16} color="#22C55E" />
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
              <Image source={{ uri: fullscreenImage }} style={styles.fullImage} contentFit="contain" />
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  avatarContainer: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },

  actionContainer: { paddingHorizontal: 24, gap: 16 },
  mainActionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  actionTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text, marginBottom: 8 },
  actionDescription: { fontSize: 14, color: Colors.light.icon, textAlign: 'center', lineHeight: 20 },

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
  resultTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: Colors.light.text },
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
  countClass: { fontSize: 10, fontWeight: '700', color: Colors.light.icon, marginBottom: 2 },
  countValue: { fontSize: 16, fontWeight: '800', color: Colors.light.text },
  countTextActive: { color: '#fff' },

  tipsSection: { padding: 24, gap: 12 },
  tipsHeading: { fontSize: 16, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  tipItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 12, borderRadius: 16 },
  tipIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  tipText: { flex: 1, fontSize: 13, color: '#64748B', lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  closeModal: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  centered: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
});

