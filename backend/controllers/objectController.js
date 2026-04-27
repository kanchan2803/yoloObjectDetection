import CustomObject from '../models/CustomObject.js';

export const uploadObject = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const { label } = req.body;
    const userId = req.user.userId; 

    const newObject = new CustomObject({
      userId,
      label,
      imagePath: req.file.path,
      type: type || 'object'
    });

    await newObject.save();

      // Trigger face embedding extraction in the Python service
      // We do this async — don't block the upload response
      try {
  if (type !== 'person') throw new Error('Not a person upload, skipping');
  await fetch('http://localhost:5001/register-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePath: req.file.path,
            label,
            userId: userId.toString(),
            objectId: newObject._id.toString()
          })
        });
      } catch (err) {
        // Python service might not be running — log but don't fail the upload
        console.warn('Face registration skipped (Python service offline):', err.message);
      }

      res.status(201).json({ 
        message: 'Custom object saved successfully!', 
        object: newObject 
      });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: 'Server error during upload' });
  }
};

// ... existing uploadObject function ...

export const getObjects = async (req, res) => {
  try {
    // req.user.userId comes from our JWT middleware
    const objects = await CustomObject.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(objects);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ message: 'Server error while fetching objects' });
  }
};

export const deleteObject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Find the object first to verify ownership
    const obj = await CustomObject.findOne({ _id: id, userId });

    if (!obj) {
      return res.status(404).json({ message: 'Object not found or not yours' });
    }

    // Delete the image file from disk
    const fs = await import('fs');
    const filePath = obj.imagePath;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from MongoDB
    await CustomObject.deleteOne({ _id: id });

    // If it was a person, also delete the face embedding from Python service DB
    if (obj.type === 'person') {
      try {
        await fetch('http://localhost:5001/delete-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectId: id.toString() })
        });
      } catch (err) {
        console.warn('Face embedding deletion skipped (Python offline):', err.message);
      }
    }

    res.json({ message: 'Deleted successfully' });

  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ message: 'Server error during deletion' });
  }
};