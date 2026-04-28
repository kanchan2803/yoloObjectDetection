from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition
import numpy as np
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import base64
from PIL import Image
import io

load_dotenv()
app = Flask(__name__)
CORS(app)

client = MongoClient(os.getenv('MONGO_URI'))
db_name = os.getenv('MONGO_DB_NAME', 'drishti').strip()
db = client[db_name]
embeddings_col = db['face_embeddings']


def decode_base64_to_rgb_array(image_b64):
    """Decode base64 image to RGB numpy array (what face_recognition expects)"""
    image_bytes = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    return np.array(image)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/register-face', methods=['POST'])
def register_face():
    data = request.json
    label = data.get('label')
    user_id = data.get('userId')
    object_id = data.get('objectId')

    if not all([label, user_id, object_id, data.get('image')]):
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        img_array = decode_base64_to_rgb_array(data['image'])
        
        # Get face encodings — returns a list, one per face found
        encodings = face_recognition.face_encodings(img_array)
        
        if len(encodings) == 0:
            return jsonify({'error': 'No face detected in image'}), 400
        
        # Take the first (most prominent) face
        embedding = encodings[0].tolist()  # Convert numpy to list for MongoDB storage
        
    except Exception as e:
        print(f"[Register] Error: {e}")
        return jsonify({'error': 'Failed to process image'}), 400

    embeddings_col.update_one(
        {'objectId': object_id},
        {'$set': {
            'userId': user_id,
            'objectId': object_id,
            'label': label,
            'embedding': embedding
        }},
        upsert=True
    )

    print(f"[Register] Saved face for: {label}")
    return jsonify({'success': True, 'label': label})


@app.route('/identify-face', methods=['POST'])
def identify_face():
    data = request.json
    user_id = data.get('userId')

    if not user_id or not data.get('image'):
        return jsonify({'match': None})

    try:
        img_array = decode_base64_to_rgb_array(data['image'])
        encodings = face_recognition.face_encodings(img_array)
        
        if len(encodings) == 0:
            return jsonify({'match': None})
        
        query_encoding = encodings[0]
        
    except Exception as e:
        print(f"[Identify] Error processing image: {e}")
        return jsonify({'match': None})

    # Load all saved faces for this user
    saved = list(embeddings_col.find({'userId': user_id}))
    if not saved:
        return jsonify({'match': None})

    # Filter out any corrupt entries
    valid_saved = [f for f in saved if f.get('embedding') and len(f['embedding']) > 0]
    if not valid_saved:
        return jsonify({'match': None})

    # face_recognition uses Euclidean distance — compare_faces uses threshold 0.6
    # face_distance gives exact distances (lower = more similar)
    known_encodings = [np.array(f['embedding']) for f in valid_saved]
    distances = face_recognition.face_distance(known_encodings, query_encoding)
    
    best_idx = np.argmin(distances)
    best_distance = distances[best_idx]

    # 0.45 is stricter than the default 0.6 — reduces false positives
    threshold = 0.45
    
    debug = {valid_saved[i]['label']: round(float(distances[i]), 3) for i in range(len(valid_saved))}
    print(f"[Identify] Distances: {debug}")

    if best_distance < threshold:
        # Convert distance to a confidence percentage
        confidence = round((1 - (best_distance / threshold)) * 100, 1)
        confidence = min(confidence, 99.9)
        
        return jsonify({
            'match': {
                'label': valid_saved[best_idx]['label'],
                'confidence': confidence,
                'distance': float(best_distance)
            }
        })

    return jsonify({'match': None})


@app.route('/delete-face', methods=['POST'])
def delete_face():
    data = request.json
    object_id = data.get('objectId')

    if not object_id:
        return jsonify({'error': 'Missing objectId'}), 400

    result = embeddings_col.delete_one({'objectId': object_id})
    print(f"[Delete] objectId: {object_id}, deleted: {result.deleted_count}")
    return jsonify({'success': True, 'deleted': result.deleted_count})


if __name__ == '__main__':
    port = int(os.getenv('PORT', '5001'))
    app.run(host='0.0.0.0', port=port)