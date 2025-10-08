import { navigationTracker } from '@/utils/navigation-tracker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { View } from 'react-native';

export default function ScanScreen() {
  const hasNavigatedToCamera = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Check if we're coming back from camera (second focus)
      if (hasNavigatedToCamera.current) {
        // We're coming back from camera, redirect to the previous screen
        const lastTab = navigationTracker.getLastVisitedTab();
        
        if (lastTab === 'history') {
          router.replace('/(tabs)/history');
        } else {
          router.replace('/(tabs)');
        }
        
        // Reset the flag
        hasNavigatedToCamera.current = false;
        return;
      }

      // First time focusing, navigate to camera
      hasNavigatedToCamera.current = true;
      const lastTab = navigationTracker.getLastVisitedTab();
      router.push({
        pathname: '/camera-modal',
        params: { from: lastTab }
      });
    }, [])
  );

  // Return empty view since we immediately navigate away
  return <View style={{ flex: 1 }} />;
}