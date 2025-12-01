# 🚀 Setup Server untuk Mobile App

Panduan lengkap untuk setup dan menjalankan server Python untuk mobile app.

## 📋 Prerequisites

1. Python 3.8 atau lebih baru
2. pip (Python package manager)

## 🔧 Setup Server

### 1. Install Dependencies

```bash
cd server
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# atau venv\Scripts\activate  # Windows

pip install -r requirements.txt
```

### 2. Jalankan Server

```bash
# Dari folder server
python server.py
```

Server akan berjalan di: `http://localhost:8000`

### 3. Test Server

Buka browser dan akses:
- Health check: `http://localhost:8000/health`
- API Docs: `http://localhost:8000/docs`

## 📱 Konfigurasi Mobile App

### Untuk iOS Simulator / Android Emulator

Server URL sudah dikonfigurasi ke `http://localhost:8000` di `utils/config.ts`.

Tidak perlu perubahan, langsung bisa digunakan.

### Untuk Device Fisik

1. **Dapatkan IP komputer Anda:**

   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

   Contoh output: `inet 192.168.1.100`

2. **Update konfigurasi di mobile app:**

   Edit file `utils/config.ts`:

   ```typescript
   export const getServerUrl = (): string => {
     if (__DEV__) {
       // Ganti dengan IP komputer Anda
       return 'http://192.168.1.100:8000';  // ← GANTI INI
     }
     return 'https://your-api-domain.com';
   };
   ```

3. **Pastikan firewall tidak memblokir port 8000:**

   ```bash
   # macOS - Allow incoming connections
   # System Preferences > Security & Privacy > Firewall > Firewall Options
   ```

## 🧪 Testing

### Test dari Terminal

```bash
# Health check
curl http://localhost:8000/health

# Test dengan gambar
cd server
python test_server.py /path/to/image.jpg
```

### Test dari Mobile App

1. Jalankan server Python
2. Jalankan mobile app
3. Upload gambar intraoral
4. Klik "Prediksi Karies"
5. Lihat hasil prediksi

## 🔍 Troubleshooting

### Error: "Tidak dapat terhubung ke server"

**Kemungkinan penyebab:**
1. Server tidak berjalan
2. IP address salah (untuk device fisik)
3. Firewall memblokir port 8000
4. Server dan device tidak dalam network yang sama

**Solusi:**
1. Pastikan server berjalan: `curl http://localhost:8000/health`
2. Cek IP address di `utils/config.ts`
3. Pastikan firewall allow port 8000
4. Pastikan device dan komputer dalam WiFi yang sama

### Error: "Model file not found"

**Solusi:**
1. Pastikan file `model/best.onnx` ada
2. Cek path di `server/server.py`: `MODEL_PATH`

### Error: "Server error: 500"

**Solusi:**
1. Cek log server untuk detail error
2. Pastikan model file valid
3. Pastikan gambar format yang diupload valid (JPEG, PNG)

## 📝 Catatan Penting

1. **Development**: Server harus berjalan saat testing mobile app
2. **Network**: Device fisik dan komputer harus dalam network yang sama
3. **Port**: Default port 8000, bisa diubah di `server/server.py`
4. **Model**: Model akan di-load saat server start

## 🚀 Production

Untuk production, deploy server ke cloud (AWS, GCP, Azure, dll) dan update URL di `utils/config.ts`.

