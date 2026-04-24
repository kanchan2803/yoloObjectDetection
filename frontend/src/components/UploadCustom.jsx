import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar, { BottomNav } from './Navbar';
import Icon from './Icon';

export default function UploadCustom() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [objectName, setObjectName] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || !objectName) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('image', selectedImage);
    formData.append('label', objectName);

    const token = localStorage.getItem('token');

    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setUploadSuccess(true);
        setTimeout(() => navigate('/profile'), 1500);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error(error);
      alert('Upload failed. Is the server running?');
    } finally {
      setIsUploading(false);
    }
  };

  // Success state
  if (uploadSuccess) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'var(--success-muted)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 20
          }}>
            <Icon name="check_circle" fill size={40} style={{ color: 'var(--success)' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 8px' }}>Upload Successful!</h2>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 15 }}>
            "{objectName}" has been added to your collection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />

      <main style={{ paddingTop: 96, paddingBottom: 80 }} className="fade-in">
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Back link */}
          <button
            onClick={() => navigate('/profile')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', color: 'var(--primary)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              padding: 0, textTransform: 'uppercase', letterSpacing: 1, width: 'fit-content'
            }}
          >
            <Icon name="arrow_back" size={18} />
            Back to Profile
          </button>

          {/* Header */}
          <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 16,
              background: 'rgba(170,199,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name="upload" size={36} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Teach the AI</h1>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: 15, margin: 0 }}>
                Define and train custom objects for your visual environment.
              </p>
            </div>
          </header>

          {/* Form card */}
          <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Object name */}
            <div className="input-group">
              <label htmlFor="objectName" className="input-label">
                <Icon name="sell" size={14} /> Object Name
              </label>
              <input
                type="text" id="objectName" value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                className="input-field"
                placeholder="e.g. Favorite Coffee Mug"
                required
              />
            </div>

            {/* Photo upload */}
            <div className="input-group">
              <label className="input-label">
                <Icon name="photo_camera" size={14} /> Reference Images
              </label>

              {previewUrl ? (
                <div style={{
                  position: 'relative', borderRadius: 'var(--radius)',
                  overflow: 'hidden', border: '1px solid var(--outline-variant)',
                  aspectRatio: '16/9'
                }}>
                  <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button
                    type="button"
                    onClick={clearImage}
                    style={{
                      position: 'absolute', top: 10, right: 10,
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)', border: 'none',
                      color: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ) : (
                <div
                  className="upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-icon-circle">
                    <Icon name="add_a_photo" size={28} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15 }}>
                      Tap to upload photos
                    </p>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--outline)' }}>
                      Upload at least 5 angles of the object
                    </p>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file" accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                required={!selectedImage}
              />
            </div>

            {/* Training tip */}
            <div className="info-card">
              <Icon name="info" size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Training Tip</p>
                <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: 0, lineHeight: 1.6 }}>
                  Ensure good lighting and a clear background. The AI learns faster when you provide consistent visual context.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn btn-primary btn-lg"
                disabled={isUploading || !selectedImage || !objectName}
                style={{ opacity: (isUploading || !selectedImage || !objectName) ? 0.5 : 1 }}
              >
                {isUploading ? (
                  <>
                    <Icon name="progress_activity" size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Icon name="check_circle" fill size={20} />
                    Save Custom Object
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="btn btn-ghost btn-lg"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Footer meta */}
          <footer style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'rgba(139,145,160,0.5)', textTransform: 'uppercase', letterSpacing: 3 }}>
              Drishti Visual Engine v4.2.0
            </p>
          </footer>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
