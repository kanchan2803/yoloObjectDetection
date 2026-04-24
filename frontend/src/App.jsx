import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import CameraView from './pages/CameraView.jsx';
import Login from './components/Login.jsx';
import Profile from './components/Profile.jsx';
import UploadCustom from './components/UploadCustom.jsx';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CameraView />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/upload" element={<UploadCustom />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
