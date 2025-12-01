"""
Script untuk test server API
"""
import requests
import sys
from pathlib import Path

SERVER_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("Testing /health endpoint...")
    try:
        response = requests.get(f"{SERVER_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_predict(image_path: str):
    """Test predict endpoint dengan image"""
    print(f"\nTesting /predict endpoint dengan {image_path}...")
    
    if not Path(image_path).exists():
        print(f"Error: File {image_path} tidak ditemukan")
        return False
    
    try:
        with open(image_path, 'rb') as f:
            files = {'file': (Path(image_path).name, f, 'image/jpeg')}
            response = requests.post(f"{SERVER_URL}/predict", files=files)
        
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"\nHasil Prediksi:")
            print(f"  Class: {result['class']}")
            print(f"  Confidence: {result['confidence']:.2f}%")
            print(f"  Inference Time: {result['inferenceTime']} ms")
            print(f"\n  Semua Probabilities:")
            for prob in result['allProbabilities']:
                print(f"    {prob['class']}: {prob['probability']:.2f}%")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Dentalogic8 Server API\n")
    
    # Test health
    if not test_health():
        print("\n❌ Health check failed. Pastikan server berjalan!")
        sys.exit(1)
    
    # Test predict jika image path diberikan
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if test_predict(image_path):
            print("\n✅ Test berhasil!")
        else:
            print("\n❌ Test gagal!")
            sys.exit(1)
    else:
        print("\n💡 Untuk test predict, jalankan:")
        print(f"   python test_server.py <path_to_image>")
        print("\n✅ Health check berhasil!")

