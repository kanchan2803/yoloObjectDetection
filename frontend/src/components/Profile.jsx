import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // State to hold the data we fetch from the backend
  const [customObjects, setCustomObjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the user's custom objects when the page loads
  useEffect(() => {
    const fetchObjects = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch('http://localhost:5000/api/objects', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setCustomObjects(data);
        }
      } catch (error) {
        console.error("Failed to fetch custom objects:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchObjects();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div style={styles.pageContainer}>
      <h1 style={styles.heading}>Your Profile</h1>
      
      <div style={styles.infoCard}>
        <p style={styles.infoText}><strong>Account:</strong> {user.email}</p>
        <p style={styles.infoText}><strong>Status:</strong> {user.role}</p>
      </div>

      <div style={styles.actionSection}>
        <button onClick={() => navigate('/upload')} style={styles.actionButton}>
          ➕ Add New Custom Object
        </button>
        
        <button onClick={() => navigate('/')} style={styles.primaryButton}>
          📷 Open Camera Assistant
        </button>
      </div>

      {/* --- NEW: Display the Custom Objects Grid --- */}
      <h2 style={styles.subHeading}>My Taught Objects</h2>
      
      {isLoading ? (
        <p style={styles.text}>Loading your items...</p>
      ) : customObjects.length === 0 ? (
        <p style={styles.text}>You haven't taught the AI any custom objects yet.</p>
      ) : (
        <div style={styles.grid}>
          {customObjects.map((obj) => (
            <div key={obj._id} style={styles.card}>
              <img 
                // We point the image source directly to the Express static folder
                // The .replace() ensures it works on Windows machines which use backslashes
                src={`http://localhost:5000/${obj.imagePath.replace('\\', '/')}`} 
                alt={obj.label} 
                style={styles.cardImage}
              />
              <div style={styles.cardLabel}>{obj.label}</div>
            </div>
          ))}
        </div>
      )}
      {/* ----------------------------------------- */}

      <button onClick={handleLogout} style={styles.dangerButton}>
        Log Out
      </button>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100dvh', backgroundColor: '#000000', color: '#FFFFFF', padding: '20px', fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: '32px', marginBottom: '20px', fontWeight: 'bold' },
  subHeading: { fontSize: '24px', marginTop: '40px', marginBottom: '16px', fontWeight: 'bold', borderBottom: '1px solid #38383A', paddingBottom: '10px' },
  text: { fontSize: '18px', color: '#A1A1A6' },
  infoCard: { backgroundColor: '#1C1C1E', padding: '20px', borderRadius: '16px', marginBottom: '30px' },
  infoText: { fontSize: '18px', margin: '10px 0', color: '#EBEBF5' },
  actionSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
  actionButton: { padding: '18px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#32D74B', color: '#000000', border: 'none', borderRadius: '30px', cursor: 'pointer' },
  primaryButton: { padding: '18px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#0A84FF', color: '#FFFFFF', border: 'none', borderRadius: '30px', cursor: 'pointer' },
  dangerButton: { padding: '18px', fontSize: '20px', fontWeight: 'bold', backgroundColor: 'transparent', color: '#FF3B30', border: '2px solid #FF3B30', borderRadius: '30px', cursor: 'pointer', marginTop: '40px', width: '100%' },
  
  // New Grid Styles
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' },
  card: { backgroundColor: '#1C1C1E', borderRadius: '12px', overflow: 'hidden', border: '1px solid #38383A' },
  cardImage: { width: '100%', height: '150px', objectFit: 'cover' },
  cardLabel: { padding: '12px', fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }
};