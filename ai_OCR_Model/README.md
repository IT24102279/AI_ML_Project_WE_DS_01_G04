# 💊 Prescription OCR Pipeline

A powerful, local-first AI system for digitizing handwritten medical prescriptions. It uses a hybrid approach of **OpenCV** for layout parsing, **ResNet-18** for technical medicine name classification, and **Gemini 2.5 Flash-Lite** for final dosage verification and structured data extraction.

## 🚀 Key Features

- **One-Click Scanning**: Automates the entire flow from image to structured JSON.
- **Smart Segmentation**: Custom OpenCV logic filters out noise and locks onto medicine names.
- **Interactive Editor**: Manually adjust detection boxes if the AI misses anything.
- **Live Corrections**: Edit the AI's final reading (names, dosage, frequency) before sending.
- **POS Integration**: Forwards finalized JSON directly to your Pharmacy POS backend.
- **Privacy First**: Image processing and classification happen locally.

---

## 🛠️ Prerequisites

- **Python 3.10+** installed on your system.
- **Gemini API Key**: Get a free key from [Google AI Studio](https://aistudio.google.com/).
- **Pharmacy POS Backend**: (Optional) The app expects a backend on `http://localhost:3000` to receive the data.

---

## 📦 Installation

1. **Clone or Download** this repository to your computer.
2. **Set up your API Key**:
   - Rename `.env.example` to `.env.local`.
   - Open `.env.local` and paste your Gemini API Key:
     ```env
     GEMINI_API_KEY=your_key_here
     ```
3. **Model Files**: Ensure the following files are in the `collab_exported_model/` directory:
   - `best_resnet18.pt`
   - `label_encoder.pkl`
   - `label_map.json`

---

## 🏃 Running the App

### Option 1: Using the Auto-Runner (Recommended)
This script checks for missing libraries and installs them automatically before starting.

- **Windows**: Right-click `run.ps1` and select "Run with PowerShell" (or type `.\run.ps1` in your terminal).
- **Linux/Mac**: Run `bash run.sh`.

### Option 2: Manual Start
If you prefer to run it manually:
```bash
# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python ocr.py
```

Once started, open your browser to: **`http://localhost:5000`**

---

## 🛠️ Technical Stack

- **Backend**: Flask (Python), PyTorch (ResNet-18), OpenCV.
- **AI**: Gemini 2.5 Flash-Lite (via REST API).
- **Frontend**: Vanilla JS (Canvas API), CSS3 (shadcn/ui dark theme).

---

## 📋 Troubleshooting

- **"Python not found"**: Ensure Python is added to your system's PATH variables.
- **"WinError 10053"**: The app now handles large images automatically, but if you see connection issues, try a smaller photo.
- **"429 Resource Exhausted"**: This means you've hit your Gemini API free-tier quota. Wait a minute and try again.
