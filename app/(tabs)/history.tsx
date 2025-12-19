import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { navigationTracker } from '@/utils/navigation-tracker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const mockScanHistory = [
  {
    id: '1',
    date: '15 Des 2024',
    time: '14:30',
    scanType: 'Deteksi Karies',
    status: 'Selesai',
    scanQuality: 'Tinggi',
    cariesDetected: 2,
    riskLevel: 'Sedang',
    findings: ['Karies terdeteksi pada gigi geraham atas kanan', 'Karies ringan pada gigi premolar bawah'],
    confidence: 94,
    distribution: { 'D0': 2, 'D1': 1, 'D2': 1, 'D3': 0, 'D4': 0, 'D5': 0, 'D6': 0, 'D7': 0 }
  },
  {
    id: '2',
    date: '12 Des 2024',
    time: '09:15',
    scanType: 'Deteksi Karies',
    status: 'Selesai',
    scanQuality: 'Tinggi',
    cariesDetected: 0,
    riskLevel: 'Rendah',
    findings: ['Tidak ada karies terdeteksi', 'Gigi dalam kondisi sehat'],
    confidence: 98,
    distribution: { 'D0': 5, 'D1': 0, 'D2': 0, 'D3': 0, 'D4': 0, 'D5': 0, 'D6': 0, 'D7': 0 }
  },
  {
    id: '3',
    date: '08 Des 2024',
    time: '16:45',
    scanType: 'Deteksi Karies',
    status: 'Selesai',
    scanQuality: 'Sedang',
    cariesDetected: 1,
    riskLevel: 'Tinggi',
    findings: ['Karies dalam terdeteksi pada gigi geraham bawah'],
    confidence: 87,
    distribution: { 'D0': 1, 'D1': 0, 'D2': 0, 'D3': 1, 'D4': 0, 'D5': 0, 'D6': 0, 'D7': 0 }
  },
  {
    id: '4',
    date: '05 Des 2024',
    time: '11:20',
    scanType: 'Deteksi Karies',
    status: 'Selesai',
    scanQuality: 'Tinggi',
    cariesDetected: 3,
    riskLevel: 'Tinggi',
    findings: ['Multiple karies terdeteksi', 'Perlu perawatan segera'],
    confidence: 92,
    distribution: { 'D0': 0, 'D1': 2, 'D2': 1, 'D3': 0, 'D4': 1, 'D5': 0, 'D6': 0, 'D7': 0 }
  },
  {
    id: '5',
    date: '01 Des 2024',
    time: '13:00',
    scanType: 'Deteksi Karies',
    status: 'Selesai',
    scanQuality: 'Tinggi',
    cariesDetected: 0,
    riskLevel: 'Rendah',
    findings: ['Gigi sehat, tidak ada karies'],
    confidence: 96,
    distribution: { 'D0': 4, 'D1': 0, 'D2': 0, 'D3': 0, 'D4': 0, 'D5': 0, 'D6': 0, 'D7': 0 }
  }
];

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [selectedScan, setSelectedScan] = useState<typeof mockScanHistory[0] | null>(null);

  useFocusEffect(
    useCallback(() => {
      navigationTracker.setLastVisitedTab('history');
    }, [])
  );

  const filteredScans = mockScanHistory.filter(scan => {
    const matchesSearch = scan.scanType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scan.findings.some(finding => finding.toLowerCase().includes(searchQuery.toLowerCase())) ||
      scan.riskLevel.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterStatus === 'Semua' || scan.riskLevel === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Tinggi': return { bg: '#FEF2F2', text: '#EF4444' };
      case 'Sedang': return { bg: '#FFFBEB', text: '#F59E0B' };
      case 'Rendah': return { bg: '#F0FDF4', text: '#22C55E' };
      default: return { bg: '#F1F5F9', text: Colors.light.icon };
    }
  };

  const getSuggestion = (risk: string) => {
    switch (risk) {
      case 'Tinggi':
        return 'Kondisi memerlukan perhatian medis segera. Disarankan untuk segera menjadwalkan pertemuan dengan dokter gigi untuk perawatan profesional (seperti penambalan atau perawatan akar) agar karies tidak semakin parah.';
      case 'Sedang':
        return 'Terdeteksi indikasi karies awal. Disarankan untuk melakukan konsultasi dengan dokter gigi dalam waktu dekat dan meningkatkan intensitas pembersihan gigi (flossing dan obat kumur).';
      case 'Rendah':
      default:
        return 'Kesehatan gigi Anda terlihat baik. Pertahankan kebiasaan menyikat gigi 2 kali sehari, gunakan pasta gigi berfluoride, dan rutin lakukan check-up ke dokter gigi setiap 6 bulan.';
    }
  };

  const renderScanItem = ({ item }: { item: typeof mockScanHistory[0] }) => {
    const riskStyles = getRiskColor(item.riskLevel);

    return (
      <TouchableOpacity style={styles.historyCard} activeOpacity={0.7} onPress={() => setSelectedScan(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBox}>
            <Text style={styles.dateText}>{item.date}</Text>
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
          <View style={[styles.riskBadge, { backgroundColor: riskStyles.bg }]}>
            <Text style={[styles.riskText, { color: riskStyles.text }]}>Risiko {item.riskLevel}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.mainInfo}>
            <Text style={styles.scanTypeText}>{item.scanType}</Text>
            <Text style={styles.confidenceText}>Keyakinan: {item.confidence}%</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Karies</Text>
              <Text style={styles.statValue}>{item.cariesDetected}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Kualitas</Text>
              <Text style={styles.statValue}>{item.scanQuality}</Text>
            </View>
          </View>

          <View style={styles.findingsBox}>
            <Text style={styles.findingsSummary} numberOfLines={2}>
              {item.findings.join(' • ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetailText}>Lihat Detail Analisis</Text>
          <IconSymbol name="chevron.right" size={14} color={Colors.light.tint} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F8FAFC' }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Riwayat Analisis</Text>
        <Text style={styles.subtitle}>Data pemindaian gigi Anda sebelumnya</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchContainer}>
          <IconSymbol name="magnifyingglass" size={18} color={Colors.light.icon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari riwayat..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['Semua', 'Rendah', 'Sedang', 'Tinggi'].map((risk) => (
            <TouchableOpacity
              key={risk}
              style={[
                styles.filterTab,
                filterStatus === risk && styles.filterTabActive
              ]}
              onPress={() => setFilterStatus(risk)}
            >
              <Text style={[
                styles.filterTabText,
                filterStatus === risk && styles.filterTabTextActive
              ]}>
                {risk}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredScans}
        renderItem={renderScanItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="doc.text.magnifyingglass" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>Tidak ada riwayat ditemukan</Text>
          </View>
        }
      />
      <Modal
        visible={selectedScan !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedScan(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Analisis</Text>
              <TouchableOpacity onPress={() => setSelectedScan(null)} style={styles.closeButton}>
                <IconSymbol name="xmark" size={20} color={Colors.light.icon} />
              </TouchableOpacity>
            </View>

            {selectedScan && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[styles.detailRiskBadge, { backgroundColor: getRiskColor(selectedScan.riskLevel).bg }]}>
                  <Text style={[styles.detailRiskText, { color: getRiskColor(selectedScan.riskLevel).text }]}>
                    Risiko {selectedScan.riskLevel}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Waktu Pemindaian</Text>
                  <Text style={styles.detailValue}>{selectedScan.date}, {selectedScan.time}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Tingkat Kepercayaan AI</Text>
                  <View style={styles.detailConfidenceRow}>
                    <Text style={styles.detailConfidenceValue}>{selectedScan.confidence}%</Text>
                    <View style={styles.detailProgressBarBg}>
                      <View style={[styles.detailProgressBarFill, { width: `${selectedScan.confidence}%` }]} />
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Distribusi Temuan</Text>
                  <View style={styles.countsGrid}>
                    {Object.entries(selectedScan.distribution || {}).map(([cls, count]) => (
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

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Temuan Detail</Text>
                  {selectedScan.findings.map((finding, index) => (
                    <View key={index} style={styles.findingItem}>
                      <IconSymbol name="checkmark.circle.fill" size={16} color={Colors.light.tint} />
                      <Text style={styles.findingItemText}>{finding}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.suggestionBox}>
                  <View style={styles.suggestionHeader}>
                    <IconSymbol name="lightbulb.fill" size={18} color="#0EA5E9" />
                    <Text style={styles.suggestionTitle}>Saran Penanganan</Text>
                  </View>
                  <Text style={styles.suggestionText}>
                    {getSuggestion(selectedScan.riskLevel)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setSelectedScan(null)}
                >
                  <Text style={styles.closeModalButtonText}>Tutup</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.light.text },
  subtitle: { fontSize: 14, color: Colors.light.icon, marginTop: 4 },

  controls: { paddingHorizontal: 24, paddingBottom: 16, gap: 12 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  filterScroll: { gap: 8, paddingRight: 24 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  filterTabText: { fontSize: 13, fontWeight: '600', color: Colors.light.icon },
  filterTabTextActive: { color: '#fff' },

  listContent: { padding: 24, paddingTop: 4, paddingBottom: 100 },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  dateBox: { gap: 2 },
  dateText: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  timeText: { fontSize: 12, color: Colors.light.icon },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  riskText: { fontSize: 11, fontWeight: '700' },

  cardContent: { gap: 12 },
  mainInfo: { gap: 2 },
  scanTypeText: { fontSize: 16, fontWeight: '700', color: Colors.light.text },
  confidenceText: { fontSize: 12, color: Colors.light.icon },

  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, color: Colors.light.icon, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 15, fontWeight: '700', color: Colors.light.text, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#E2E8F0' },

  findingsBox: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  findingsSummary: { fontSize: 13, color: '#64748B', lineHeight: 18 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  viewDetailText: { fontSize: 13, fontWeight: '600', color: Colors.light.tint },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.light.icon },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.light.text },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  detailRiskBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginBottom: 20 },
  detailRiskText: { fontSize: 13, fontWeight: '800' },

  detailSection: { marginBottom: 24 },
  detailLabel: { fontSize: 12, fontWeight: '600', color: Colors.light.icon, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  detailValue: { fontSize: 16, fontWeight: '700', color: Colors.light.text },

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

  detailConfidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailConfidenceValue: { fontSize: 18, fontWeight: '800', color: Colors.light.text, width: 45 },
  detailProgressBarBg: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  detailProgressBarFill: { height: '100%', backgroundColor: Colors.light.tint, borderRadius: 4 },

  findingItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  findingItemText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 20 },

  suggestionBox: { backgroundColor: '#F0F9FF', borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 24, borderWidth: 1, borderColor: '#BAE6FD' },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  suggestionTitle: { fontSize: 15, fontWeight: '700', color: '#0369A1' },
  suggestionText: { fontSize: 14, color: '#0C4A6E', lineHeight: 20 },

  closeModalButton: { backgroundColor: Colors.light.tint, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  closeModalButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
