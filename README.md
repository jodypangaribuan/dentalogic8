# 🦷 Dentalogic8

Aplikasi mobile untuk deteksi karies gigi menggunakan AI dengan ONNX inference engine.

## 📋 Deskripsi

Dentalogic8 adalah aplikasi React Native yang memungkinkan pengguna untuk:
- Upload foto intraoral gigi
- Menjalankan analisis AI untuk deteksi karies secara lokal di perangkat
- Melihat hasil prediksi dengan tingkat keyakinan
- Menyimpan riwayat pemeriksaan

## 🏗️ Arsitektur

```
┌─────────────────────────────┐
│     Mobile App              │
│  (React Native + Expo)      │
│                             │
│  ┌───────────────────────┐  │
│  │   ONNX Runtime        │  │
│  │   (Local Inference)   │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

- **Frontend**: React Native + Expo
- **Inference Engine**: ONNX Runtime (React Native)
- **Model**: ONNX format (.onnx)

## 🚀 Quick Start

### Setup Mobile App

```bash
# Install dependencies
npm install

# Start Expo
npx expo start
```

## 📁 Struktur Project

```
dentalogic8/
├── app/                      # React Native screens
│   ├── (tabs)/
│   │   ├── index.tsx        # Home screen (upload & predict)
│   │   ├── history.tsx      # History screen
│   │   └── scan.tsx         # Scan screen
│   └── _layout.tsx
├── components/               # Reusable components
├── constants/               # Theme & constants
├── utils/                   # Utility functions
│   ├── onnx-model.ts        # ONNX model inference
│   └── image-processor.ts   # Image preprocessing
├── model/                   # Model files
│   └── best.onnx            # ONNX model
├── package.json
└── README.md                # This file
```

## 🔧 Development

### Mobile App

```bash
# Start development server
npx expo start

# Run on iOS
npx expo start --ios

# Run on Android
npx expo start --android

# Clear cache
npx expo start --clear
```

## 📦 Model Setup

Model ONNX sudah tersedia di folder `model/best.onnx`. Model ini akan dimuat secara otomatis saat aplikasi berjalan.

Jika Anda ingin menggunakan model ONNX yang berbeda:
1. Ganti file `model/best.onnx` dengan model Anda
2. Pastikan model memiliki format input yang sesuai (640x640 RGB image)
3. Restart aplikasi

## 🧪 Testing

### Test Mobile App

1. Jalankan Expo app
2. Upload gambar dental dari galeri atau ambil foto dengan kamera
3. Klik "Prediksi Karies"
4. Lihat hasil prediksi dengan tingkat keyakinan

## 🛠️ Tech Stack

### Mobile App
- React Native 0.81
- Expo SDK 54
- TypeScript
- React Navigation
- Expo Image Picker
- Expo Camera
- ONNX Runtime React Native

## 🔍 Troubleshooting

### Model tidak ditemukan

1. Pastikan file `model/best.onnx` ada di folder `model/`
2. Cek path di `utils/onnx-model.ts`
3. Restart aplikasi setelah menambahkan model baru

### Prediksi gagal

1. Pastikan gambar yang diunggah adalah format yang didukung (JPG, PNG)
2. Cek konsol untuk error messages
3. Pastikan model ONNX kompatibel dengan versi ONNX Runtime yang digunakan

## 📄 License

Private project - Dentalogic8 Team

## 👥 Team

Dentalogic8 Development Team

## 📞 Support

Untuk bantuan lebih lanjut, hubungi tim development.
