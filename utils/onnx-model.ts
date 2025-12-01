import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Asset } from 'expo-asset';

// Caries classes: D0, D1, D2, D3, D4, D5, D6
export const CARIES_CLASSES = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

// Model input size (common for YOLO models)
const MODEL_INPUT_SIZE = 640;

let modelSession: any = null;
let modelLoading = false;
let onnxRuntime: any = null;
let tfInitialized = false;

/**
 * Dynamically load ONNX Runtime React Native
 * This prevents crashes in Expo Go where native modules aren't available
 */
async function loadONNXRuntime() {
  if (onnxRuntime) {
    return onnxRuntime;
  }

  try {
    onnxRuntime = await import('onnxruntime-react-native');
    return onnxRuntime;
  } catch (error) {
    throw new Error(
      'ONNX Runtime tidak tersedia. Aplikasi memerlukan development build (bukan Expo Go). ' +
      'Jalankan: npx expo run:ios atau npx expo run:android'
    );
  }
}

/**
 * Initialize TensorFlow.js (optional, for image preprocessing)
 */
async function initializeTF() {
  if (tfInitialized) return;
  
  try {
    const tf = await import('@tensorflow/tfjs');
    await import('@tensorflow/tfjs-react-native');
    await tf.default.ready();
    tfInitialized = true;
  } catch (error) {
    console.warn('TensorFlow.js tidak tersedia, menggunakan metode alternatif untuk preprocessing');
    // Continue without TensorFlow.js
  }
}

/**
 * Load the ONNX model from assets
 */
export async function loadModel(): Promise<any> {
  if (modelSession) {
    return modelSession;
  }

  if (modelLoading) {
    // Wait for ongoing load
    while (modelLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (modelSession) return modelSession;
  }

  modelLoading = true;
  try {
    // Load ONNX Runtime dynamically
    const ort = await loadONNXRuntime();
    const { InferenceSession } = ort;
    
    // Load model from file system
    // Try multiple paths to find the model
    let modelUri: string | null = null;
    
    // Path 1: Try using Asset (if model is bundled)
    try {
      const modelAsset = Asset.fromModule(require('../../model/best.onnx'));
      await modelAsset.downloadAsync();
      if (modelAsset.localUri) {
        modelUri = modelAsset.localUri;
      }
    } catch (assetError) {
      console.log('Asset loading failed, trying direct path...');
    }
    
    // Path 2: Try direct file path (for development)
    if (!modelUri) {
      const possiblePaths = [
        `${FileSystem.bundleDirectory}model/best.onnx`,
        `${FileSystem.documentDirectory}../model/best.onnx`,
        `./model/best.onnx`,
      ];
      
      for (const path of possiblePaths) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(path);
          if (fileInfo.exists) {
            modelUri = path;
            break;
          }
        } catch (e) {
          // Continue to next path
        }
      }
    }
    
    if (!modelUri) {
      throw new Error('Model file not found. Make sure best.onnx is accessible.');
    }

    // Create inference session
    modelSession = await InferenceSession.create(modelUri, {
      executionProviders: ['cpu'], // Use CPU execution provider
      graphOptimizationLevel: 'all',
    });

    console.log('ONNX model loaded successfully');
    return modelSession;
  } catch (error) {
    console.error('Failed to load ONNX model:', error);
    throw error;
  } finally {
    modelLoading = false;
  }
}

/**
 * Preprocess image for ONNX model input
 * - Resize to model input size (640x640)
 * - Normalize pixel values to [0, 1]
 * - Convert to RGB format
 * - Convert to tensor format [1, 3, 640, 640]
 */
async function preprocessImage(imageUri: string): Promise<Float32Array> {
  try {
    // First, resize image using ImageManipulator
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
      { compress: 1, format: ImageManipulator.SaveFormat.PNG }
    );
    
    // Use expo-gl or alternative method to extract pixel data
    // For now, we'll use a simplified approach
    const imageData = await processImageData(resized.uri);
    
    return imageData;
  } catch (error) {
    console.error('Image preprocessing error:', error);
    throw new Error(`Failed to preprocess image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process image data to get pixel values
 * This is a simplified version - in production, use expo-gl or native decoder
 */
async function processImageData(imageUri: string): Promise<Float32Array> {
  try {
    // Read image file
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const imageBytes = new Uint8Array(arrayBuffer);
    
    // Create tensor: [1, 3, height, width]
    const tensor = new Float32Array(1 * 3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
    
    // TODO: Implement proper PNG/JPEG decoding
    // For now, this is a placeholder that needs proper implementation
    // In production, use expo-gl to render image and read pixels,
    // or use a native image decoder module
    
    // Placeholder: Fill with normalized values
    // This needs to be replaced with actual pixel data from decoded image
    for (let i = 0; i < tensor.length; i++) {
      tensor[i] = 0.5; // Placeholder - replace with actual pixel data
    }
    
    return tensor;
  } catch (error) {
    console.error('Error processing image data:', error);
    throw error;
  }
}

/**
 * Run inference on preprocessed image
 */
export async function predictCaries(imageUri: string): Promise<{
  class: string;
  confidence: number;
  allProbabilities: { class: string; probability: number }[];
  inferenceTime: number;
}> {
  const startTime = Date.now();

  try {
    // Load ONNX Runtime
    const ort = await loadONNXRuntime();
    const { Tensor } = ort;
    
    // Load model if not already loaded
    const session = await loadModel();

    // Get model input name and shape
    const inputName = session.inputNames[0];
    const inputShape = session.inputDims[0];

    // Preprocess image
    const imageTensor = await preprocessImage(imageUri);

    // Create ONNX tensor
    const tensor = new Tensor('float32', imageTensor, inputShape);

    // Run inference
    const results = await session.run({ [inputName]: tensor });

    // Get output
    const outputName = session.outputNames[0];
    const output = results[outputName];

    // Extract predictions
    const outputData = output.data as Float32Array;
    
    // Handle different output formats:
    // - If output is [1, 7] (batch, classes): take first batch
    // - If output is [7]: use directly
    // - If output is [1, num_detections, 7]: handle YOLO format
    let predictions: Float32Array;
    
    if (output.dims.length === 2 && output.dims[0] === 1) {
      // Shape: [1, 7]
      predictions = outputData;
    } else if (output.dims.length === 1) {
      // Shape: [7]
      predictions = outputData;
    } else if (output.dims.length === 3) {
      // Shape: [1, num_detections, 7] - YOLO format
      // Take the detection with highest confidence
      const numDetections = output.dims[1];
      const numClasses = output.dims[2];
      let maxConf = -1;
      let bestDetection = 0;
      
      for (let i = 0; i < numDetections; i++) {
        const conf = outputData[i * numClasses + 4]; // confidence score at index 4
        if (conf > maxConf) {
          maxConf = conf;
          bestDetection = i;
        }
      }
      
      // Extract class probabilities from best detection
      const startIdx = bestDetection * numClasses;
      predictions = outputData.slice(startIdx, startIdx + numClasses);
    } else {
      // Flatten and take first 7 values
      predictions = outputData.slice(0, 7);
    }

    // Apply softmax if needed (if predictions are logits)
    const probabilities = softmax(Array.from(predictions));

    // Find predicted class
    let maxProb = -1;
    let predictedClassIdx = 0;
    for (let i = 0; i < probabilities.length; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        predictedClassIdx = i;
      }
    }

    // Create result
    const allProbabilities = CARIES_CLASSES.map((className, idx) => ({
      class: className,
      probability: probabilities[idx] || 0,
    }));

    const inferenceTime = Date.now() - startTime;

    return {
      class: CARIES_CLASSES[predictedClassIdx],
      confidence: maxProb * 100,
      allProbabilities,
      inferenceTime,
    };
  } catch (error) {
    console.error('Prediction error:', error);
    throw error;
  }
}

/**
 * Apply softmax to logits
 */
function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const expLogits = logits.map((x) => Math.exp(x - maxLogit));
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  return expLogits.map((x) => x / sumExp);
}
