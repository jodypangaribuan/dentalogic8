# 🔗 Integrasi dengan Mobile App

Dokumentasi untuk mengintegrasikan server dengan React Native mobile app.

## 📡 Endpoint

**Base URL:** `http://localhost:8000` (development)  
**Production:** Ganti dengan IP/domain server Anda

## 🔌 Cara Menggunakan dari Mobile App

### 1. Install Axios atau Fetch

```bash
npm install axios
```

### 2. Buat Utility Function

Buat file `utils/api.ts`:

```typescript
import axios from 'axios';

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000'  // Development
  : 'http://your-server-ip:8000';  // Production

export async function predictCariesFromServer(imageUri: string) {
  try {
    // Convert image URI to FormData
    const formData = new FormData();
    
    // Get file name from URI
    const filename = imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;
    
    formData.append('file', {
      uri: imageUri,
      name: filename,
      type: type,
    } as any);

    // Make request
    const response = await axios.post(
      `${API_BASE_URL}/predict`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 seconds
      }
    );

    return response.data;
  } catch (error) {
    console.error('Prediction error:', error);
    throw error;
  }
}
```

### 3. Update Home Screen

Update `app/(tabs)/index.tsx`:

```typescript
import { predictCariesFromServer } from '@/utils/api';

// Di dalam handlePredict function:
const handlePredict = async () => {
  if (!selectedImage) return;

  setIsPredicting(true);
  setError(null);
  setStatusMessage('Mengirim gambar ke server...');

  try {
    setStatusMessage('Menjalankan prediksi...');
    
    // Gunakan server API
    const result = await predictCariesFromServer(selectedImage.uri);
    
    // Format result
    const predictionResult: PredictionResult = {
      label: result.class,
      confidence: result.confidence,
      findings: result.allProbabilities
        .filter(p => p.probability > 0.05)
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3)
        .map(p => `${p.class}: ${p.probability.toFixed(1)}%`),
      explanation: `Kelas karies: ${result.class}. Keyakinan: ${result.confidence.toFixed(1)}%`,
      inferenceTime: result.inferenceTime,
    };
    
    setPrediction(predictionResult);
    setStatusMessage('Prediksi selesai');
  } catch (err) {
    console.error('Prediction failed', err);
    setError(err instanceof Error ? err.message : 'Prediksi gagal');
    setPrediction(null);
  } finally {
    setIsPredicting(false);
  }
};
```

## 🌐 Konfigurasi Network

### Development (iOS Simulator / Android Emulator)

```typescript
const API_BASE_URL = 'http://localhost:8000';
```

### Development (Physical Device)

Gunakan IP komputer Anda:

```typescript
// macOS/Linux: ifconfig | grep "inet "
// Windows: ipconfig
const API_BASE_URL = 'http://192.168.1.100:8000';  // Ganti dengan IP Anda
```

### Production

```typescript
const API_BASE_URL = 'https://your-api-domain.com';
```

## 🔒 Security Notes

1. **CORS**: Server sudah dikonfigurasi untuk allow semua origin (development). Untuk production, batasi origin.
2. **HTTPS**: Gunakan HTTPS di production.
3. **Authentication**: Tambahkan authentication jika diperlukan.
4. **Rate Limiting**: Pertimbangkan rate limiting untuk mencegah abuse.

## 🧪 Testing

Test koneksi dari mobile app:

```typescript
// Test health check
const testConnection = async () => {
  try {
    const response = await fetch('http://your-server:8000/health');
    const data = await response.json();
    console.log('Server status:', data);
  } catch (error) {
    console.error('Connection failed:', error);
  }
};
```

## 📝 Error Handling

Handle berbagai error scenarios:

```typescript
try {
  const result = await predictCariesFromServer(imageUri);
  // Handle success
} catch (error) {
  if (error.response) {
    // Server responded with error
    console.error('Server error:', error.response.data);
  } else if (error.request) {
    // Request made but no response
    console.error('Network error:', error.message);
  } else {
    // Something else
    console.error('Error:', error.message);
  }
}
```

