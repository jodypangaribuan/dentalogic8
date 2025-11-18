import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  // Always use light theme colors for consistency
  const backgroundColor = Colors.light.background;
  const activeTintColor = Colors.light.tabIconSelected;
  const inactiveTintColor = Colors.light.tabIconDefault;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeTintColor,
        tabBarInactiveTintColor: inactiveTintColor,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: backgroundColor,
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
          justifyContent: 'space-around',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 26 : 24} 
              name={focused ? "house.fill" : "house"} 
              color={color} 
            />
          ),
          tabBarItemStyle: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          },
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 26 : 24} 
              name={focused ? "camera.fill" : "camera"} 
              color={color} 
            />
          ),
          tabBarItemStyle: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          },
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 26 : 24} 
              name={focused ? "clock.arrow.circlepath" : "clock"} 
              color={color} 
            />
          ),
          tabBarItemStyle: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          },
        }}
      />
    </Tabs>
  );
}
