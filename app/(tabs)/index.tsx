import { Colors } from '@/constants/theme';
import { navigationTracker } from '@/utils/navigation-tracker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  useFocusEffect(
    useCallback(() => {
      // Track that user is on home screen
      navigationTracker.setLastVisitedTab('home');
    }, [])
  );
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.light.background }]} edges={['top']}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors.light.text }]}>
          
        </Text>
        <Text style={[styles.subtitle, { color: Colors.light.icon }]}>
          
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
});
