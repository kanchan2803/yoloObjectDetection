import fs from 'fs';
import CustomObject from '../models/CustomObject.js';

const pythonServiceUrl = (process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5001').replace(/\/+$/, '');

export const uploadObject = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const { label, type = 'object' } = req.body;
    const userId = req.user.userId;

    const newObject = new CustomObject({
      userId,
      label,
      imagePath: req.file.path,
      type,
    });

    await newObject.save();

    try {
      if (type !== 'person') throw new Error('Not a person upload, skipping');

      const imageBase64 = fs.readFileSync(req.file.path, { encoding: 'base64' });

      await fetch(`${pythonServiceUrl}/register-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          label,
          userId: userId.toString(),
          objectId: newObject._id.toString(),
        }),
      });
    } catch (err) {
      console.warn('Face registration skipped:', err.message);
    }

    res.status(201).json({
      message: 'Custom object saved successfully!',
      object: newObject,
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ message: 'Server error during upload' });
  }
};

export const getObjects = async (req, res) => {
  try {
    const objects = await CustomObject.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(objects);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ message: 'Server error while fetching objects' });
  }
};

export const deleteObject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const obj = await CustomObject.findOne({ _id: id, userId });

    if (!obj) {
      return res.status(404).json({ message: 'Object not found or not yours' });
    }

    if (fs.existsSync(obj.imagePath)) {
      fs.unlinkSync(obj.imagePath);
    }

    await CustomObject.deleteOne({ _id: id });

    if (obj.type === 'person') {
      try {
        await fetch(`${pythonServiceUrl}/delete-face`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectId: id.toString() }),
        });
      } catch (err) {
        console.warn('Face embedding deletion skipped:', err.message);
      }
    }

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ message: 'Server error during deletion' });
  }
};
