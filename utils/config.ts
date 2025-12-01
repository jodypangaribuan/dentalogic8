/**
 * Konfigurasi untuk API server
 */

/**
 * Get server URL berdasarkan environment
 * 
 * Untuk development:
 * - iOS Simulator / Android Emulator: gunakan localhost
 * - Device fisik: gunakan IP komputer Anda
 * 
 * Cara mendapatkan IP komputer:
 * - macOS/Linux: ifconfig | grep "inet "
 * - Windows: ipconfig
 */
export const getServerUrl = (): string => {
  // Development mode
  if (__DEV__) {
    // GANTI DENGAN IP KOMPUTER ANDA UNTUK DEVICE FISIK
    // Untuk simulator/emulator, bisa pakai localhost
    return 'http://localhost:8000';
    
    // Contoh untuk device fisik (ganti dengan IP Anda):
    // return 'http://192.168.1.100:8000';
  }
  
  // Production mode - ganti dengan URL server production Anda
  return 'https://your-api-domain.com';
};

/**
 * Timeout untuk API requests (dalam milliseconds)
 */
export const API_TIMEOUT = 30000; // 30 seconds

