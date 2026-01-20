import { BoundingBoxImage } from '@/components/BoundingBoxImage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ICDAS/D-level treatment recommendations - using app's blue theme
const TREATMENT_INFO: Record<string, { severity: string; description: string; treatment: string[] }> = {
    D0: {
        severity: 'Gigi Sehat',
        description: 'Gigi dalam kondisi sehat tanpa tanda-tanda karies. Email gigi utuh dan tidak ada demineralisasi yang terlihat.',
        treatment: [
            'Jaga Kebersihan Oral Hygiene - Sikat gigi 2x sehari dengan teknik yang benar',
            'Gunakan pasta gigi berfluoride untuk perlindungan email',
            'Gunakan dental floss atau sikat interdental setiap hari',
            'Kontrol rutin ke dokter gigi setiap 6 bulan',
            'Batasi konsumsi makanan dan minuman tinggi gula',
        ],
    },
    D1: {
        severity: 'Lesi Awal (White Spot)',
        description: 'Demineralisasi awal pada email gigi. Terlihat white spot atau perubahan warna putih kapur pada permukaan gigi setelah dikeringkan. Belum ada kavitas atau kerusakan struktural.',
        treatment: [
            'Jaga Kebersihan Oral Hygiene - Tingkatkan frekuensi dan teknik menyikat gigi',
            'Topikal Aplikasi Fluoride - Aplikasi fluoride gel/foam di klinik',
            'Topikal Aplikasi Varnish - Fluoride varnish untuk remineralisasi email',
            'Gunakan pasta gigi dengan kandungan fluoride tinggi (1450-5000 ppm)',
            'Kurangi frekuensi konsumsi gula dan makanan asam',
        ],
    },
    D2: {
        severity: 'Lesi Email',
        description: 'Kerusakan terbatas pada lapisan email gigi. Terlihat white/brown spot yang jelas atau perubahan warna pada email. Kavitas minimal, belum mencapai dentin.',
        treatment: [
            'Jaga Kebersihan Oral Hygiene - Perhatikan area yang terkena saat menyikat',
            'Topikal Aplikasi Fluoride - Aplikasi fluoride profesional secara berkala',
            'Topikal Aplikasi Varnish - Fluoride varnish setiap 3-6 bulan',
            'Pertimbangkan infiltrasi resin (Icon) untuk lesi proksimal',
            'Monitoring perkembangan lesi setiap 3 bulan',
        ],
    },
    D3: {
        severity: 'Lesi Dentin Awal',
        description: 'Karies sudah menembus email dan mencapai lapisan dentin superfisial. Terlihat kavitas kecil. Mungkin ada sensitivitas terhadap makanan manis atau dingin.',
        treatment: [
            'Jaga Kebersihan Oral Hygiene - Hindari penumpukan plak di area restorasi',
            'Topikal Aplikasi Fluoride - Untuk mencegah karies sekunder',
            'Topikal Aplikasi Varnish - Perlindungan tambahan pasca perawatan',
            'Pertimbangkan restorasi minimal invasif jika kavitas membesar',
            'Kontrol setiap 3 bulan untuk evaluasi perkembangan',
        ],
    },
    D4: {
        severity: 'Karies Dentin Dalam',
        description: 'Karies sudah mencapai lebih dari setengah ketebalan dentin. Kavitas yang lebih besar terlihat dengan dentin lunak. Sensitivitas meningkat.',
        treatment: [
            'Jaga Kebersihan Oral Hygiene - Perawatan intensif area sekitar restorasi',
            'Restorasi Composite - Tambalan sewarna gigi dengan bonding',
            'Restorasi GIC (Glass Ionomer Cement) - Alternatif dengan pelepasan fluoride',
            'Aplikasi liner/base untuk perlindungan pulpa',
            'Kontrol pasca restorasi untuk evaluasi sensitivitas',
        ],
    },
    D5: {
        severity: 'Karies Mendekati Pulpa',
        description: 'Karies sangat dalam mendekati atau sudah mengenai pulpa. Kemungkinan ada peradangan pulpa (pulpitis). Pasien mungkin mengalami nyeri spontan atau berkepanjangan.',
        treatment: [
            'Jaga Kebersihan Oral Hygiene - Cegah infeksi sekunder',
            'Pulp Capping - Direct/Indirect pulp capping jika pulpa masih vital',
            'Restorasi Composite - Setelah prosedur pulp capping berhasil',
            'Restorasi GIC - Sebagai base sebelum restorasi composite',
            'Evaluasi vitalitas pulpa secara berkala pasca perawatan',
        ],
    },
    D6: {
        severity: 'Kerusakan Berat/Nekrosis Pulpa',
        description: 'Kerusakan ekstensif dengan keterlibatan pulpa yang jelas. Mahkota gigi rusak parah. Kemungkinan pulpa sudah nekrosis dengan abses atau infeksi periapical.',
        treatment: [
            'Jaga Kebersihan Oral Hygiene - Penting untuk proses penyembuhan',
            'Root Canal Treatment (Perawatan Saluran Akar) - Pengangkatan jaringan pulpa yang terinfeksi',
            'Obturasi saluran akar dengan gutta percha',
            'Restorasi pasca endodontik (Post & Core jika diperlukan)',
            'Pertimbangkan mahkota (crown) untuk perlindungan jangka panjang',
        ],
    },
};

export default function AnalysisDetailScreen() {
    const params = useLocalSearchParams<{
        imageUri?: string;
        label?: string;
        confidence?: string;
        detections?: string;
        inferenceTime?: string;
        source?: string;
        imageWidth?: string;
        imageHeight?: string;
    }>();

    const imageUri = params.imageUri || '';
    const label = params.label || 'D0';
    const confidence = parseFloat(params.confidence || '0');
    const detections = params.detections ? JSON.parse(params.detections) : [];
    const inferenceTime = parseInt(params.inferenceTime || '0');
    const source = params.source || 'local';
    const imageWidth = parseInt(params.imageWidth || '640');
    const imageHeight = parseInt(params.imageHeight || '640');

    const [isFullscreen, setIsFullscreen] = React.useState(false);

    const treatmentInfo = TREATMENT_INFO[label] || TREATMENT_INFO.D0;

    // Calculate detection statistics
    const detectionStats: Record<string, number> = {};
    detections.forEach((d: { class: string }) => {
        detectionStats[d.class] = (detectionStats[d.class] || 0) + 1;
    });

    // Get list of unique detected classes sorted by severity
    const detectedClasses = Object.keys(detectionStats).sort((a, b) => {
        const order = ['D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'];
        return order.indexOf(a) - order.indexOf(b);
    });

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Detail Analisis</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Image Preview with Detection Results */}
                {imageUri && (
                    <TouchableOpacity
                        style={styles.imageContainer}
                        onPress={() => setIsFullscreen(true)}
                        activeOpacity={0.9}
                    >
                        {detections.length > 0 ? (
                            <BoundingBoxImage
                                imageUri={imageUri}
                                detections={detections}
                                imageWidth={640}
                                imageHeight={640}
                                actualWidth={imageWidth}
                                actualHeight={imageHeight}
                                style={styles.previewImage}
                            />
                        ) : (
                            <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
                        )}
                        <View style={styles.zoomIndication}>
                            <IconSymbol name="magnifyingglass.circle.fill" size={24} color="rgba(255,255,255,0.8)" />
                        </View>
                    </TouchableOpacity>
                )}

                {/* Main Result Card */}
                <View style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                        <View style={styles.severityBadge}>
                            <Text style={styles.severityLabel}>{label}</Text>
                        </View>
                        <View style={styles.resultMeta}>
                            <Text style={styles.severityText}>{treatmentInfo.severity}</Text>
                            <Text style={styles.confidenceText}>
                                Kepercayaan: {(confidence * 100).toFixed(1)}%
                            </Text>
                        </View>
                    </View>

                    {/* Confidence Bar */}
                    <View style={styles.confidenceBarSection}>
                        <View style={styles.progressBarBg}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${Math.min(confidence * 100, 100)}%` },
                                ]}
                            />
                        </View>
                    </View>

                    {/* Description */}
                    <View style={styles.descSection}>
                        <Text style={styles.sectionTitle}>Deskripsi</Text>
                        <Text style={styles.descriptionText}>{treatmentInfo.description}</Text>
                    </View>
                </View>

                {/* Detection Distribution */}
                {detections.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Distribusi Karies Terdeteksi</Text>
                        <View style={styles.countsGrid}>
                            {['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'].map(cls => {
                                const count = detectionStats[cls] || 0;
                                return (
                                    <View
                                        key={cls}
                                        style={[
                                            styles.countItem,
                                            count > 0
                                                ? styles.countItemActive
                                                : styles.countItemEmpty,
                                        ]}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: count > 0 ? '#fff' : '#94A3B8' }}>
                                            {cls}
                                        </Text>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: count > 0 ? '#fff' : '#64748B' }}>
                                            {count}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Treatment Recommendations */}
                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <IconSymbol name="cross.case.fill" size={20} color={Colors.light.tint} />
                        <Text style={styles.sectionTitle}>Rekomendasi Penanganan</Text>
                    </View>
                    {treatmentInfo.treatment.map((item, index) => (
                        <View key={index} style={styles.treatmentItem}>
                            <View style={styles.treatmentNumber}>
                                <Text style={styles.treatmentNumberText}>{index + 1}</Text>
                            </View>
                            <Text style={styles.treatmentText}>{item}</Text>
                        </View>
                    ))}
                </View>

                {/* Additional Detected Classes */}
                {detectedClasses.length > 1 && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Penanganan Karies Lainnya</Text>
                        {detectedClasses
                            .filter(cls => cls !== label)
                            .map(cls => {
                                const info = TREATMENT_INFO[cls];
                                return (
                                    <View key={cls} style={styles.otherClassSection}>
                                        <View style={styles.otherClassHeader}>
                                            <View style={styles.smallBadge}>
                                                <Text style={styles.smallBadgeText}>{cls}</Text>
                                            </View>
                                            <Text style={styles.otherClassTitle}>
                                                {info.severity} ({detectionStats[cls]} terdeteksi)
                                            </Text>
                                        </View>
                                        <Text style={styles.otherClassDesc}>{info.description}</Text>
                                        <View style={styles.otherClassTreatments}>
                                            {info.treatment.slice(0, 3).map((t, i) => (
                                                <View key={i} style={styles.miniTreatmentItem}>
                                                    <View style={styles.bullet} />
                                                    <Text style={styles.miniTreatmentText}>{t}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
                    </View>
                )}

                {/* Metadata */}
                <View style={styles.metaCard}>
                    <View style={styles.metaRow}>
                        <IconSymbol name="clock" size={16} color={Colors.light.tint} />
                        <Text style={styles.metaText}>Waktu inferensi: {inferenceTime}ms</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <IconSymbol name="cpu" size={16} color={Colors.light.tint} />
                        <Text style={styles.metaText}>
                            Mode: {source === 'local' ? 'Lokal (On-Device)' : 'API Server'}
                        </Text>
                    </View>
                    <View style={styles.metaRow}>
                        <IconSymbol name="checkmark.shield" size={16} color={Colors.light.tint} />
                        <Text style={styles.metaText}>Total deteksi: {detections.length}</Text>
                    </View>
                </View>

                {/* Disclaimer */}
                <View style={styles.disclaimer}>
                    <IconSymbol name="exclamationmark.triangle.fill" size={16} color={Colors.light.tint} />
                    <Text style={styles.disclaimerText}>
                        Hasil analisis ini merupakan alat bantu diagnosis dan tidak menggantikan pemeriksaan langsung oleh dokter gigi profesional.
                    </Text>
                </View>
            </ScrollView>

            {/* Fullscreen Viewer */}
            <Modal visible={isFullscreen} transparent={true} animationType="fade" onRequestClose={() => setIsFullscreen(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.closeModal} onPress={() => setIsFullscreen(false)}>
                        <IconSymbol name="xmark" size={24} color="#fff" />
                    </TouchableOpacity>
                    <ScrollView
                        maximumZoomScale={4}
                        minimumZoomScale={1}
                        contentContainerStyle={styles.centered}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                    >
                        {detections.length > 0 ? (
                            <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}>
                                <BoundingBoxImage
                                    imageUri={imageUri}
                                    detections={detections}
                                    imageWidth={640}
                                    imageHeight={640}
                                    actualWidth={imageWidth}
                                    actualHeight={imageHeight}
                                    style={{ flex: 1 }}
                                />
                            </View>
                        ) : (
                            <Image source={{ uri: imageUri }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }} contentFit="contain" />
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text },
    scrollContent: { padding: 16, paddingBottom: 40 },

    imageContainer: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
    },
    previewImage: { width: '100%', height: '100%' },

    resultCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    severityBadge: {
        width: 60,
        height: 60,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.light.tint,
    },
    severityLabel: { fontSize: 24, fontWeight: '800', color: '#fff' },
    resultMeta: { flex: 1 },
    severityText: { fontSize: 20, fontWeight: '700', color: Colors.light.text },
    confidenceText: { fontSize: 14, color: Colors.light.icon, marginTop: 4 },

    confidenceBarSection: { marginTop: 16 },
    progressBarBg: { height: 10, backgroundColor: '#E2E8F0', borderRadius: 5, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 5, backgroundColor: Colors.light.tint },

    descSection: { marginTop: 20 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.light.text, marginBottom: 8 },
    descriptionText: { fontSize: 14, color: '#64748B', lineHeight: 22 },

    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },

    countsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    countItem: {
        width: (SCREEN_WIDTH - 32 - 40 - 48) / 4,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
    },
    countItemActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
    countItemEmpty: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },

    treatmentItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    treatmentNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.light.tint,
    },
    treatmentNumberText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    treatmentText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 20 },

    otherClassSection: {
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingTop: 16,
        marginTop: 12,
    },
    otherClassHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    smallBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.light.tint },
    smallBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    otherClassTitle: { fontSize: 14, fontWeight: '600', color: Colors.light.text },
    otherClassDesc: { fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 10 },
    otherClassTreatments: { gap: 6 },
    miniTreatmentItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6, backgroundColor: Colors.light.tint },
    miniTreatmentText: { flex: 1, fontSize: 13, color: '#64748B' },

    metaCard: {
        backgroundColor: '#F0F9FF',
        borderRadius: 16,
        padding: 16,
        gap: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    metaText: { fontSize: 13, color: Colors.light.text },

    disclaimer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#F0F9FF',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    disclaimerText: { flex: 1, fontSize: 12, color: Colors.light.icon, lineHeight: 18 },

    zoomIndication: { position: 'absolute', bottom: 12, right: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    closeModal: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
    centered: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
});
