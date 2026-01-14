"""
FastAPI Server untuk Deteksi Karies Gigi menggunakan ONNX Runtime
"""
import os
import time
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageDraw, ImageFont
import io
import uvicorn
import base64
import onnxruntime as ort

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
MODEL_PATH = Path(__file__).parent.parent / "model" / "best_opset21.onnx"
MODEL_INPUT_SIZE = 640
CARIES_CLASSES = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']
CONFIDENCE_THRESHOLD = 0.25
IOU_THRESHOLD = 0.5

# Global variables untuk model
onnx_session = None
model_loaded = False


def load_model():
    """Load ONNX model ke memory menggunakan ONNX Runtime"""
    global onnx_session, model_loaded
    
    if model_loaded and onnx_session is not None:
        return onnx_session
    
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
    
    try:
        # Configure ONNX Runtime session options
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        
        # Try to use GPU if available, fallback to CPU
        providers = ['CPUExecutionProvider']
        try:
            available_providers = ort.get_available_providers()
            if 'CUDAExecutionProvider' in available_providers:
                providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
            elif 'CoreMLExecutionProvider' in available_providers:
                providers = ['CoreMLExecutionProvider', 'CPUExecutionProvider']
        except Exception:
            pass
        
        # Load ONNX model
        onnx_session = ort.InferenceSession(
            str(MODEL_PATH),
            sess_options=sess_options,
            providers=providers
        )
        model_loaded = True
        
        # Print model info
        print(f"ONNX model loaded successfully from {MODEL_PATH}")
        print(f"Using providers: {onnx_session.get_providers()}")
        
        # Get model input/output info
        input_info = onnx_session.get_inputs()[0]
        output_info = onnx_session.get_outputs()[0]
        print(f"Model input: {input_info.name}, shape: {input_info.shape}, type: {input_info.type}")
        print(f"Model output: {output_info.name}, shape: {output_info.shape}")
        print(f"Model classes: {CARIES_CLASSES}")
        
        return onnx_session
    except Exception as e:
        raise RuntimeError(f"Failed to load ONNX model: {str(e)}")


def preprocess_image(image: Image.Image) -> Tuple[np.ndarray, float, float, int, int]:
    """
    Preprocess image untuk model ONNX dengan letterboxing
    - Resize dengan aspect ratio preserved + padding (letterbox)
    - Convert ke RGB
    - Normalize pixel values ke [0, 1]
    - Convert ke format CHW [1, 3, 640, 640]
    
    Returns:
        Tuple of (preprocessed image, scale ratio, top padding, left padding)
    """
    # Convert ke RGB jika perlu
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    orig_width, orig_height = image.size
    
    # Calculate scale to fit within MODEL_INPUT_SIZE while preserving aspect ratio
    scale = min(MODEL_INPUT_SIZE / orig_width, MODEL_INPUT_SIZE / orig_height)
    new_width = int(orig_width * scale)
    new_height = int(orig_height * scale)
    
    # Resize image with preserved aspect ratio
    resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Create letterboxed image (grey padding)
    letterboxed = Image.new('RGB', (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), (114, 114, 114))
    
    # Calculate padding
    pad_left = (MODEL_INPUT_SIZE - new_width) // 2
    pad_top = (MODEL_INPUT_SIZE - new_height) // 2
    
    # Paste resized image onto letterboxed canvas
    letterboxed.paste(resized, (pad_left, pad_top))
    
    # Convert ke numpy array
    img_array = np.array(letterboxed, dtype=np.float32)
    
    # Normalize ke [0, 1]
    img_array = img_array / 255.0
    
    # Convert dari HWC ke CHW format
    # Original: (640, 640, 3) -> Target: (3, 640, 640)
    img_array = np.transpose(img_array, (2, 0, 1))
    
    # Add batch dimension: (3, 640, 640) -> (1, 3, 640, 640)
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array, scale, pad_top, pad_left


def xywh_to_xyxy(boxes: np.ndarray) -> np.ndarray:
    """Convert bounding boxes from [x_center, y_center, width, height] to [x1, y1, x2, y2]"""
    result = np.zeros_like(boxes)
    result[:, 0] = boxes[:, 0] - boxes[:, 2] / 2  # x1
    result[:, 1] = boxes[:, 1] - boxes[:, 3] / 2  # y1
    result[:, 2] = boxes[:, 0] + boxes[:, 2] / 2  # x2
    result[:, 3] = boxes[:, 1] + boxes[:, 3] / 2  # y2
    return result


def non_max_suppression(
    boxes: np.ndarray,
    scores: np.ndarray,
    class_ids: np.ndarray,
    iou_threshold: float = 0.5
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Non-Maximum Suppression untuk filter overlapping bounding boxes
    
    Args:
        boxes: Array of shape [N, 4] dengan format [x1, y1, x2, y2]
        scores: Array of shape [N] dengan confidence scores
        class_ids: Array of shape [N] dengan class IDs
        iou_threshold: IoU threshold untuk NMS
    
    Returns:
        Tuple of (filtered_boxes, filtered_scores, filtered_class_ids)
    """
    if len(boxes) == 0:
        return np.array([]), np.array([]), np.array([])
    
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
    
    keep = np.array(keep)
    return boxes[keep], scores[keep], class_ids[keep]


def process_yolo_output(
    output: np.ndarray,
    scale: float,
    pad_top: int,
    pad_left: int,
    orig_width: int,
    orig_height: int,
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.5
) -> List[Dict]:
    """
    Process YOLO model output to extract detections
    
    YOLO output format: [1, num_classes + 4, num_detections]
    - First 4 values are [x_center, y_center, width, height]
    - Remaining values are class probabilities
    
    Args:
        output: Raw model output
        scale: Scale ratio used during preprocessing
        pad_top: Top padding added during letterboxing
        pad_left: Left padding added during letterboxing
        orig_width: Original image width
        orig_height: Original image height
        conf_threshold: Confidence threshold
        iou_threshold: IoU threshold for NMS
    
    Returns:
        List of detection dictionaries
    """
    # Output shape: [1, 4 + num_classes, num_detections] -> transpose to [num_detections, 4 + num_classes]
    predictions = output[0].T  # Shape: [num_detections, 4 + num_classes]
    
    num_classes = len(CARIES_CLASSES)
    
    # Extract box coordinates and class scores
    boxes_xywh = predictions[:, :4]  # [x_center, y_center, width, height]
    class_scores = predictions[:, 4:4 + num_classes]  # Class probabilities
    
    # Get maximum class score and class ID for each detection
    max_scores = np.max(class_scores, axis=1)
    class_ids = np.argmax(class_scores, axis=1)
    
    # Filter by confidence threshold
    mask = max_scores >= conf_threshold
    boxes_xywh = boxes_xywh[mask]
    max_scores = max_scores[mask]
    class_ids = class_ids[mask]
    
    if len(boxes_xywh) == 0:
        return []
    
    # Convert from xywh to xyxy
    boxes_xyxy = xywh_to_xyxy(boxes_xywh)
    
    # Apply NMS
    boxes_xyxy, max_scores, class_ids = non_max_suppression(
        boxes_xyxy, max_scores, class_ids, iou_threshold
    )
    
    if len(boxes_xyxy) == 0:
        return []
    
    # Convert coordinates from letterboxed space to original image space
    # Remove padding and scale
    boxes_xyxy[:, 0] = (boxes_xyxy[:, 0] - pad_left) / scale  # x1
    boxes_xyxy[:, 1] = (boxes_xyxy[:, 1] - pad_top) / scale   # y1
    boxes_xyxy[:, 2] = (boxes_xyxy[:, 2] - pad_left) / scale  # x2
    boxes_xyxy[:, 3] = (boxes_xyxy[:, 3] - pad_top) / scale   # y2
    
    # Clip to image boundaries
    boxes_xyxy[:, 0] = np.clip(boxes_xyxy[:, 0], 0, orig_width)
    boxes_xyxy[:, 1] = np.clip(boxes_xyxy[:, 1], 0, orig_height)
    boxes_xyxy[:, 2] = np.clip(boxes_xyxy[:, 2], 0, orig_width)
    boxes_xyxy[:, 3] = np.clip(boxes_xyxy[:, 3], 0, orig_height)
    
    # Build detection list
    detections = []
    for i in range(len(boxes_xyxy)):
        x1, y1, x2, y2 = boxes_xyxy[i]
        class_id = int(class_ids[i])
        score = float(max_scores[i])
        
        # Map class ID to class name
        if class_id < len(CARIES_CLASSES):
            class_name = CARIES_CLASSES[class_id]
        else:
            class_name = "D0"
        
        detections.append({
            "bbox": [float(x1), float(y1), float(x2), float(y2)],
            "class": class_name,
            "confidence": score * 100  # Convert to percentage
        })
        
        print(f"Detection: {class_name} ({score:.3f}) at [{x1:.1f}, {y1:.1f}, {x2:.1f}, {y2:.1f}]")
    
    return detections


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
                # Linux font paths
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
                font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
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


def predict_caries(original_image: Image.Image) -> Dict:
    """
    Run inference pada image menggunakan ONNX model
    Returns: Dictionary dengan hasil prediksi termasuk bounding boxes
    """
    global onnx_session
    
    try:
        if onnx_session is None:
            onnx_session = load_model()
        
        # Get original image size
        orig_width, orig_height = original_image.size
        
        # Preprocess image
        input_tensor, scale, pad_top, pad_left = preprocess_image(original_image)
        
        # Get input name
        input_name = onnx_session.get_inputs()[0].name
        
        # Run inference
        start_time = time.time()
        outputs = onnx_session.run(None, {input_name: input_tensor})
        inference_time = (time.time() - start_time) * 1000  # Convert ke milliseconds
        
        # Process YOLO output
        output = outputs[0]  # Get first output
        print(f"Raw output shape: {output.shape}")
        
        # Process detections
        detections = process_yolo_output(
            output,
            scale,
            pad_top,
            pad_left,
            orig_width,
            orig_height,
            conf_threshold=CONFIDENCE_THRESHOLD,
            iou_threshold=IOU_THRESHOLD
        )
        
        print(f"Found {len(detections)} detections after processing")
        
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
        
        # Create bounding boxes list
        filtered_boxes = [det['bbox'] for det in detections]
        
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
        raise ValueError(f"Error processing ONNX prediction: {str(e)}")


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
        "message": "Dentalogic8 API Server (ONNX Runtime)",
        "model_loaded": model_loaded
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model_loaded,
        "model_path": str(MODEL_PATH) if MODEL_PATH.exists() else None,
        "runtime": "ONNX Runtime"
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
        
        # Run prediction
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


from pydantic import BaseModel

class Base64ImageRequest(BaseModel):
    image: str  # base64 encoded image with data URI prefix

@app.post("/predict-base64")
async def predict_base64(request: Base64ImageRequest):
    """
    Endpoint untuk prediksi karies dari base64-encoded image (untuk real-time scanning)
    
    Args:
        request: JSON dengan field 'image' berisi base64 string
    
    Returns:
        JSON dengan hasil prediksi termasuk bounding boxes
    """
    try:
        # Extract base64 data from data URI
        image_data = request.image
        if ',' in image_data:
            # Remove data URI prefix (e.g., "data:image/jpeg;base64,")
            image_data = image_data.split(',', 1)[1]
        
        # Decode base64 to bytes
        try:
            image_bytes = base64.b64decode(image_data)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid base64 data: {str(e)}"
            )
        
        # Open image with PIL
        try:
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to read image: {str(e)}"
            )
        
        # Run prediction (faster version without annotated image for real-time)
        try:
            result = predict_caries(image)
            
            # Get image dimensions for normalization
            img_width, img_height = image.size
            
            # Normalize detection coordinates to 0-1 range for easy client-side mapping
            normalized_detections = []
            for det in result.get("detections", []):
                bbox = det.get("bbox", [0, 0, 0, 0])
                normalized_detections.append({
                    "bbox": [
                        bbox[0] / img_width,   # x1 normalized
                        bbox[1] / img_height,  # y1 normalized
                        bbox[2] / img_width,   # x2 normalized
                        bbox[3] / img_height,  # y2 normalized
                    ],
                    "class": det.get("class", "D0"),
                    "confidence": det.get("confidence", 0),
                })
            
            # For real-time, skip annotated image generation to save time
            return JSONResponse(content={
                "class": result.get("class", "D0"),
                "confidence": result.get("confidence", 0),
                "inferenceTime": result.get("inferenceTime", 0),
                "detections": normalized_detections,
                "imageWidth": img_width,
                "imageHeight": img_height,
            })
        except Exception as e:
            print(f"Prediction error: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"Prediction failed: {str(e)}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
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
