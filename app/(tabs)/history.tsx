import { Colors } from '@/constants/theme';
import { navigationTracker } from '@/utils/navigation-tracker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Mock data for personal caries scan history
const mockScanHistory = [
  {
    id: '1',
    date: '15 Des 2024',
    time: '14:30',
    scanType: 'Caries Detection',
    status: 'Completed',
    scanQuality: 'High',
    cariesDetected: 2,
    riskLevel: 'Medium',
    findings: ['Karies terdeteksi pada gigi geraham atas kanan', 'Karies ringan pada gigi premolar bawah'],
    confidence: 94,
    imageUri: null
  },
  {
    id: '2',
    date: '12 Des 2024',
    time: '09:15',
    scanType: 'Caries Detection',
    status: 'Completed',
    scanQuality: 'High',
    cariesDetected: 0,
    riskLevel: 'Low',
    findings: ['Tidak ada karies terdeteksi', 'Gigi dalam kondisi sehat'],
    confidence: 98,
    imageUri: null
  },
  {
    id: '3',
    date: '08 Des 2024',
    time: '16:45',
    scanType: 'Caries Detection',
    status: 'Completed',
    scanQuality: 'Medium',
    cariesDetected: 1,
    riskLevel: 'High',
    findings: ['Karies dalam terdeteksi pada gigi geraham bawah'],
    confidence: 87,
    imageUri: null
  },
  {
    id: '4',
    date: '05 Des 2024',
    time: '11:20',
    scanType: 'Caries Detection',
    status: 'Completed',
    scanQuality: 'High',
    cariesDetected: 3,
    riskLevel: 'High',
    findings: ['Multiple karies terdeteksi', 'Perlu perawatan segera'],
    confidence: 92,
    imageUri: null
  },
  {
    id: '5',
    date: '01 Des 2024',
    time: '13:00',
    scanType: 'Caries Detection',
    status: 'Completed',
    scanQuality: 'High',
    cariesDetected: 0,
    riskLevel: 'Low',
    findings: ['Gigi sehat, tidak ada karies'],
    confidence: 96,
    imageUri: null
  }
];

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  useFocusEffect(
    useCallback(() => {
      // Track that user is on history screen
      navigationTracker.setLastVisitedTab('history');
    }, [])
  );

  // Filter and search logic
  const filteredScans = mockScanHistory.filter(scan => {
    const matchesSearch = scan.scanType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         scan.findings.some(finding => finding.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         scan.riskLevel.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterStatus === 'All' || scan.riskLevel === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return '#4CAF50';
      case 'In Progress':
        return '#FF9800';
      case 'Pending Review':
        return '#2196F3';
      default:
        return Colors.light.tint;
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'High':
        return '#4CAF50';
      case 'Medium':
        return '#FF9800';
      case 'Low':
        return '#F44336';
      default:
        return Colors.light.icon;
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Low':
        return '#4CAF50';
      case 'Medium':
        return '#FF9800';
      case 'High':
        return '#F44336';
      default:
        return Colors.light.icon;
    }
  };

  const getCariesCountColor = (count: number) => {
    if (count === 0) return '#4CAF50';
    if (count <= 2) return '#FF9800';
    return '#F44336';
  };

  const renderScanItem = ({ item }: { item: typeof mockScanHistory[0] }) => (
    <TouchableOpacity 
      style={[
        styles.scanItem, 
        { 
          backgroundColor: Colors.light.background,
          borderColor: Colors.light.icon,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }
      ]}
    >
      {/* Header with date and time */}
      <View style={styles.scanItemHeader}>
        <View style={styles.dateTimeContainer}>
          <Text style={[styles.scanDate, { color: Colors.light.text }]}>
            {item.date}
          </Text>
          <Text style={[styles.scanTime, { color: Colors.light.icon }]}>
            {item.time}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) }
        ]}>
          <Text style={[styles.statusText, { color: 'white' }]}>{item.status}</Text>
        </View>
      </View>

      {/* Scan type and confidence */}
      <View style={styles.scanInfoRow}>
        <Text style={[styles.scanType, { color: Colors.light.text }]}>
          {item.scanType}
        </Text>
        <View style={styles.confidenceContainer}>
          <Text style={[styles.confidenceLabel, { color: Colors.light.icon }]}>
            Confidence: {item.confidence}%
          </Text>
        </View>
      </View>

      {/* Caries detection results */}
      <View style={styles.cariesResultsContainer}>
        <View style={styles.cariesCountRow}>
          <Text style={[styles.cariesCountLabel, { color: Colors.light.text }]}>
            Karies Terdeteksi:
          </Text>
          <View style={[
            styles.cariesCountBadge,
            { backgroundColor: getCariesCountColor(item.cariesDetected) }
          ]}>
            <Text style={[styles.cariesCountText, { color: 'white' }]}>
              {item.cariesDetected}
            </Text>
          </View>
        </View>
        
        <View style={styles.riskLevelRow}>
          <Text style={[styles.riskLevelLabel, { color: Colors.light.text }]}>
            Tingkat Risiko:
          </Text>
          <View style={[
            styles.riskLevelBadge,
            { backgroundColor: getRiskLevelColor(item.riskLevel) }
          ]}>
            <Text style={[styles.riskLevelText, { color: 'white' }]}>
              {item.riskLevel}
            </Text>
          </View>
        </View>
      </View>

      {/* Quality indicator */}
      <View style={styles.qualityRow}>
        <Text style={[styles.qualityLabel, { color: Colors.light.icon }]}>
          Kualitas Scan:
        </Text>
        <View style={[
          styles.qualityBadge,
          { backgroundColor: getQualityColor(item.scanQuality) }
        ]}>
          <Text style={[styles.qualityText, { color: 'white' }]}>
            {item.scanQuality}
          </Text>
        </View>
      </View>

      {/* Key findings */}
      {item.findings && item.findings.length > 0 && (
        <View style={styles.findingsContainer}>
          <Text style={[styles.findingsLabel, { color: Colors.light.icon }]}>
            Hasil Deteksi:
          </Text>
          <Text style={[styles.findingsText, { color: Colors.light.text }]} numberOfLines={3}>
            {item.findings.join(' • ')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.light.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors.light.text }]}>
          Riwayat Scan Karies
        </Text>
        <Text style={[styles.subtitle, { color: Colors.light.icon }]}>
          Pantau perkembangan kesehatan gigi Anda
        </Text>
      </View>
      
      {/* Search and Filter Controls */}
      <View style={styles.controlsContainer}>
        <TextInput
          style={[styles.searchInput, { 
            backgroundColor: Colors.light.background,
            borderColor: Colors.light.icon,
            color: Colors.light.text
          }]}
          placeholder="Cari berdasarkan tanggal, hasil, atau tingkat risiko..."
          placeholderTextColor={Colors.light.icon}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        <View style={styles.filterContainer}>
          {['All', 'Low', 'Medium', 'High'].map((risk) => (
            <TouchableOpacity
              key={risk}
              style={[
                styles.filterButton,
                {
                  backgroundColor: filterStatus === risk ? Colors.light.tint : Colors.light.background,
                  borderColor: Colors.light.icon
                }
              ]}
              onPress={() => setFilterStatus(risk)}
            >
              <Text style={[
                styles.filterButtonText,
                { color: filterStatus === risk ? 'white' : Colors.light.text }
              ]}>
                {risk === 'All' ? 'Semua' : `Risiko ${risk}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {filteredScans.length > 0 ? (
        <FlatList
          data={filteredScans}
          renderItem={renderScanItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: Colors.light.icon }]}>
            {mockScanHistory.length === 0 
              ? "Belum ada scan karies. Mulai dengan melakukan scan gigi pertama Anda!"
              : "Tidak ada scan yang sesuai dengan kriteria pencarian."
            }
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Increased padding to account for tab bar
  },
  scanItem: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  scanItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateTimeContainer: {
    flex: 1,
  },
  scanDate: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  scanTime: {
    fontSize: 14,
    fontWeight: '500',
  },
  scanInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanType: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  confidenceContainer: {
    alignItems: 'flex-end',
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  cariesResultsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cariesCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cariesCountLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  cariesCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 40,
    alignItems: 'center',
  },
  cariesCountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  riskLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskLevelLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  riskLevelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  riskLevelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  qualityLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  qualityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  qualityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  findingsContainer: {
    marginBottom: 12,
  },
  findingsLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  findingsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
