from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import base64
from PIL import Image
import io
import insightface
from insightface.app import FaceAnalysis

load_dotenv()
app = Flask(__name__)
CORS(app)

client = MongoClient(os.getenv('MONGO_URI'))
db_name = os.getenv('MONGO_DB_NAME', 'drishti').strip()
db = client[db_name]
embeddings_col = db['face_embeddings']

# Load model once at startup — downloads ~300MB ONNX model on first run
# then cached at /root/.insightface/
print("[Startup] Loading InsightFace model...")
face_app = FaceAnalysis(
    name='buffalo_sc',        # smallest+fastest model: det + recognition
    providers=['CPUExecutionProvider']
)
face_app.prepare(ctx_id=0, det_size=(320, 320))  # 320 is faster than default 640
print("[Startup] InsightFace ready.")


def decode_base64_to_rgb_array(image_b64):
    image_bytes = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    return np.array(image)


def cosine_similarity(a, b):
    a, b = np.array(a), np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


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
        # InsightFace expects BGR
        img_bgr = img_array[:, :, ::-1]
        faces = face_app.get(img_bgr)

        if len(faces) == 0:
            return jsonify({'error': 'No face detected in image'}), 400

        # Take largest face (most prominent)
        largest = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
        embedding = largest.embedding.tolist()

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
        img_bgr = img_array[:, :, ::-1]
        faces = face_app.get(img_bgr)

        if len(faces) == 0:
            return jsonify({'match': None})

        largest = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
        query_embedding = largest.embedding.tolist()

    except Exception as e:
        print(f"[Identify] Error: {e}")
        return jsonify({'match': None})

    saved = list(embeddings_col.find({'userId': user_id}))
    valid_saved = [f for f in saved if f.get('embedding') and len(f['embedding']) > 0]

    if not valid_saved:
        return jsonify({'match': None})

    similarities = [cosine_similarity(query_embedding, f['embedding']) for f in valid_saved]
    best_idx = int(np.argmax(similarities))
    best_similarity = similarities[best_idx]

    debug = {valid_saved[i]['label']: round(similarities[i], 3) for i in range(len(valid_saved))}
    print(f"[Identify] Similarities: {debug}")

    # Cosine similarity: 1.0 = identical, threshold 0.4 = reasonably strict
    threshold = 0.40
    if best_similarity >= threshold:
        confidence = round(((best_similarity - threshold) / (1.0 - threshold)) * 100, 1)
        confidence = min(confidence, 99.9)

        return jsonify({
            'match': {
                'label': valid_saved[best_idx]['label'],
                'confidence': confidence,
                'distance': float(1 - best_similarity)
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