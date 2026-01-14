import { IconSymbol } from '@/components/ui/icon-symbol';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CaptureScreen() {
    const [isCapturing, setIsCapturing] = useState(false);

    // Auto-launch camera on mount
    useEffect(() => {
        launchCamera();
    }, []);

    const launchCamera = async () => {
        setIsCapturing(true);

        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();

            if (!permission.granted) {
                router.back();
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.9,
            });

            if (!result.canceled && result.assets[0]) {
                // Navigate back to home with the captured image
                router.replace({
                    pathname: '/(tabs)',
                    params: {
                        capturedImage: result.assets[0].uri,
                        width: result.assets[0].width,
                        height: result.assets[0].height
                    },
                });
            } else {
                // User cancelled, go back
                router.back();
            }
        } catch (error) {
            console.error('Camera error:', error);
            router.back();
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <IconSymbol name="chevron.left" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.message}>Opening camera...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButton: {
        position: 'absolute',
        top: 60,
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        color: '#FFF',
        fontSize: 16,
        marginTop: 16,
    },
});
