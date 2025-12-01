/**
 * API utility untuk komunikasi dengan Python server
 */
import { getServerUrl } from './config';

const API_BASE_URL = getServerUrl();

export interface Detection {
  bbox: [number, number, number, number];
  class: string;
  confidence: number;
}

export interface PredictionResponse {
  class: string;
  confidence: number;
  allProbabilities: Array<{
    class: string;
    probability: number;
  }>;
  inferenceTime: number;
  detections?: Detection[];
  boundingBoxes?: number[][];
  annotatedImage?: string; // Base64 encoded image with bounding boxes
}

/**
 * Convert image URI ke FormData untuk upload
 * React Native FormData memerlukan format khusus dengan URI
 */
function createFormData(uri: string, name?: string): FormData {
  const formData = new FormData();
  
  // Tentukan MIME type berdasarkan extension
  const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = 
    extension === 'png' ? 'image/png' :
    extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' :
    'image/jpeg';
  
  // Untuk React Native, FormData memerlukan object dengan uri, type, dan name
  // @ts-ignore - React Native FormData format khusus
  formData.append('file', {
    uri: uri,
    type: mimeType,
    name: name || `dental-image.${extension}`,
  } as any);
  
  return formData;
}

/**
 * Check server health
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      timeout: 5000,
    } as RequestInit);
    
    if (response.ok) {
      const data = await response.json();
      return data.status === 'healthy' && data.model_loaded === true;
    }
    return false;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

/**
 * Predict caries dari image menggunakan server API
 */
export async function predictCariesFromServer(
  imageUri: string
): Promise<PredictionResponse> {
  try {
    // Buat FormData
    const formData = createFormData(imageUri);
    
    // Buat request
    // Note: Jangan set Content-Type header, biarkan fetch set otomatis dengan boundary
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      body: formData,
      // Jangan set Content-Type header - fetch akan set otomatis dengan boundary
    });
    
    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch {
        // Jika response bukan JSON, gunakan status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    const result: PredictionResponse = await response.json();
    return result;
  } catch (error) {
    console.error('API Error:', error);
    
    // Handle network errors
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Network')) {
        throw new Error(
          'Tidak dapat terhubung ke server. ' +
          'Pastikan server Python berjalan di ' + API_BASE_URL + 
          '\n\nUntuk device fisik, ganti localhost dengan IP komputer Anda.'
        );
      }
    }
    
    throw error instanceof Error 
      ? error 
      : new Error('Gagal menjalankan prediksi');
  }
}

/**
 * Get server URL (untuk debugging)
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

