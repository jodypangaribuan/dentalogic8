"""
Export YOLO model to CoreML format using ultralytics
This is the recommended way to get CoreML models from YOLO
"""
from ultralytics import YOLO

def export_to_coreml():
    print("Loading YOLO model...")
    
    # Load the trained model
    model = YOLO("best.pt")
    
    # Export to CoreML
    # nms=False to handle NMS in post-processing
    # int8=False for float16 precision (faster on Neural Engine)
    print("Exporting to CoreML...")
    model.export(
        format="coreml",
        nms=False,  # We'll handle NMS ourselves for better control
        imgsz=640,
    )
    
    print("Export complete!")
    print("CoreML model saved as best.mlpackage")

if __name__ == "__main__":
    export_to_coreml()
