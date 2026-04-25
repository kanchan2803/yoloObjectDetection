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
      imagePath: req.file.path
    });

    await newObject.save();

      // Trigger face embedding extraction in the Python service
      // We do this async — don't block the upload response
      try {
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