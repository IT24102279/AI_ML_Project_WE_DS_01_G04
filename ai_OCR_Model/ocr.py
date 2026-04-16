import os
import json
import pickle
import base64
import traceback
from io import BytesIO

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
import torch
import torch.nn as nn
from torchvision import transforms, models
from flask import Flask, request, render_template, send_from_directory, jsonify, url_for
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv(".env.local")

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
# Primary paths (organized in collab_exported_model)
MODEL_DIR = "collab_exported_model"
MODEL_PATH = os.path.join(MODEL_DIR, "best_resnet18.pt")
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder.pkl")
UPLOAD_FOLDER = "uploads"
RESULTS_FOLDER = "results"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:3000")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
TARGET_SIZE_MODEL = (320, 320)
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# ──────────────────────────────────────────────
# Load LabelEncoder
# ──────────────────────────────────────────────
le = None
NUM_CLASSES = 0
try:
    with open(LABEL_ENCODER_PATH, "rb") as f:
        le = pickle.load(f)
    NUM_CLASSES = len(le.classes_)
    print(f"[INFO] LabelEncoder loaded — {NUM_CLASSES} classes")
except FileNotFoundError:
    print(f"[ERROR] {LABEL_ENCODER_PATH} not found in root directory!")
except Exception as e:
    print(f"[ERROR] Failed to load LabelEncoder: {e}")

# ──────────────────────────────────────────────
# Load Trained Model
# ──────────────────────────────────────────────
model = None
if NUM_CLASSES > 0:
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, NUM_CLASSES)

    if os.path.exists(MODEL_PATH):
        ckpt = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
        state = ckpt.get("state_dict", ckpt)
        model.load_state_dict(state)
        print(f"[INFO] Model loaded from {MODEL_PATH}")
    else:
        print(f"[WARN] {MODEL_PATH} not found — using basic weights")

    model.to(DEVICE)
    model.eval()

inference_transform = transforms.Compose([
    transforms.Resize(TARGET_SIZE_MODEL),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

# ──────────────────────────────────────────────
# Preprocessing Pipeline (matches notebook)
# ──────────────────────────────────────────────
def preprocess_crop_for_resnet(crop_bgr, target_size=320):
    """Convert a BGR crop to the preprocessed PIL image expected by the model."""
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    bg_color = int(np.median(gray))
    h, w = gray.shape
    scale = min(target_size / w, target_size / h)
    new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
    resized = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_AREA)
    canvas = np.full((target_size, target_size), bg_color, dtype=np.uint8)
    x_offset = (target_size - new_w) // 2
    y_offset = (target_size - new_h) // 2
    canvas[y_offset : y_offset + new_h, x_offset : x_offset + new_w] = resized
    return Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_GRAY2RGB))


# ──────────────────────────────────────────────
# Gemini Helpers
# ──────────────────────────────────────────────
def _get_gemini_client():
    from google import genai
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")
    return genai.Client(api_key=GEMINI_API_KEY)


def detect_words_with_opencv(image_path):
    """
    Step 1 (OpenCV Version) — Use image processing to find medicine name regions.
    Resizes image to 1000px width for consistent contour detection.
    """
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        return []

    # Preset Resize for consistent parameter tuning
    TARGET_WIDTH = 1000
    h_orig, w_orig = img_bgr.shape[:2]
    ratio = TARGET_WIDTH / w_orig
    new_h = int(h_orig * ratio)
    img_resized = cv2.resize(img_bgr, (TARGET_WIDTH, new_h))

    # Grayscale + Blur
    gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)

    # Thresholding
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )

    # Morphological operations to merge characters into lines
    # Longer horizontal kernel favors medicine names (typically multi-character)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 5))
    dilated = cv2.dilate(thresh, kernel, iterations=1)

    # Find Contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    detections = []
    for i, cnt in enumerate(contours):
        x, y, w, h = cv2.boundingRect(cnt)
        
        # Filter based on size and position to favor medicine names
        # Usually medicine names are wider than frequencies like 'bd' or 'tds'
        # and on the left half of the page
        area = w * h
        aspect_ratio = w / float(h)
        
        # Heuristics:
        # 1. Increased width to favor long medicine names (Amodis, Nexum) over short ones (bd, tds)
        # 2. Prefer boxes strictly in the left half of the image
        # 3. Prefer boxes with a wider aspect ratio (words/names)
        if w > 180 and h > 15 and aspect_ratio > 1.2 and x < (TARGET_WIDTH * 0.5):
            # Normalize to 0-1000 for frontend
            box = [
                int(y / new_h * 1000),
                int(x / TARGET_WIDTH * 1000),
                int((y + h) / new_h * 1000),
                int((x + w) / TARGET_WIDTH * 1000),
            ]
            detections.append({
                "label": f"medicine_{len(detections)+1}", 
                "box_2d": box
            })

    # Sort top to bottom
    detections.sort(key=lambda x: x["box_2d"][0])
    return detections


def gemini_read_prescription(image_path, detected_names):
    """
    Step 2 — Send the full prescription image plus ResNet-detected names to Gemini 
    using raw REST API (matches user's successful pattern).
    """
    import requests as req_lib
    
    # 1. Prepare Image (Resize to reduce payload size to avoid connection drops)
    img_pil = Image.open(image_path).convert("RGB")
    
    MAX_DIM = 1600
    if max(img_pil.width, img_pil.height) > MAX_DIM:
        ratio = MAX_DIM / max(img_pil.width, img_pil.height)
        new_size = (int(img_pil.width * ratio), int(img_pil.height * ratio))
        img_pil = img_pil.resize(new_size, Image.LANCZOS)
        
    buf = BytesIO()
    img_pil.save(buf, format="JPEG", quality=85)
    img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    names_str = ", ".join(detected_names) if detected_names else "none detected"

    prompt = (
        "You are reading a handwritten medical prescription image.\n"
        "An OCR model has detected the following medicine names from the prescription:\n"
        f"  [{names_str}]\n\n"
        "IMPORTANT: The OCR model may have made mistakes. Some medicines might not be in\n"
        "its training set. Double-check each name against what you can actually read in\n"
        "the image. If the OCR prediction looks wrong, use your own reading instead.\n\n"
        "For EACH medicine in the prescription, extract:\n"
        '  - "medicine_name_raw": the full medicine name (e.g. "Curam 625mg")\n'
        '  - "frequency": dosing frequency in medical shorthand (e.g. "BID", "TID", "QD", "PRN")\n'
        '  - "total_amount": total number of tablets/units prescribed, as an integer\n\n'
        "Return a JSON object with this EXACT structure:\n"
        "{\n"
        '  "patient_id": 1,\n'
        '  "extracted_lines": [\n'
        "    {\n"
        '      "medicine_name_raw": "...",\n'
        '      "frequency": "...",\n'
        '      "total_amount": ...\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- patient_id should always be 1 (default)\n"
        "- If you cannot determine frequency, use an empty string\n"
        "- If you cannot determine total_amount, use 0\n"
        "- Include ALL medicines you can see in the prescription\n"
        "- Return ONLY valid JSON, no markdown fences, no extra text"
    )

    # 2. Build REST Payload
    # Using stable v1 endpoint as gemini-2.5-flash-lite is now GA
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={GEMINI_API_KEY}"
    
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img_b64
                    }
                }
            ]
        }],
        "generation_config": {
            "temperature": 0.2,
            "response_mime_type": "application/json"
        }
    }

    try:
        response = req_lib.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=30)
        
        if not response.ok:
            print(f"\n[LLM ERROR] Status: {response.status_code}")
            print(f"Response: {response.text}\n")
            raise Exception(f"Gemini API failed: {response.status_code} {response.text}")

        result = response.json()
        raw_text = result['candidates'][0]['content']['parts'][0]['text'].strip()
        
        # Strip markdown if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            if raw_text.endswith("```"):
                raw_text = raw_text[: raw_text.rfind("```")]

        return json.loads(raw_text)
        
    except Exception as e:
        print("\n" + "="*40)
        print("GEMINI REST API ERROR")
        print("="*40)
        traceback.print_exc()
        print("="*40 + "\n")
        raise e


# ──────────────────────────────────────────────
# Flask App
# ──────────────────────────────────────────────
app = Flask(__name__)
CORS(app)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["RESULTS_FOLDER"] = RESULTS_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB

try:
    FONT = ImageFont.truetype("arial.ttf", 15)
except Exception:
    FONT = ImageFont.load_default()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/segment", methods=["POST"])
def api_segment():
    """
    Receive an uploaded image, send it to Gemini for segmentation.
    Returns bounding boxes + base64 image for canvas overlay.
    """
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    # Save uploaded file
    from werkzeug.utils import secure_filename
    import uuid

    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        # Use OpenCV for segmentation (replaces Gemini call)
        detections = detect_words_with_opencv(filepath)

        # Create base64 of the image for frontend canvas
        img_pil = Image.open(filepath).convert("RGB")
        
        # Resize original for UI if it's massive
        MAX_UI_W = 1200
        if img_pil.width > MAX_UI_W:
            ratio = MAX_UI_W / img_pil.width
            img_pil = img_pil.resize((MAX_UI_W, int(img_pil.height * ratio)), Image.LANCZOS)
        
        w, h = img_pil.size
        buf = BytesIO()
        img_pil.save(buf, format="JPEG", quality=90)
        img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return jsonify({
            "success": True,
            "filename": filename,
            "image_b64": img_b64,
            "image_width": w,
            "image_height": h,
            "detections": detections,
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/detect", methods=["POST"])
def api_detect():
    """
    Receive edited bounding boxes + filename.
    Crop each region, preprocess, run ResNet, return predictions.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body"}), 400

    filename = data.get("filename")
    boxes = data.get("boxes", [])
    if not filename or not boxes:
        return jsonify({"error": "Missing filename or boxes"}), 400

    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Image file not found"}), 404

    if model is None or le is None:
        return jsonify({"error": "Model or LabelEncoder not loaded"}), 500

    orig_img_cv = cv2.imread(filepath)
    if orig_img_cv is None:
        return jsonify({"error": "Failed to read image"}), 500

    h_orig, w_orig = orig_img_cv.shape[:2]
    predictions = []
    crop_images_b64 = []

    for i, box_item in enumerate(boxes):
        box = box_item.get("box_2d", box_item.get("box", []))
        if len(box) != 4:
            continue

        ymin, xmin, ymax, xmax = box
        # Convert from 0-1000 to pixel coords
        l = int(xmin * w_orig / 1000)
        t = int(ymin * h_orig / 1000)
        r = int(xmax * w_orig / 1000)
        b_px = int(ymax * h_orig / 1000)

        # Add padding
        pad = 15
        t_pad = max(0, t - pad)
        l_pad = max(0, l - pad)
        b_pad = min(h_orig, b_px + pad)
        r_pad = min(w_orig, r + pad)

        crop = orig_img_cv[t_pad:b_pad, l_pad:r_pad]
        if crop.size == 0:
            continue

        # Preprocess and predict
        processed = preprocess_crop_for_resnet(crop)
        tensor = inference_transform(processed).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            out = model(tensor)
            prob = torch.softmax(out, 1)
            idx = torch.argmax(prob, 1).item()
            conf = prob[0][idx].item()
            pred_name = le.classes_[idx]

        # Save crop as base64 for debugging
        crop_pil = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
        crop_buf = BytesIO()
        crop_pil.save(crop_buf, format="JPEG", quality=85)
        crop_b64 = base64.b64encode(crop_buf.getvalue()).decode("utf-8")

        # Save preprocessed crop as base64
        proc_buf = BytesIO()
        processed.save(proc_buf, format="JPEG", quality=85)
        proc_b64 = base64.b64encode(proc_buf.getvalue()).decode("utf-8")

        predictions.append({
            "index": i,
            "gemini_label": box_item.get("label", f"region_{i}"),
            "resnet_prediction": pred_name,
            "confidence": round(conf, 4),
            "box_2d": box,
        })
        crop_images_b64.append({
            "index": i,
            "original_crop_b64": crop_b64,
            "preprocessed_b64": proc_b64,
        })

    return jsonify({
        "success": True,
        "predictions": predictions,
        "crop_images": crop_images_b64,
    })


@app.route("/api/finalize", methods=["POST"])
def api_finalize():
    """
    Send the full prescription image + detected names to Gemini
    for final reading with frequency and total amounts.
    Returns the structured JSON matching the Node.js backend API.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body"}), 400

    filename = data.get("filename")
    detected_names = data.get("detected_names", [])

    if not filename:
        return jsonify({"error": "Missing filename"}), 400

    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Image file not found"}), 404

    try:
        result = gemini_read_prescription(filepath, detected_names)
        return jsonify({"success": True, "prescription_data": result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/send-to-backend", methods=["POST"])
def api_send_to_backend():
    """
    Forward the finalized prescription JSON to the Node.js backend.
    """
    import requests as req_lib

    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body"}), 400

    target_url = f"{NODE_BACKEND_URL}/api/pos/process-prescription"
    try:
        resp = req_lib.post(target_url, json=data.get("payload", data), timeout=10)
        return jsonify({
            "success": resp.status_code < 400,
            "status_code": resp.status_code,
            "response": resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text,
        })
    except Exception as e:
        return jsonify({"error": f"Failed to reach backend: {e}"}), 502


@app.route("/results/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["RESULTS_FOLDER"], filename)


@app.route("/uploads/<filename>")
def serve_upload(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


if __name__ == "__main__":
    print("=" * 60)
    print("  Prescription OCR Pipeline")
    print(f"  Device: {DEVICE}")
    print(f"  Model loaded: {model is not None}")
    print(f"  Classes: {NUM_CLASSES}")
    print(f"  Gemini API: {'configured' if GEMINI_API_KEY else 'NOT SET'}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5005, debug=True)