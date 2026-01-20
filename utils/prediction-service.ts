/**
 * Unified prediction service that supports local (offline) and API-based inference
 * Using ONNX Runtime for local inference
 */

import { checkServerHealth, predictCariesFromServer } from './api';
import { isModelLoaded, loadModel, predictLocal } from './local-inference';

export type InferenceMode = 'local' | 'api' | 'auto';

// Current mode setting
let currentMode: InferenceMode = 'local';

/**
 * Set the inference mode
 * - 'local': Always use on-device inference (offline)
 * - 'api': Always use server API
 * - 'auto': Try local first, fallback to API
 */
export function setInferenceMode(mode: InferenceMode): void {
    currentMode = mode;
    console.log(`[Prediction] Inference mode set to: ${mode}`);
}

/**
 * Get current inference mode
 */
export function getInferenceMode(): InferenceMode {
    return currentMode;
}

/**
 * Initialize local model (call this at app startup for faster first prediction)
 */
export async function initializeLocalModel(): Promise<boolean> {
    console.log('[Prediction] Initializing local ONNX model...');
    try {
        const success = await loadModel();
        if (success) {
            console.log('[Prediction] Local ONNX model ready');
        } else {
            console.warn('[Prediction] Failed to initialize local model');
        }
        return success;
    } catch (error) {
        console.error('[Prediction] Error initializing local model:', error);
        return false;
    }
}

/**
 * Check if local inference is available
 */
export function isLocalInferenceAvailable(): boolean {
    return isModelLoaded();
}

/**
 * Unified prediction result interface
 */
export interface PredictionResult {
    class: string;
    confidence: number;
    allProbabilities: Array<{
        class: string;
        probability: number;
    }>;
    inferenceTime: number;
    detections?: Array<{
        bbox: [number, number, number, number];
        class: string;
        confidence: number;
    }>;
    boundingBoxes?: number[][];
    annotatedImage?: string;
    source: 'local' | 'api';
}

/**
 * Run prediction using the configured mode
 */
export async function predict(imageUri: string): Promise<PredictionResult> {
    console.log(`[Prediction] Running prediction in '${currentMode}' mode`);

    switch (currentMode) {
        case 'local':
            return predictWithLocal(imageUri);

        case 'api':
            return predictWithApi(imageUri);

        case 'auto':
        default:
            return predictWithAuto(imageUri);
    }
}

/**
 * Run prediction using local ONNX model
 */
async function predictWithLocal(imageUri: string): Promise<PredictionResult> {
    try {
        console.log('[Prediction] Using ONNX...');
        const result = await predictLocal(imageUri);

        return {
            ...result,
            source: 'local',
        };
    } catch (error) {
        console.error('[Prediction] Local inference failed:', error);
        throw new Error(`Local inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Run prediction using server API
 */
async function predictWithApi(imageUri: string): Promise<PredictionResult> {
    try {
        const result = await predictCariesFromServer(imageUri);
        return {
            class: result.class,
            confidence: result.confidence,
            allProbabilities: result.allProbabilities,
            inferenceTime: result.inferenceTime,
            detections: result.detections,
            boundingBoxes: result.boundingBoxes,
            annotatedImage: result.annotatedImage,
            source: 'api',
        };
    } catch (error) {
        console.error('[Prediction] API inference failed:', error);
        throw error;
    }
}

/**
 * Run prediction with auto mode (local first, fallback to API)
 */
async function predictWithAuto(imageUri: string): Promise<PredictionResult> {
    // Try local first
    try {
        if (isModelLoaded()) {
            console.log('[Prediction] Trying local inference...');
            return await predictWithLocal(imageUri);
        }
    } catch (localError) {
        console.warn('[Prediction] Local inference failed, trying API...', localError);
    }

    // Fallback to API
    try {
        console.log('[Prediction] Falling back to API...');
        const isServerHealthy = await checkServerHealth();
        if (!isServerHealthy) {
            throw new Error('Server is not available');
        }
        const result = await predictCariesFromServer(imageUri);
        return {
            class: result.class,
            confidence: result.confidence,
            allProbabilities: result.allProbabilities,
            inferenceTime: result.inferenceTime,
            detections: result.detections,
            boundingBoxes: result.boundingBoxes,
            annotatedImage: result.annotatedImage,
            source: 'api',
        };
    } catch (apiError) {
        console.error('[Prediction] Both local and API inference failed');
        throw new Error('Prediction failed: No inference method available');
    }
}
