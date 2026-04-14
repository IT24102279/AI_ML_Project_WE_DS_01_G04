#!/bin/bash

echo "Checking requirements..."

# Check for key dependencies
python3 -c "import flask, dotenv, google.genai, torch, cv2" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "Requirements missing. Installing..."
    pip install -r requirements.txt
else
    echo "Requirements satisfied."
fi

echo "Starting Transcription OCR Pipeline..."
python3 ocr.py
