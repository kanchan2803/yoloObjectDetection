from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition
import numpy as np
import json
import os
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
import base64
from PIL import Image
import io

load_dotenv()
app = Flask(__name__)
CORS(app)

# Connect to the same MongoDB your Node app uses
client = MongoClient(os.getenv('MONGO_URI'))
db = client['your_db_name']  # change to match your DB name
embeddings_col = db['face_embeddings']

@app.route('/register-face', methods=['POST'])
def register_face():
    """
    Called when user uploads a photo.
    Extracts face embedding and saves it linked to the CustomObject.
    """
    data = request.json
    image_path = data['imagePath']   # e.g. "uploads/1234-photo.jpg"
    label = data['label']
    user_id = data['userId']
    object_id = data['objectId']     # MongoDB _id of the CustomObject

    # Load image from disk (Node already saved it)
    full_path = os.path.join('..', 'backend', image_path)
    image = face_recognition.load_image_file(full_path)
    
    # Find faces and extract 128-d embeddings
    # face_recognition returns one embedding per face found
    face_locations = face_recognition.face_locations(image)
    face_encodings = face_recognition.face_encodings(image, face_locations)

    if len(face_encodings) == 0:
        return jsonify({ 'error': 'No face found in image' }), 400
    
    # Take the first (largest) face found
    embedding = face_encodings[0].tolist()  # Convert numpy to list for JSON/MongoDB

    # Save embedding to MongoDB
    embeddings_col.update_one(
        { 'objectId': object_id },
        { '$set': {
            'userId': user_id,
            'objectId': object_id,
            'label': label,
            'embedding': embedding
        }},
        upsert=True
    )

    return jsonify({ 'success': True, 'label': label })


@app.route('/identify-face', methods=['POST'])
def identify_face():
    """
    Called from the camera every ~1 second when a 'person' is detected.
    Receives a base64 cropped face image, returns best match.
    """
    data = request.json
    user_id = data['userId']
    image_b64 = data['image']  # base64 encoded JPEG of the cropped face region

    # Decode base64 image
    img_bytes = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    img_array = np.array(img)

    # Extract embedding from the camera crop
    face_locations = face_recognition.face_locations(img_array)
    face_encodings = face_recognition.face_encodings(img_array, face_locations)

    if len(face_encodings) == 0:
        return jsonify({ 'match': None })  # No face in the crop

    query_embedding = face_encodings[0]

    # Fetch all embeddings for THIS user from MongoDB
    saved = list(embeddings_col.find({ 'userId': user_id }))
    if not saved:
        return jsonify({ 'match': None })

    # Compare query against all saved faces using Euclidean distance
    # face_recognition uses 0.6 as the standard threshold: below = same person
    saved_embeddings = [np.array(s['embedding']) for s in saved]
    distances = face_recognition.face_distance(saved_embeddings, query_embedding)
    
    best_idx = np.argmin(distances)
    best_distance = distances[best_idx]

    THRESHOLD = 0.5  # Stricter than default 0.6 — reduces false positives
    if best_distance < THRESHOLD:
        confidence = round((1 - best_distance) * 100, 1)
        return jsonify({
            'match': {
                'label': saved[best_idx]['label'],
                'confidence': confidence,
                'distance': float(best_distance)
            }
        })
    
    return jsonify({ 'match': None })


if __name__ == '__main__':
    app.run(port=5001)  # Node runs on 5000, Python on 5001