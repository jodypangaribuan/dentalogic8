import { IconSymbol } from '@/components/ui/icon-symbol';
import { getServerUrl } from '@/utils/config';
import { predict } from '@/utils/prediction-service';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

const API_URL = getServerUrl();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Detection result interface
interface Detection {
  bbox: [number, number, number, number];
  class: string;
  confidence: number;
}

// Colors for different caries classes
const CLASS_COLORS: { [key: string]: string } = {
  D0: '#22C55E',
  D1: '#84CC16',
  D2: '#EAB308',
  D3: '#F97316',
  D4: '#EF4444',
  D5: '#DC2626',
  D6: '#3B82F6',
};

export default function ScanScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef<Camera>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [previewLayout, setPreviewLayout] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
  const [photoInfo, setPhotoInfo] = useState({ width: 1920, height: 1080 });

  // Check API availability on mount
  useEffect(() => {
    (async () => {
      await requestPermission();
      try {
        const response = await fetch(`${API_URL}/health`);
        setApiAvailable(response.ok);
      } catch (e) {
        setApiAvailable(false);
      }
    })();
  }, []);

  // Stop/start detection when screen focus changes
  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
      return () => setIsActive(false);
    }, [])
  );

  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewLayout({ width, height });
  };

  // Toggle camera position
  const toggleCamera = () => {
    setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
  };

  // Toggle flash
  const toggleFlash = () => {
    setFlashOn(prev => !prev);
  };

  // Process frames using API or Local Model
  useEffect(() => {
    if (!isActive) return;

    let isMounted = true;
    let isCapturing = false;

    const processFrame = async () => {
      if (!isMounted || !isActive || isCapturing || !cameraRef.current) {
        if (isMounted && isActive) setTimeout(processFrame, 500);
        return;
      }

      isCapturing = true;
      setIsProcessing(true);

      try {
        const photo = await cameraRef.current.takePhoto({
          enableShutterSound: false,
        });

        if (photo && isMounted && isActive) {
          setPhotoInfo({ width: photo.width, height: photo.height });

          const uri = `file://${photo.path}`;

          // Use unified prediction service (handles local or API automatically)
          const result = await predict(uri);

          if (isMounted && isActive && result) {
            setDetections(result.detections || []);
          }

          try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          } catch (e) { }
        }
      } catch (error) {
        console.error('Frame processing error:', error);
      } finally {
        isCapturing = false;
        setIsProcessing(false);
        if (isMounted && isActive) setTimeout(processFrame, 100); // reduced delay for smoother feel
      }
    };

    const timeoutId = setTimeout(processFrame, 500);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isActive, flashOn]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission is required</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading camera...</Text>
      </View>
    );
  }

  const needsSwap = photoInfo.width > photoInfo.height && previewLayout.height > previewLayout.width;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        photo={true}
        torch={flashOn ? 'on' : 'off'}
        onLayout={onPreviewLayout}
      />

      {/* Detection Overlay */}
      <Svg style={StyleSheet.absoluteFill} width={previewLayout.width} height={previewLayout.height}>
        {detections.map((det, index) => {
          let [x1, y1, x2, y2] = det.bbox;
          // Normalize coordinates if they are in pixel values (assuming > 1 means pixels)
          if (x1 > 1 || y1 > 1 || x2 > 1 || y2 > 1) {
            x1 = x1 / 640;
            y1 = y1 / 640;
            x2 = x2 / 640;
            y2 = y2 / 640;
          }

          // Use coordinates directly without rotation as ImageManipulator usually handles orientation
          let nx1 = x1, ny1 = y1, nx2 = x2, ny2 = y2;

          const effectivePhotoWidth = needsSwap ? photoInfo.height : photoInfo.width;
          const effectivePhotoHeight = needsSwap ? photoInfo.width : photoInfo.height;
          const photoAspect = effectivePhotoWidth / effectivePhotoHeight;
          const screenAspect = previewLayout.width / previewLayout.height;

          let scale: number, offsetX = 0, offsetY = 0;
          if (photoAspect > screenAspect) {
            scale = previewLayout.height / effectivePhotoHeight;
            offsetX = (previewLayout.width - effectivePhotoWidth * scale) / 2;
          } else {
            scale = previewLayout.width / effectivePhotoWidth;
            offsetY = (previewLayout.height - effectivePhotoHeight * scale) / 2;
          }

          const x = nx1 * effectivePhotoWidth * scale + offsetX;
          const y = ny1 * effectivePhotoHeight * scale + offsetY;
          const width = (nx2 - nx1) * effectivePhotoWidth * scale;
          const height = (ny2 - ny1) * effectivePhotoHeight * scale;
          const color = CLASS_COLORS[det.class] || '#FFFFFF';

          if (width < 5 || height < 5) return null;
          // Filter out obviously erratic boxes that are way off screen
          // Relaxed constraints to ensure we see something
          if (x > previewLayout.width + 100 || y > previewLayout.height + 100 || x + width < -100 || y + height < -100) return null;

          return (
            <React.Fragment key={index}>
              <Rect
                x={x}
                y={y}
                width={width}
                height={height}
                stroke={color}
                strokeWidth={3}
                fill="transparent"
              />
              <Rect
                x={x}
                y={Math.max(0, y - 24)}
                width={Math.min(width, 100)} // Cap label width
                height={24}
                fill={color}
                rx={4}
              />
              <SvgText
                x={x + 4}
                y={Math.max(0, y - 24) + 16}
                fill="#FFFFFF"
                fontSize={12}
                fontWeight="bold"
              >
                {det.class} {det.confidence.toFixed(0)}%
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <IconSymbol name="chevron.left" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Camera Controls */}
      <View style={styles.controlsContainer}>
        {/* Flash Button */}
        <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
          <IconSymbol
            name={flashOn ? "bolt.fill" : "bolt.slash.fill"}
            size={24}
            color={flashOn ? "#FFCC00" : "#FFFFFF"}
          />
        </TouchableOpacity>

        {/* Switch Camera Button */}
        <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
          <IconSymbol name="arrow.triangle.2.circlepath.camera" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Processing Indicator */}
      {isProcessing && (
        <View style={styles.processingDot} />
      )}

      {/* Detection Count */}
      {detections.length > 0 && (
        <View style={styles.detectionBadge}>
          <Text style={styles.detectionBadgeText}>{detections.length} detected</Text>
        </View>
      )}
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
  message: {
    color: '#FFF',
    fontSize: 16,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    gap: 16,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingDot: {
    position: 'absolute',
    top: 70,
    left: 70,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
  },
  detectionBadge: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  detectionBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});