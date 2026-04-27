import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar, { BottomNav } from './Navbar';
import Icon from './Icon';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();

  const [customObjects, setCustomObjects] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchObjects = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setIsDataLoading(false); return; }

      try {
        const response = await fetch('http://localhost:5000/api/objects', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setCustomObjects(data);
        }
      } catch (error) {
        console.error("Failed to fetch custom objects:", error);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchObjects();
  }, [user]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this item from Drishti?')) return;

    setDeletingId(id);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`http://localhost:5000/api/objects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setCustomObjects(prev => prev.filter(obj => obj._id !== id));
      } else {
        const data = await response.json();
        alert(`Failed to delete: ${data.message}`);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Could not reach server.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="progress_activity" size={32} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  const persons = customObjects.filter(o => o.type === 'person');
  const objects = customObjects.filter(o => o.type === 'object' || !o.type);

  const ObjectCard = ({ obj }) => (
    <div
      key={obj._id}
      className="card"
      style={{
        padding: 0, overflow: 'hidden',
        cursor: 'default', transition: 'var(--transition)',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(53,53,53,0.2)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Type badge */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        background: obj.type === 'person'
          ? 'rgba(170,199,255,0.85)'
          : 'rgba(53,53,53,0.85)',
        borderRadius: 6, padding: '2px 8px',
        fontSize: 10, fontWeight: 700,
        color: obj.type === 'person' ? '#003064' : 'var(--on-surface)',
        zIndex: 2, textTransform: 'uppercase', letterSpacing: 0.5
      }}>
        {obj.type === 'person' ? 'Person' : 'Object'}
      </div>

      {/* Delete button */}
      <button
        onClick={() => handleDelete(obj._id)}
        disabled={deletingId === obj._id}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(147,0,10,0.85)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
          opacity: deletingId === obj._id ? 0.5 : 1,
          transition: 'var(--transition)'
        }}
        title="Remove this item"
      >
        {deletingId === obj._id
          ? <Icon name="progress_activity" size={14} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />
          : <Icon name="close" size={14} style={{ color: '#fff' }} />
        }
      </button>

      <img
        src={`http://localhost:5000/${obj.imagePath.replace(/\\/g, '/')}`}
        alt={obj.label}
        style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
      />

      <div style={{
        padding: '10px 12px', fontSize: 14, fontWeight: 700,
        textAlign: 'center', display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: 6
      }}>
        <Icon
          name={obj.type === 'person' ? 'face' : 'inventory_2'}
          size={14}
          style={{ color: 'var(--outline)' }}
        />
        {obj.label}
      </div>
    </div>
  );

  const SectionHeader = ({ icon, label, count }) => (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} size={18} style={{ color: 'var(--primary)' }} />
        <p style={{
          fontSize: 13, fontWeight: 700, color: 'var(--primary)',
          textTransform: 'uppercase', letterSpacing: 1, margin: 0
        }}>
          {label}
        </p>
      </div>
      <span style={{
        background: 'var(--surface-container-highest)',
        padding: '2px 10px', borderRadius: 'var(--radius-full)',
        fontSize: 11, fontWeight: 700,
        color: 'var(--on-surface-variant)',
        textTransform: 'uppercase', letterSpacing: 1
      }}>
        {count}
      </span>
    </div>
  );

  return (
    <div className="page-container">
      <Navbar />

      <div className="page-content page-content-wide">

        {/* Profile header card */}
        <div className="card" style={{
          display: 'flex', alignItems: 'center',
          gap: 24, marginBottom: 24, padding: '28px 32px'
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #AAC7FF, #3E90FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '3px solid var(--surface-container-highest)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            }}>
              <Icon name="person" size={36} style={{ color: 'var(--on-primary)' }} />
            </div>
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--primary-container)',
              border: '2px solid var(--surface-container-low)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Icon name="verified" fill size={14} style={{ color: '#fff' }} />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: 28, fontWeight: 900,
              margin: '0 0 8px', letterSpacing: '-0.02em'
            }}>
              Visual Navigator
            </h1>
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 8, color: 'var(--on-surface-variant)', fontSize: 14
            }}>
              <span>{user.email}</span>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--primary)', opacity: 0.6
              }} />
            </div>

            {/* Summary counts */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="face" size={14} style={{ color: 'var(--outline)' }} />
                <span style={{ fontSize: 12, color: 'var(--outline)' }}>
                  {persons.length} {persons.length === 1 ? 'person' : 'people'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="inventory_2" size={14} style={{ color: 'var(--outline)' }} />
                <span style={{ fontSize: 12, color: 'var(--outline)' }}>
                  {objects.length} {objects.length === 1 ? 'object' : 'objects'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 12, marginBottom: 32
        }}>
          <button
            onClick={() => navigate('/upload')}
            className="btn btn-outline btn-lg"
            style={{ gap: 8 }}
          >
            <Icon name="model_training" size={20} />
            Teach AI
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary btn-lg"
            style={{ gap: 8 }}
          >
            <Icon name="photo_camera" size={20} />
            Open Camera
          </button>
        </div>

        {/* Taught items section */}
        <div style={{ marginBottom: 40 }}>

          {/* Total count header */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 24
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
              My Taught Items
            </h2>
            <span style={{
              background: 'var(--surface-container-highest)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: 11, fontWeight: 700,
              color: 'var(--on-surface-variant)',
              textTransform: 'uppercase', letterSpacing: 1
            }}>
              {customObjects.length} Total
            </span>
          </div>

          {isDataLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Icon
                name="progress_activity"
                size={32}
                style={{ color: 'var(--outline)', animation: 'spin 1s linear infinite' }}
              />
              <p style={{ color: 'var(--outline)', marginTop: 12, fontSize: 14 }}>
                Loading your items...
              </p>
            </div>

          ) : customObjects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Icon name="center_focus_weak" size={32} style={{ color: 'var(--outline)' }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Nothing taught yet
              </p>
              <p style={{
                fontSize: 14, color: 'var(--outline)',
                margin: 0, maxWidth: 320, lineHeight: 1.6, textAlign: 'center'
              }}>
                Teach Drishti to recognize people and personal objects
                for a fully personalized experience.
              </p>
              <button
                onClick={() => navigate('/upload')}
                style={{
                  background: 'none', border: 'none', color: 'var(--primary)',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  textTransform: 'uppercase', letterSpacing: 1, marginTop: 8
                }}
              >
                Get started <Icon name="arrow_forward" size={16} />
              </button>
            </div>

          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

              {/* People subsection */}
              {persons.length > 0 && (
                <div>
                  <SectionHeader icon="face" label="People" count={persons.length} />
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 14
                  }}>
                    {persons.map(obj => <ObjectCard key={obj._id} obj={obj} />)}
                  </div>
                </div>
              )}

              {/* Divider between sections */}
              {persons.length > 0 && objects.length > 0 && (
                <div style={{
                  height: 1,
                  background: 'var(--outline-variant)'
                }} />
              )}

              {/* Objects subsection */}
              {objects.length > 0 && (
                <div>
                  <SectionHeader icon="inventory_2" label="Objects" count={objects.length} />
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 14
                  }}>
                    {objects.map(obj => <ObjectCard key={obj._id} obj={obj} />)}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{
          height: 1,
          background: 'var(--outline-variant)',
          margin: '8px 0 24px'
        }} />

        {/* Sign Out */}
        <button
          onClick={handleLogout}
          className="btn btn-danger btn-lg"
          style={{ gap: 8 }}
        >
          <Icon name="logout" size={20} />
          Sign Out
        </button>

      </div>

      <BottomNav />
    </div>
  );
}