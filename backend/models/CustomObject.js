import mongoose from 'mongoose';

const customObjectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  label: { type: String, required: true },
  imagePath: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('CustomObject', customObjectSchema);