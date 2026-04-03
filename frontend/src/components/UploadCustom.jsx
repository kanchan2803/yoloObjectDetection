import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function UploadCustom() {
  const navigate = useNavigate();
  const [objectName, setObjectName] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || !objectName) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('image', selectedImage);
    formData.append('label', objectName);

    // Grab the secure token we saved during login
    const token = localStorage.getItem('token');

    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}` // This proves to Express who we are
        },
        body: formData // The browser handles the complex multipart boundaries automatically!
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Successfully uploaded "${objectName}" to the database!`);
        navigate('/profile');
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

  return (
    <div style={styles.pageContainer}>
      <h1 style={styles.heading}>Teach the AI</h1>
      <p style={styles.text}>Upload a photo of a specific item or person you want the assistant to recognize.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label htmlFor="objectName" style={styles.label}>Name of Object/Person</label>
          <input 
            type="text" id="objectName" value={objectName}
            onChange={(e) => setObjectName(e.target.value)}
            placeholder="e.g., My Blue Water Bottle"
            style={styles.input} required
          />
        </div>

        <div style={styles.inputGroup}>
          <label htmlFor="imageUpload" style={styles.label}>Take or Select Photo</label>
          <input 
            type="file" id="imageUpload" accept="image/*"
            capture="environment" 
            onChange={handleImageChange}
            style={styles.fileInput} required
          />
        </div>

        {previewUrl && (
          <img src={previewUrl} alt="Preview" style={styles.imagePreview} />
        )}

        <button type="submit" style={styles.primaryButton} disabled={isUploading}>
          {isUploading ? "Uploading..." : "Save Custom Object"}
        </button>
        
        <button type="button" onClick={() => navigate('/profile')} style={styles.cancelButton}>
          Cancel
        </button>
      </form>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100dvh', backgroundColor: '#000000', color: '#FFFFFF', padding: '20px', fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: '32px', marginBottom: '10px', fontWeight: 'bold' },
  text: { fontSize: '18px', color: '#A1A1A6', marginBottom: '24px' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '18px', fontWeight: '600' },
  input: { padding: '16px', fontSize: '18px', borderRadius: '12px', border: '2px solid #38383A', backgroundColor: '#1C1C1E', color: '#FFFFFF' },
  fileInput: { padding: '16px', backgroundColor: '#1C1C1E', borderRadius: '12px', color: '#A1A1A6' },
  imagePreview: { width: '100%', height: '250px', objectFit: 'cover', borderRadius: '16px', border: '2px solid #38383A' },
  primaryButton: { padding: '18px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#32D74B', color: '#000000', border: 'none', borderRadius: '30px', cursor: 'pointer', marginTop: '10px' },
  cancelButton: { padding: '18px', fontSize: '20px', fontWeight: 'bold', backgroundColor: 'transparent', color: '#FFFFFF', border: 'none', cursor: 'pointer' }
};