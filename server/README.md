# 🦷 Dentalogic8 Server

Server Python untuk deteksi karies gigi menggunakan model ONNX.

## 📋 Deskripsi

Server ini menggunakan FastAPI untuk menerima upload gambar intraoral dan menjalankan prediksi menggunakan model ONNX (`best.onnx`). Server akan memproses gambar, menjalankan inference, dan mengembalikan hasil prediksi dengan tingkat keyakinan.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd server
pip install -r requirements.txt
```

Atau menggunakan virtual environment (disarankan):

```bash
# Buat virtual environment
python3 -m venv venv

# Aktifkan virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Pastikan Model File Tersedia

Pastikan file `model/best.onnx` ada di folder root project:
```
dentalogic8/
├── model/
│   └── best.onnx
└── server/
    └── server.py
```

### 3. Jalankan Server

```bash
# Dari folder server
python server.py

# Atau menggunakan uvicorn langsung
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Server akan berjalan di: `http://localhost:8000`

## 📡 API Endpoints

### 1. Health Check

**GET** `/health`

Response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_path": "/path/to/model/best.onnx"
}
```

### 2. Root

**GET** `/`

Response:
```json
{
  "status": "ok",
  "message": "Dentalogic8 API Server",
  "model_loaded": true
}
```

### 3. Predict (Upload Image)

**POST** `/predict`

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: File (image)

**Response:**
```json
{
  "class": "D0",
  "confidence": 95.5,
  "allProbabilities": [
    {"class": "D0", "probability": 95.5},
    {"class": "D1", "probability": 3.2},
    {"class": "D2", "probability": 1.0},
    {"class": "D3", "probability": 0.2},
    {"class": "D4", "probability": 0.1},
    {"class": "D5", "probability": 0.0},
    {"class": "D6", "probability": 0.0}
  ],
  "inferenceTime": 123.45
}
```

## 🧪 Testing

### Test dengan curl

```bash
# Health check
curl http://localhost:8000/health

# Test prediction
curl -X POST "http://localhost:8000/predict" \
  -F "file=@/path/to/dental-image.jpg"
```

### Test dengan Python

```python
import requests

# Upload image
with open('test_image.jpg', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/predict',
        files={'file': f}
    )
    print(response.json())
```

### Interactive API Docs

Buka browser dan akses:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🔧 Konfigurasi

### Model Path

Default model path: `../model/best.onnx` (relative dari folder server)

Untuk mengubah path, edit `MODEL_PATH` di `server.py`:

```python
MODEL_PATH = Path(__file__).parent.parent / "model" / "best.onnx"
```

### Port

Default port: `8000`

Untuk mengubah port, edit di `server.py`:

```python
uvicorn.run(
    "server:app",
    host="0.0.0.0",
    port=8000,  # Ubah port di sini
    reload=True
)
```

## 📦 Dependencies

- **fastapi**: Web framework untuk API
- **uvicorn**: ASGI server
- **python-multipart**: Untuk handle file upload
- **pillow**: Image processing
- **numpy**: Array operations
- **onnxruntime**: ONNX model inference

## 🔍 Troubleshooting

### Model tidak ditemukan

1. Pastikan file `best.onnx` ada di folder `model/`
2. Cek path di `server.py`: `MODEL_PATH`
3. Pastikan path relatif benar dari folder server

### Import error

```bash
pip install -r requirements.txt
```

### Port sudah digunakan

Ubah port di `server.py` atau kill process yang menggunakan port 8000:

```bash
# macOS/Linux
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### CORS Error

Jika ada CORS error dari mobile app, pastikan:
1. Server berjalan di `0.0.0.0` (bukan `localhost`)
2. Mobile app menggunakan IP komputer yang benar
3. Firewall tidak memblokir port 8000

## 📝 Catatan

- Model akan di-load saat server startup
- Server menggunakan CPU execution provider (bisa diubah ke GPU jika tersedia)
- Image preprocessing: resize ke 640x640, normalize ke [0,1], format CHW
- Output classes: D0, D1, D2, D3, D4, D5, D6

## 📄 License

Private project - Dentalogic8 Team

