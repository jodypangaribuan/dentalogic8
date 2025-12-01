"""
FastAPI Server untuk Deteksi Karies Gigi menggunakan YOLO Model (.pt)
"""
import os
import time
import numpy as np
from pathlib import Path
from typing import List, Dict
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageDraw, ImageFont
import io
import uvicorn
import base64
from ultralytics import YOLO

# Inisialisasi FastAPI app
app = FastAPI(
    title="Dentalogic8 API",
    description="API untuk deteksi karies gigi menggunakan model ONNX",
    version="1.0.0"
)

# CORS middleware untuk allow request dari mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dalam production, ganti dengan domain spesifik
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Konfigurasi
MODEL_PATH = Path(__file__).parent.parent / "model" / "best.pt"
MODEL_INPUT_SIZE = 640
CARIES_CLASSES = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']

# Global variables untuk model
yolo_model = None
model_loaded = False


def load_model():
    """Load YOLO model (.pt) ke memory menggunakan Ultralytics"""
    global yolo_model, model_loaded
    
    if model_loaded and yolo_model is not None:
        return yolo_model
    
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
    
    try:
        # Load YOLO model menggunakan Ultralytics
        yolo_model = YOLO(str(MODEL_PATH))
        model_loaded = True
        print(f"YOLO model loaded successfully from {MODEL_PATH}")
        
        # Print model info
        print(f"Model classes: {yolo_model.names}")
        print(f"Model input size: {MODEL_INPUT_SIZE}")
        
        return yolo_model
    except Exception as e:
        raise RuntimeError(f"Failed to load YOLO model: {str(e)}")


def preprocess_image(image: Image.Image) -> np.ndarray:
    """
    Preprocess image untuk model ONNX
    - Resize ke 640x640
    - Convert ke RGB
    - Normalize pixel values ke [0, 1]
    - Convert ke format CHW [1, 3, 640, 640]
    """
    # Convert ke RGB jika perlu
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Resize ke 640x640 dengan antialiasing
    image = image.resize((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), Image.Resampling.LANCZOS)
    
    # Convert ke numpy array
    img_array = np.array(image, dtype=np.float32)
    
    # Normalize ke [0, 1]
    img_array = img_array / 255.0
    
    # Convert dari HWC ke CHW format
    # Original: (640, 640, 3) -> Target: (3, 640, 640)
    img_array = np.transpose(img_array, (2, 0, 1))
    
    # Add batch dimension: (3, 640, 640) -> (1, 3, 640, 640)
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array


def softmax(logits: np.ndarray) -> np.ndarray:
    """Apply softmax function untuk convert logits ke probabilities"""
    exp_logits = np.exp(logits - np.max(logits))
    return exp_logits / np.sum(exp_logits)


def draw_bounding_boxes(image: Image.Image, detections: List[Dict], line_width: int = 3) -> Image.Image:
    """
    Draw bounding boxes and labels on image
    
    Args:
        image: PIL Image
        detections: List of detection dicts with 'bbox', 'class', 'confidence'
        line_width: Width of bounding box lines
    
    Returns:
        PIL Image with bounding boxes drawn
    """
    # Create a copy of the image to draw on
    img_with_boxes = image.copy()
    draw = ImageDraw.Draw(img_with_boxes)
    
    # Color map for different classes
    colors = {
        'D0': (0, 255, 0),      # Green
        'D1': (255, 255, 0),     # Yellow
        'D2': (255, 165, 0),     # Orange
        'D3': (255, 0, 0),       # Red
        'D4': (255, 0, 255),     # Magenta
        'D5': (128, 0, 128),     # Purple
        'D6': (0, 0, 255),       # Blue
    }
    
    # Try to load a font, fallback to default if not available
    # Increased font size for better readability on mobile
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
    except:
        try:
            # Try alternative font paths for different systems
            font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 40)
            font_small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 28)
        except:
            try:
                font = ImageFont.load_default()
                font_small = ImageFont.load_default()
            except:
                font = None
                font_small = None
    
    for det in detections:
        bbox = det['bbox']
        x1, y1, x2, y2 = bbox[0], bbox[1], bbox[2], bbox[3]
        cls = det['class']
        conf = det['confidence']
        
        # Get color for this class
        color = colors.get(cls, (255, 255, 255))
        
        # Draw bounding box
        draw.rectangle([x1, y1, x2, y2], outline=color, width=line_width)
        
        # Prepare label text
        label = f"{cls} {conf:.1f}%"
        
        # Calculate text size
        if font:
            bbox_text = draw.textbbox((0, 0), label, font=font)
            text_width = bbox_text[2] - bbox_text[0]
            text_height = bbox_text[3] - bbox_text[1]
        else:
            text_width = len(label) * 6
            text_height = 12
        
        # Draw background for text (increased padding for larger font)
        text_bg = [x1, y1 - text_height - 12, x1 + text_width + 12, y1]
        draw.rectangle(text_bg, fill=color)
        
        # Draw text (increased padding for larger font)
        draw.text((x1 + 6, y1 - text_height - 6), label, fill=(0, 0, 0), font=font)
    
    return img_with_boxes


def to_native_type(value):
    """Convert numpy types to native Python types for JSON serialization"""
    # Handle numpy scalar types
    if hasattr(value, 'item'):  # numpy scalar types have .item() method
        try:
            return value.item()
        except (ValueError, AttributeError):
            pass
    
    # Check for numpy integer types
    if isinstance(value, (np.integer, np.int_, np.intc, np.intp, np.int8,
                          np.int16, np.int32, np.int64, np.uint8, np.uint16,
                          np.uint32, np.uint64)):
        return int(value)
    # Check for numpy floating types (removed np.float_ for NumPy 2.0 compatibility)
    elif isinstance(value, (np.floating, np.float16, np.float32, np.float64)):
        return float(value)
    elif isinstance(value, np.ndarray):
        return [to_native_type(v) for v in value]
    elif isinstance(value, (list, tuple)):
        return [to_native_type(v) for v in value]
    elif isinstance(value, dict):
        return {k: to_native_type(v) for k, v in value.items()}
    else:
        return value


def non_max_suppression(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float = 0.5) -> np.ndarray:
    """
    Non-Maximum Suppression untuk filter overlapping bounding boxes
    
    Args:
        boxes: Array of shape [N, 4] dengan format [x1, y1, x2, y2]
        scores: Array of shape [N] dengan confidence scores
        iou_threshold: IoU threshold untuk NMS
    
    Returns:
        Indices of boxes to keep
    """
    if len(boxes) == 0:
        return np.array([], dtype=np.int32)
    
    # Extract coordinates
    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]
    
    # Calculate areas
    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    
    # Sort by score (descending)
    order = scores.argsort()[::-1]
    
    keep = []
    while len(order) > 0:
        # Take the box with highest score
        i = order[0]
        keep.append(i)
        
        if len(order) == 1:
            break
        
        # Calculate IoU with remaining boxes
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        
        w = np.maximum(0, xx2 - xx1 + 1)
        h = np.maximum(0, yy2 - yy1 + 1)
        intersection = w * h
        
        iou = intersection / (areas[i] + areas[order[1:]] - intersection)
        
        # Keep boxes with IoU < threshold
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]
    
    return np.array(keep, dtype=np.int32)


def predict_caries(original_image: Image.Image) -> Dict:
    """
    Run inference pada image menggunakan YOLO model (.pt)
    Returns: Dictionary dengan hasil prediksi termasuk bounding boxes
    """
    global yolo_model
    
    try:
        if yolo_model is None:
            yolo_model = load_model()
        
        # Get original image size
        orig_width, orig_height = original_image.size
        
        # Run inference dengan YOLO
        start_time = time.time()
        results = yolo_model.predict(
            source=original_image,
            conf=0.25,  # Confidence threshold
            iou=0.5,   # IoU threshold for NMS
            verbose=False
        )
        inference_time = (time.time() - start_time) * 1000  # Convert ke milliseconds
        
        # Process results
        if not results or len(results) == 0:
            return {
                "class": "D0",
                "confidence": 0.0,
                "allProbabilities": [
                    {"class": cls, "probability": 0.0} for cls in CARIES_CLASSES
                ],
                "inferenceTime": round(inference_time, 2),
                "detections": [],
                "boundingBoxes": []
            }
        
        # Get first result (single image)
        result = results[0]
        
        # Extract detections
        detections = []
        filtered_boxes = []
        
        if result.boxes is not None and len(result.boxes) > 0:
            print(f"Found {len(result.boxes)} detections")
            
            for box in result.boxes:
                # Get bounding box coordinates (already in pixel coordinates)
                bbox = box.xyxy[0].cpu().numpy()  # [x1, y1, x2, y2]
                x1, y1, x2, y2 = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
                
                # Get class ID and confidence
                cls_id = int(box.cls[0].cpu().numpy())
                conf = float(box.conf[0].cpu().numpy())
                
                # Map class ID to class name
                # YOLO model class names are in result.names
                if cls_id in result.names:
                    class_name = result.names[cls_id]
                else:
                    # Fallback: use class index if not in names
                    if cls_id < len(CARIES_CLASSES):
                        class_name = CARIES_CLASSES[cls_id]
                    else:
                        class_name = "D0"
                
                # Ensure class_name is in our CARIES_CLASSES
                if class_name not in CARIES_CLASSES:
                    # Try to map it
                    if class_name.startswith('D') and len(class_name) == 2:
                        # Already in D0-D6 format
                        pass
                    else:
                        # Use class index as fallback
                        if cls_id < len(CARIES_CLASSES):
                            class_name = CARIES_CLASSES[cls_id]
                        else:
                            class_name = "D0"
                
                detections.append({
                    "bbox": [x1, y1, x2, y2],
                    "class": class_name,
                    "confidence": conf * 100
                })
                
                filtered_boxes.append([x1, y1, x2, y2])
                
                print(f"Detection: {class_name} ({conf:.3f}) at [{x1:.1f}, {y1:.1f}, {x2:.1f}, {y2:.1f}]")
        
        # Get best detection for main result
        if len(detections) > 0:
            best_detection = max(detections, key=lambda x: x['confidence'])
            predicted_class = best_detection['class']
            confidence = float(best_detection['confidence'])
        else:
            predicted_class = "D0"
            confidence = 0.0
            print("No detections found")
        
        # Create all probabilities (aggregate from all detections)
        class_probs = {cls: 0.0 for cls in CARIES_CLASSES}
        for det in detections:
            cls = det['class']
            conf = det['confidence'] / 100.0
            if cls in class_probs:
                class_probs[cls] = max(class_probs[cls], conf)
        
        all_probabilities = [
            {
                "class": cls,
                "probability": float(class_probs[cls] * 100)
            }
            for cls in CARIES_CLASSES
        ]
        
        # Ensure all values are JSON serializable (native Python types)
        result_dict = {
            "class": str(predicted_class),
            "confidence": float(confidence),
            "allProbabilities": all_probabilities,
            "inferenceTime": float(round(inference_time, 2)),
            "detections": detections,
            "boundingBoxes": filtered_boxes
        }
        
        # Final pass to ensure all numpy types are converted
        return to_native_type(result_dict)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise ValueError(f"Error processing YOLO prediction: {str(e)}")


@app.on_event("startup")
async def startup_event():
    """Load model saat server startup"""
    try:
        load_model()
        print("Server started successfully")
    except Exception as e:
        print(f"Warning: Failed to load model at startup: {e}")
        print("Model will be loaded on first request")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "Dentalogic8 API Server",
        "model_loaded": model_loaded
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model_loaded,
        "model_path": str(MODEL_PATH) if MODEL_PATH.exists() else None
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Endpoint untuk prediksi karies dari uploaded image dengan YOLO object detection
    
    Args:
        file: Image file (JPEG, PNG, dll)
    
    Returns:
        JSON dengan hasil prediksi termasuk bounding boxes:
        {
            "class": "D0",
            "confidence": 95.5,
            "allProbabilities": [...],
            "inferenceTime": 123.45,
            "detections": [
                {
                    "bbox": [x1, y1, x2, y2],
                    "class": "D0",
                    "confidence": 95.5
                }
            ],
            "boundingBoxes": [[x1, y1, x2, y2], ...]
        }
    """
    try:
        # Validasi file
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail="File harus berupa gambar (JPEG, PNG, dll)"
            )
        
        # Read image data
        image_data = await file.read()
        
        # Open image dengan PIL
        try:
            image = Image.open(io.BytesIO(image_data))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Gagal membaca gambar: {str(e)}"
            )
        
        # Run prediction (YOLO handles preprocessing internally)
        try:
            result = predict_caries(image)
            
            # Draw bounding boxes on image if there are detections
            annotated_image = image.copy()
            if result.get('detections') and len(result['detections']) > 0:
                annotated_image = draw_bounding_boxes(annotated_image, result['detections'])
            
            # Convert annotated image to base64
            img_buffer = io.BytesIO()
            annotated_image.save(img_buffer, format='JPEG', quality=95)
            img_buffer.seek(0)
            img_base64 = base64.b64encode(img_buffer.read()).decode('utf-8')
            
            # Add image to result (ensure it's a native type)
            result['annotatedImage'] = str(f"data:image/jpeg;base64,{img_base64}")
            
            # Final conversion to ensure all values are JSON serializable
            result = to_native_type(result)
            
            return JSONResponse(content=result)
        except ValueError as e:
            # ValueError biasanya dari validasi atau processing
            print(f"ValueError in prediction: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error processing prediction: {str(e)}"
            )
        except IndexError as e:
            # IndexError dari akses array
            print(f"IndexError in prediction: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error accessing model output: {str(e)}. Model mungkin tidak kompatibel."
            )
        except Exception as e:
            # Error lainnya
            print(f"Unexpected error in prediction: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"Gagal menjalankan prediksi: {str(e)}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error internal server: {str(e)}"
        )


if __name__ == "__main__":
    # Run server
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

