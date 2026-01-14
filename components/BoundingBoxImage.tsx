/**
 * Component to display image with bounding boxes overlaid using SVG
 * Forces square aspect ratio to match model input (640x640)
 */
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

interface Detection {
    bbox: [number, number, number, number];
    class: string;
    confidence: number;
}

interface BoundingBoxImageProps {
    imageUri: string;
    detections: Detection[];
    imageWidth?: number;  // The width of the coordinate space (e.g., 640 for YOLO)
    imageHeight?: number; // The height of the coordinate space (e.g., 640 for YOLO)
    actualWidth?: number; // The actual width of the image to display
    actualHeight?: number; // The actual height of the image to display
    style?: object;
}

// Color map for different caries classes
const CLASS_COLORS: Record<string, string> = {
    D0: '#22C55E', // Green
    D1: '#EAB308', // Yellow
    D2: '#F97316', // Orange
    D3: '#EF4444', // Red
    D4: '#EC4899', // Pink
    D5: '#8B5CF6', // Purple
    D6: '#3B82F6', // Blue
};

export function BoundingBoxImage({
    imageUri,
    detections,
    imageWidth = 640,
    imageHeight = 640,
    actualWidth,
    actualHeight,
    style,
}: BoundingBoxImageProps) {
    const [containerWidth, setContainerWidth] = useState(0);

    const handleLayout = (event: LayoutChangeEvent) => {
        const { width } = event.nativeEvent.layout;
        setContainerWidth(width);
    };

    // Calculate display dimensions
    // If actual dimensions are provided, preserve aspect ratio. Otherwise default to square.
    const aspectRatio = (actualWidth && actualHeight) ? actualWidth / actualHeight : 1;
    const displayHeight = containerWidth / aspectRatio;

    // Scale factors: from coordinate space (imageWidth/Height) to display space
    // Note: If actualWidth/Height are not provided, we assume square display, so scaleX = scaleY
    const scaleX = containerWidth / imageWidth;
    const scaleY = displayHeight / imageHeight;

    // Dynamic styling based on display size
    const baseScale = Math.max(0.6, Math.min(2.0, containerWidth / 300));
    const strokeWidth = 2 * baseScale;
    const fontSize = 11 * baseScale;
    const labelPad = 2 * baseScale;
    const cornerRadius = 4 * baseScale;

    return (
        <View style={[styles.container, style]} onLayout={handleLayout}>
            {/* Container matching image aspect ratio */}
            <View style={{ width: containerWidth, height: displayHeight, alignSelf: 'center' }}>
                <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    contentFit="contain" // Ensure full image is visible
                />

                {containerWidth > 0 && (
                    <Svg
                        style={styles.svgOverlay}
                        width={containerWidth}
                        height={displayHeight}
                    >
                        {detections.map((detection, index) => {
                            const [x1, y1, x2, y2] = detection.bbox;

                            // Scale coordinates from model space to display space
                            const scaledX1 = x1 * scaleX;
                            const scaledY1 = y1 * scaleY;
                            const scaledX2 = x2 * scaleX;
                            const scaledY2 = y2 * scaleY;

                            const width = scaledX2 - scaledX1;
                            const height = scaledY2 - scaledY1;

                            const color = CLASS_COLORS[detection.class] || '#FFFFFF';
                            const label = detection.class;

                            // Label dimensions
                            const textWidth = label.length * (fontSize * 0.7) + (labelPad * 4);
                            const labelWidth = Math.max(24 * baseScale, textWidth);
                            const labelHeight = 18 * baseScale;

                            return (
                                <React.Fragment key={index}>
                                    {/* Bounding box rectangle */}
                                    <Rect
                                        x={scaledX1}
                                        y={scaledY1}
                                        width={width}
                                        height={height}
                                        stroke={color}
                                        strokeWidth={strokeWidth}
                                        fill="rgba(0,0,0,0)"
                                    />

                                    {/* Background for label */}
                                    <Rect
                                        x={scaledX1 + strokeWidth}
                                        y={scaledY1 + strokeWidth}
                                        width={labelWidth}
                                        height={labelHeight}
                                        fill={color}
                                        rx={cornerRadius}
                                    />

                                    {/* Label text */}
                                    <SvgText
                                        x={scaledX1 + strokeWidth + (labelWidth / 2)}
                                        y={scaledY1 + strokeWidth + (labelHeight / 2) + (1 * baseScale)}
                                        fontSize={fontSize}
                                        fontWeight="800"
                                        fill="#FFFFFF"
                                        textAnchor="middle"
                                        alignmentBaseline="middle"
                                    >
                                        {label}
                                    </SvgText>
                                </React.Fragment>
                            );
                        })}
                    </Svg>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    svgOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
});
