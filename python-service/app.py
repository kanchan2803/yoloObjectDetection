from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace
import numpy as np
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import base64
from PIL import Image
import io
from scipy.spatial.distance import cosine

load_dotenv()
app = Flask(__name__)
CORS(app)

client = MongoClient(os.getenv('MONGO_URI'))
db = client['your_db_name']  # change to match your DB name
embeddings_col = db['face_embeddings']

# We explicitly define the model. Facenet is lightweight and highly accurate.
MODEL_NAME = "Facenet"

@app.route('/register-face', methods=['POST'])
def register_face():
    """
    Called when user uploads a photo.
    Extracts face embedding using DeepFace and saves it.
    """
    data = request.json
    image_path = data['imagePath']
    label = data['label']
    user_id = data['userId']
    object_id = data['objectId']

    full_path = os.path.join('..', 'backend', image_path)
    
    try:
        # Extract embeddings. enforce_detection=True ensures a face is present.
        # Returns a list of dicts. We take the first one.
        face_objs = DeepFace.represent(img_path=full_path, model_name=MODEL_NAME, enforce_detection=True)
        embedding = face_objs[0]["embedding"]
    except ValueError:
        return jsonify({ 'error': 'No face found in image' }), 400

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
    Called from the camera every ~1 second.
    Receives a base64 cropped face image, returns best match.
    """
    data = request.json
    user_id = data['userId']
    image_b64 = data['image']

    # Decode base64 image
    img_bytes = base64.b64decode(image_b64)
    # DeepFace expects BGR for numpy arrays, so we convert RGB to BGR using numpy slicing
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    img_array = np.array(img)
    img_bgr_array = img_array[:, :, ::-1] 

    try:
        # Extract embedding from the camera crop
        face_objs = DeepFace.represent(img_path=img_bgr_array, model_name=MODEL_NAME, enforce_detection=True)
        query_embedding = face_objs[0]["embedding"]
    except ValueError:
        return jsonify({ 'match': None })  # No face in the crop

    # Fetch all embeddings for THIS user from MongoDB
    saved = list(embeddings_col.find({ 'userId': user_id }))
    if not saved:
        return jsonify({ 'match': None })

    # Compare query against all saved faces using Cosine Distance
    distances = []
    for s in saved:
        dist = cosine(query_embedding, s['embedding'])
        distances.append(dist)
    
    best_idx = np.argmin(distances)
    best_distance = distances[best_idx]

    # The verified threshold for Facenet using Cosine Distance is 0.40.
    # Anything below 0.40 is considered a match.
    THRESHOLD = 0.40
    
    if best_distance < THRESHOLD:
        # Calculate a rough percentage confidence
        confidence = round((1 - (best_distance / THRESHOLD)) * 100, 1)
        # Cap confidence at 99.9%
        confidence = min(confidence, 99.9) 
        
        return jsonify({
            'match': {
                'label': saved[best_idx]['label'],
                'confidence': confidence,
                'distance': float(best_distance)
            }
        })

    print(f"[Face ID] Query distances: { {saved[i]['label']: round(float(distances[i]), 3) for i in range(len(saved))} }")
    
    return jsonify({ 'match': None })

@app.route('/delete-face', methods=['POST'])
def delete_face():
    data = request.json
    object_id = data['objectId']
    
    result = embeddings_col.delete_one({'objectId': object_id})
    print(f"[Delete] Removed face embedding for objectId: {object_id}, deleted: {result.deleted_count}")
    
    return jsonify({'success': True, 'deleted': result.deleted_count})

if __name__ == '__main__':
    app.run(port=5001)