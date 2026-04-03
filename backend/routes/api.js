import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';

// Import our named controller functions
import { register, login } from '../controllers/authController.js';
import { uploadObject , getObjects } from '../controllers/objectController.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 
  
  if (!token) return res.status(401).json({ message: 'Access Denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid Token' });
    req.user = user;
    next();
  });
};

router.post('/register', register);
router.post('/login', login);
router.post('/upload', authenticateToken, upload.single('image'), uploadObject);
router.get('/objects', authenticateToken, getObjects);
export default router;