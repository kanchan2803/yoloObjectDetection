import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Camera from './components/Camera.jsx';
import Login from './components/Login.jsx';
import Profile from './components/Profile.jsx';
import UploadCustom from './components/UploadCustom.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Camera />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/upload" element={<UploadCustom />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}