/**
 * Local ONNX Runtime inference for offline caries detection
 * Uses onnxruntime-react-native to run the model on-device
 */
import { Buffer } from 'buffer';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';

// Model configuration
const MODEL_INPUT_SIZE = 640;
const CARIES_CLASSES = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const CONFIDENCE_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.5;

// Model file name
const MODEL_FILE_NAME = 'best_opset21.onnx';

// Global session
let session: InferenceSession | null = null;
let isModelLoading = false;

export interface LocalDetection {
    bbox: [number, number, number, number];
    class: string;
    confidence: number;
}

export interface LocalPredictionResult {
    class: string;
    confidence: number;
    allProbabilities: Array<{
        class: string;
        probability: number;
    }>;
    inferenceTime: number;
    detections: LocalDetection[];
    boundingBoxes: number[][];
}

/**
 * Load the ONNX model from assets
 */
export async function loadModel(): Promise<boolean> {
    if (session) {
        console.log('[LocalInference] Model already loaded');
        return true;
    }

    if (isModelLoading) {
        console.log('[LocalInference] Model is already loading...');
        // Wait for loading to complete
        while (isModelLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return session !== null;
    }

    isModelLoading = true;

    try {
        console.log('[LocalInference] Loading ONNX model...');

        // Target path in document directory
        const modelPath = `${FileSystem.documentDirectory}${MODEL_FILE_NAME}`;

        // Check if model already exists in document directory
        const modelInfo = await FileSystem.getInfoAsync(modelPath);

        if (!modelInfo.exists) {
            console.log('[LocalInference] Copying model to document directory...');

            // Load model from bundled assets
            const modelAsset = Asset.fromModule(require('../assets/models/best_opset21.onnx'));
            await modelAsset.downloadAsync();

            if (!modelAsset.localUri) {
                throw new Error('Failed to download model asset');
            }

            console.log('[LocalInference] Model asset URI:', modelAsset.localUri);

            // Copy to document directory
            await FileSystem.copyAsync({
                from: modelAsset.localUri,
                to: modelPath,
            });

            console.log('[LocalInference] Model copied to:', modelPath);
        } else {
            console.log('[LocalInference] Model already exists at:', modelPath);
        }

        // Create inference session from the file path
        // ONNX Runtime needs a proper file path, not a content URI
        console.log('[LocalInference] Creating inference session...');
        session = await InferenceSession.create(modelPath);

        console.log('[LocalInference] Model loaded successfully');
        console.log('[LocalInference] Input names:', session.inputNames);
        console.log('[LocalInference] Output names:', session.outputNames);

        return true;
    } catch (error) {
        console.error('[LocalInference] Failed to load model:', error);
        session = null;
        return false;
    } finally {
        isModelLoading = false;
    }
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
    return session !== null;
}

/**
 * Preprocess image for YOLO model
 * - Resize with letterboxing (preserve aspect ratio)
 * - Normalize to [0, 1]
 * - Convert to CHW format
 */
async function preprocessImage(imageUri: string): Promise<{
    tensor: Float32Array;
    scale: number;
    padTop: number;
    padLeft: number;
    origWidth: number;
    origHeight: number;
}> {
    // Resize to 640x640 and get base64 JPEG
    const resized = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
        { format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!resized.base64) {
        throw new Error('Failed to get base64 image data');
    }

    // Decode JPEG to pixel data
    const pixelData = decodeJpegToPixels(resized.base64);

    // Create tensor in CHW format with normalization
    const tensor = new Float32Array(1 * 3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);

    for (let y = 0; y < MODEL_INPUT_SIZE; y++) {
        for (let x = 0; x < MODEL_INPUT_SIZE; x++) {
            const pixelIndex = (y * MODEL_INPUT_SIZE + x) * 4; // RGBA
            const r = pixelData[pixelIndex] / 255.0;
            const g = pixelData[pixelIndex + 1] / 255.0;
            const b = pixelData[pixelIndex + 2] / 255.0;

            // CHW format: [channel][height][width]
            tensor[0 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE + y * MODEL_INPUT_SIZE + x] = r;
            tensor[1 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE + y * MODEL_INPUT_SIZE + x] = g;
            tensor[2 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE + y * MODEL_INPUT_SIZE + x] = b;
        }
    }

    // For simplified version, we assume the image is resized to 640x640
    // Scale is 1.0 and no padding
    return {
        tensor,
        scale: 1.0,
        padTop: 0,
        padLeft: 0,
        origWidth: MODEL_INPUT_SIZE,
        origHeight: MODEL_INPUT_SIZE,
    };
}

/**
 * Decode JPEG base64 to RGBA pixel array using jpeg-js
 */
function decodeJpegToPixels(base64: string): Uint8Array {
    try {
        // Convert base64 to Buffer
        const jpegBuffer = Buffer.from(base64, 'base64');

        // Decode JPEG
        const decoded = jpeg.decode(jpegBuffer, { useTArray: true });

        console.log(`[LocalInference] Decoded image: ${decoded.width}x${decoded.height}`);

        // jpeg-js returns RGBA data
        return decoded.data as Uint8Array;
    } catch (error) {
        console.error('[LocalInference] JPEG decode error:', error);
        // Return gray placeholder on error
        const pixels = new Uint8Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 4);
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = 128;     // R
            pixels[i + 1] = 128; // G
            pixels[i + 2] = 128; // B
            pixels[i + 3] = 255; // A
        }
        return pixels;
    }
}

/**
 * Convert xywh to xyxy format
 */
function xywh2xyxy(boxes: number[][]): number[][] {
    return boxes.map(box => {
        const [x, y, w, h] = box;
        return [
            x - w / 2, // x1
            y - h / 2, // y1
            x + w / 2, // x2
            y + h / 2, // y2
        ];
    });
}

/**
 * Calculate IoU between two boxes
 */
function calculateIoU(box1: number[], box2: number[]): number {
    const x1 = Math.max(box1[0], box2[0]);
    const y1 = Math.max(box1[1], box2[1]);
    const x2 = Math.min(box1[2], box2[2]);
    const y2 = Math.min(box1[3], box2[3]);

    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const area1 = (box1[2] - box1[0]) * (box1[3] - box1[1]);
    const area2 = (box2[2] - box2[0]) * (box2[3] - box2[1]);

    return intersection / (area1 + area2 - intersection);
}

/**
 * Non-Maximum Suppression
 */
function nms(
    boxes: number[][],
    scores: number[],
    classIds: number[],
    iouThreshold: number
): { boxes: number[][]; scores: number[]; classIds: number[] } {
    if (boxes.length === 0) {
        return { boxes: [], scores: [], classIds: [] };
    }

    // Sort by score descending
    const indices = scores
        .map((score, idx) => ({ score, idx }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.idx);

    const keep: number[] = [];

    while (indices.length > 0) {
        const current = indices.shift()!;
        keep.push(current);

        const remaining: number[] = [];
        for (const idx of indices) {
            const iou = calculateIoU(boxes[current], boxes[idx]);
            if (iou < iouThreshold) {
                remaining.push(idx);
            }
        }
        indices.length = 0;
        indices.push(...remaining);
    }

    return {
        boxes: keep.map(i => boxes[i]),
        scores: keep.map(i => scores[i]),
        classIds: keep.map(i => classIds[i]),
    };
}

/**
 * Process YOLO output to get detections
 */
function processYoloOutput(
    output: Float32Array,
    outputShape: number[],
    scale: number,
    padTop: number,
    padLeft: number,
    origWidth: number,
    origHeight: number
): LocalDetection[] {
    // Output shape: [1, 11, 8400] -> [batch, 4+classes, num_detections]
    const numDetections = outputShape[2];
    const numClasses = CARIES_CLASSES.length;

    const boxes: number[][] = [];
    const scores: number[] = [];
    const classIds: number[] = [];

    for (let i = 0; i < numDetections; i++) {
        // Extract box coordinates (xywh)
        const x = output[0 * numDetections + i];
        const y = output[1 * numDetections + i];
        const w = output[2 * numDetections + i];
        const h = output[3 * numDetections + i];

        // Extract class scores
        let maxScore = 0;
        let maxClassId = 0;
        for (let c = 0; c < numClasses; c++) {
            const score = output[(4 + c) * numDetections + i];
            if (score > maxScore) {
                maxScore = score;
                maxClassId = c;
            }
        }

        // Filter by confidence threshold
        if (maxScore >= CONFIDENCE_THRESHOLD) {
            boxes.push([x, y, w, h]);
            scores.push(maxScore);
            classIds.push(maxClassId);
        }
    }

    // Convert to xyxy format
    const boxesXyxy = xywh2xyxy(boxes);

    // Apply NMS
    const nmsResult = nms(boxesXyxy, scores, classIds, IOU_THRESHOLD);

    // Convert to detections with scaled coordinates
    const detections: LocalDetection[] = nmsResult.boxes.map((box, idx) => {
        // Scale coordinates back to original image size
        const x1 = Math.max(0, (box[0] - padLeft) / scale);
        const y1 = Math.max(0, (box[1] - padTop) / scale);
        const x2 = Math.min(origWidth, (box[2] - padLeft) / scale);
        const y2 = Math.min(origHeight, (box[3] - padTop) / scale);

        return {
            bbox: [x1, y1, x2, y2] as [number, number, number, number],
            class: CARIES_CLASSES[nmsResult.classIds[idx]],
            confidence: nmsResult.scores[idx] * 100,
        };
    });

    return detections;
}

/**
 * Run inference on an image
 */
export async function predictLocal(imageUri: string): Promise<LocalPredictionResult> {
    if (!session) {
        const loaded = await loadModel();
        if (!loaded || !session) {
            throw new Error('Failed to load ONNX model');
        }
    }

    console.log('[LocalInference] Starting prediction...');
    const startTime = Date.now();

    try {
        // Preprocess image
        const { tensor, scale, padTop, padLeft, origWidth, origHeight } = await preprocessImage(imageUri);

        // Create input tensor
        const inputTensor = new Tensor('float32', tensor, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);

        // Run inference
        const feeds: Record<string, Tensor> = {};
        feeds[session.inputNames[0]] = inputTensor;

        const results = await session.run(feeds);
        const outputTensor = results[session.outputNames[0]];

        const inferenceTime = Date.now() - startTime;
        console.log(`[LocalInference] Inference completed in ${inferenceTime}ms`);

        // Process output
        const outputData = outputTensor.data as Float32Array;
        const outputShape = outputTensor.dims as number[];

        const detections = processYoloOutput(
            outputData,
            outputShape,
            scale,
            padTop,
            padLeft,
            origWidth,
            origHeight
        );

        console.log(`[LocalInference] Found ${detections.length} detections`);

        // Get best detection
        let predictedClass = 'D0';
        let confidence = 0;
        if (detections.length > 0) {
            const best = detections.reduce((prev, curr) =>
                curr.confidence > prev.confidence ? curr : prev
            );
            predictedClass = best.class;
            confidence = best.confidence;
        }

        // Aggregate probabilities
        const classProbs: Record<string, number> = {};
        CARIES_CLASSES.forEach(cls => (classProbs[cls] = 0));
        detections.forEach(det => {
            if (classProbs[det.class] !== undefined) {
                classProbs[det.class] = Math.max(classProbs[det.class], det.confidence);
            }
        });

        const allProbabilities = CARIES_CLASSES.map(cls => ({
            class: cls,
            probability: classProbs[cls],
        }));

        return {
            class: predictedClass,
            confidence,
            allProbabilities,
            inferenceTime,
            detections,
            boundingBoxes: detections.map(d => d.bbox),
        };
    } catch (error) {
        console.error('[LocalInference] Prediction error:', error);
        throw error;
    }
}

/**
 * Cleanup resources
 */
export async function unloadModel(): Promise<void> {
    if (session) {
        // Note: ONNX Runtime for React Native may not have explicit dispose
        session = null;
        console.log('[LocalInference] Model unloaded');
    }
}
