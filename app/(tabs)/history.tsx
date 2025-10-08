import { Colors } from '@/constants/theme';
import { navigationTracker } from '@/utils/navigation-tracker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Mock data for scan history
const mockScanHistory: any[] = [];

export default function HistoryScreen() {
  useFocusEffect(
    useCallback(() => {
      // Track that user is on history screen
      navigationTracker.setLastVisitedTab('history');
    }, [])
  );

  const renderScanItem = ({ item }: { item: typeof mockScanHistory[0] }) => (
    <TouchableOpacity 
      style={[
        styles.scanItem, 
        { 
          backgroundColor: Colors.light.background,
          borderColor: Colors.light.icon
        }
      ]}
    >
      <View style={styles.scanItemHeader}>
        <Text style={[styles.patientName, { color: Colors.light.text }]}>
          {item.patient}
        </Text>
        <Text style={[styles.scanDate, { color: Colors.light.icon }]}>
          {item.date}
        </Text>
      </View>
      <View style={styles.scanItemDetails}>
        <Text style={[styles.scanType, { color: Colors.light.icon }]}>
          {item.type}
        </Text>
        <Text style={[styles.scanTime, { color: Colors.light.icon }]}>
          {item.time}
        </Text>
      </View>
      <View style={[
        styles.statusBadge,
        { backgroundColor: Colors.light.tint }
      ]}>
        <Text style={[styles.statusText, { color: Colors.light.background }]}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.light.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors.light.text }]}>
          
        </Text>
        <Text style={[styles.subtitle, { color: Colors.light.icon }]}>
          
        </Text>
      </View>
      
      {mockScanHistory.length > 0 ? (
        <FlatList
          data={mockScanHistory}
          renderItem={renderScanItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: Colors.light.icon }]}>
            
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
    paddingBottom: 20,
  },
  scanItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  scanItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
  },
  scanDate: {
    fontSize: 14,
    fontWeight: '500',
  },
  scanItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanType: {
    fontSize: 16,
  },
  scanTime: {
    fontSize: 14,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});
