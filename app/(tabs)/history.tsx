
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { HistoryItem, HistoryService } from '@/utils/history-service';
import { navigationTracker } from '@/utils/navigation-tracker';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Dimensions, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Reuse treatment/severity info map (simplified version for history)
const SEVERITY_INFO: Record<string, { severity: string; color: string; bg: string }> = {
  D0: { severity: 'Gigi Sehat', color: '#10B981', bg: '#ECFDF5' },
  D1: { severity: 'Lesi Awal', color: '#EAB308', bg: '#FEF9C3' },
  D2: { severity: 'Lesi Email', color: '#F97316', bg: '#FFEDD5' },
  D3: { severity: 'Lesi Dentin Awal', color: '#EF4444', bg: '#FEE2E2' },
  D4: { severity: 'Karies Dentin Dalam', color: '#EC4899', bg: '#FCE7F3' },
  D5: { severity: 'Karies Mendekati Pulpa', color: '#8B5CF6', bg: '#EDE9FE' },
  D6: { severity: 'Kerusakan Berat', color: '#3B82F6', bg: '#DBEAFE' },
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScan, setSelectedScan] = useState<HistoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = async () => {
    setIsLoading(true);
    const data = await HistoryService.getHistory();
    setHistory(data);
    setIsLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      navigationTracker.setLastVisitedTab('history');
      loadHistory();
    }, [])
  );

  const handleDelete = (id: string) => {
    Alert.alert(
      "Hapus Riwayat",
      "Apakah Anda yakin ingin menghapus data ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            await HistoryService.deleteItem(id);
            loadHistory(); // Reload
            if (selectedScan?.id === id) setSelectedScan(null);
          }
        }
      ]
    );
  };

  const filteredHistory = history.filter(item => {
    const info = SEVERITY_INFO[item.label] || { severity: item.label };
    return (
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      info.severity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dateStr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const renderScanItem = ({ item }: { item: HistoryItem }) => {
    const info = SEVERITY_INFO[item.label] || { severity: item.label, color: Colors.light.text, bg: '#F1F5F9' };
    const detectionCount = item.detections.length;

    return (
      <View style={styles.historyCardContainer}>
        <TouchableOpacity
          style={styles.historyCard}
          activeOpacity={0.7}
          onPress={() => {
            router.push({
              pathname: '/analysis-detail',
              params: {
                imageUri: item.imageUri,
                label: item.label,
                confidence: item.confidence.toString(),
                detections: JSON.stringify(item.detections),
                inferenceTime: item.inferenceTime.toString(),
                source: item.source,
                imageWidth: item.imageWidth.toString(),
                imageHeight: item.imageHeight.toString()
              }
            });
          }}
        >
          <Image
            source={{ uri: item.imageUri }}
            style={styles.cardImage}
            contentFit="cover"
            transition={200}
          />

          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={[styles.badgeContainer, { backgroundColor: info.bg }]}>
                <Text style={[styles.badgeText, { color: info.color }]}>{item.label}</Text>
              </View>
              <Text style={styles.dateText}>{item.dateStr}</Text>
            </View>

            <Text style={styles.severityTitle} numberOfLines={1}>{info.severity}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <IconSymbol name="scope" size={12} color={Colors.light.icon} />
                <Text style={styles.statText}>{detectionCount} Deteksi</Text>
              </View>
              <View style={styles.statItem}>
                <IconSymbol name="checkmark.shield.fill" size={12} color={Colors.light.icon} />
                <Text style={styles.statText}>{(item.confidence * 100).toFixed(0)}% Akurat</Text>
              </View>
            </View>
          </View>

          <IconSymbol name="chevron.right" size={20} color="#CBD5E1" style={styles.chevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => handleDelete(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="trash.fill" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Riwayat</Text>
        <Text style={styles.subtitle}>{history.length} Analisis Tersimpan</Text>
      </View>

      <View style={styles.searchContainer}>
        <IconSymbol name="magnifyingglass" size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari riwayat..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
      </View>

      <FlatList
        data={filteredHistory}
        renderItem={renderScanItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Image
              source={require('../../assets/images/react-logo.png')} // Fallback
              style={{ width: 80, height: 80, opacity: 0.1, marginBottom: 16 }}
              tintColor={Colors.light.icon}
            />
            <Text style={styles.emptyTitle}>Belum Ada Riwayat</Text>
            <Text style={styles.emptyText}>Lakukan analisis gigi pertama Anda untuk melihat hasilnya di sini.</Text>

            <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/(tabs)/scan')}>
              <Text style={styles.ctaButtonText}>Mulai Analisis</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.light.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4, fontWeight: '500' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: Colors.light.text, fontWeight: '500' },

  listContent: { padding: 24, paddingTop: 4, paddingBottom: 100 },
  historyCardContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  historyCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F8FAFC'
  },
  deleteAction: {
    marginLeft: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  cardImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  cardContent: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  badgeContainer: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  dateText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  severityTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.text, marginBottom: 6 },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  chevron: { marginLeft: 8 },

  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  ctaButton: { backgroundColor: Colors.light.tint, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  ctaButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalContainer: { flex: 1, backgroundColor: '#fff', paddingTop: 12 },
  modalDragIndicator: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: Colors.light.text },
  modalDate: { fontSize: 14, color: '#64748B', fontWeight: '500', marginTop: 2 },
  closeButton: {},

  modalScroll: { flex: 1 },
  imageWrapper: { marginHorizontal: 24, marginBottom: 24, borderRadius: 20, overflow: 'hidden', height: 320, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  modalImage: { width: '100%', height: '100%' },

  infoContainer: { paddingHorizontal: 24 },
  mainStatCard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20 },
  bigBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  bigBadgeText: { fontSize: 16, fontWeight: '800' },
  mainSeverityText: { fontSize: 18, fontWeight: '700', color: Colors.light.text, flex: 1 },

  gridStats: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  gridItem: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
  gridLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  gridValue: { fontSize: 16, fontWeight: '800', color: Colors.light.text },

  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 24, padding: 18, backgroundColor: '#FEF2F2', borderRadius: 16, marginBottom: 40 },
  deleteButtonText: { color: '#EF4444', fontWeight: '700', fontSize: 16 }
});
