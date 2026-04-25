import CustomObject from '../models/CustomObject.js';

export const uploadObject = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const { label, baseLabel } = req.body;
    const userId = req.user.userId; 

    const newObject = new CustomObject({
      userId,
      label,
      baseLabel: (baseLabel || 'unknown').trim().toLowerCase(),
      imagePath: req.file.path
    });

    await newObject.save();

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
