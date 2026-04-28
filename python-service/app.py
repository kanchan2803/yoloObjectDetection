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
db = client[os.getenv('MONGO_DB_NAME', 'drishti')]
embeddings_col = db['face_embeddings']

MODEL_NAME = "Facenet"


def decode_base64_to_bgr(image_b64):
    image_bytes = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    return np.array(image)[:, :, ::-1]


@app.route('/register-face', methods=['POST'])
def register_face():
    data = request.json
    label = data['label']
    user_id = data['userId']
    object_id = data['objectId']

    try:
        image_bgr_array = decode_base64_to_bgr(data['image'])
        face_objs = DeepFace.represent(
            img_path=image_bgr_array,
            model_name=MODEL_NAME,
            enforce_detection=True,
        )
        embedding = face_objs[0]["embedding"]
    except ValueError:
        return jsonify({'error': 'No face found in image'}), 400

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

    return jsonify({'success': True, 'label': label})


@app.route('/identify-face', methods=['POST'])
def identify_face():
    data = request.json
    user_id = data['userId']

    try:
        img_bgr_array = decode_base64_to_bgr(data['image'])
        face_objs = DeepFace.represent(
            img_path=img_bgr_array,
            model_name=MODEL_NAME,
            enforce_detection=True,
        )
        query_embedding = face_objs[0]["embedding"]
    except ValueError:
        return jsonify({'match': None})

    saved = list(embeddings_col.find({'userId': user_id}))
    if not saved:
        return jsonify({'match': None})

    distances = [cosine(query_embedding, saved_face['embedding']) for saved_face in saved]
    best_idx = np.argmin(distances)
    best_distance = distances[best_idx]

    threshold = 0.40
    if best_distance < threshold:
        confidence = round((1 - (best_distance / threshold)) * 100, 1)
        confidence = min(confidence, 99.9)

        return jsonify({
            'match': {
                'label': saved[best_idx]['label'],
                'confidence': confidence,
                'distance': float(best_distance)
            }
        })

    debug_distances = {
        saved[i]['label']: round(float(distances[i]), 3)
        for i in range(len(saved))
    }
    print(f"[Face ID] Query distances: {debug_distances}")
    return jsonify({'match': None})


@app.route('/delete-face', methods=['POST'])
def delete_face():
    data = request.json
    object_id = data['objectId']

    result = embeddings_col.delete_one({'objectId': object_id})
    print(f"[Delete] Removed face embedding for objectId: {object_id}, deleted: {result.deleted_count}")

    return jsonify({'success': True, 'deleted': result.deleted_count})


if __name__ == '__main__':
    port = int(os.getenv('PORT', '5001'))
    app.run(host='0.0.0.0', port=port)
