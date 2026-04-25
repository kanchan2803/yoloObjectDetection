import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';
import { useState } from 'react';

export default function Navbar({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (path) => {
    setMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Detection', icon: 'visibility' },
    { path: '/upload', label: 'Upload', icon: 'upload' },
    { path: '/profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <>
      <header className="drishti-nav">
        <button className="nav-brand" onClick={() => handleNav('/')}>
          DRISHTI
        </button>

        {/* Desktop center nav */}
        <nav className="nav-links-desktop">
          {navItems.map(({ path, label }) => (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className={`nav-link ${isActive(path) ? 'nav-link-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right side */}
        <div className="nav-right">
          <button className="nav-icon-btn nav-home-shortcut" onClick={() => handleNav('/')}>
            <Icon name="visibility" size={22} />
          </button>
          {user ? (
            <button
              className="nav-avatar"
              onClick={() => handleNav('/profile')}
              title={user.email}
            >
              {user.email?.[0]?.toUpperCase() || 'U'}
            </button>
          ) : (
            <button
              className="nav-signin-btn"
              onClick={() => handleNav('/login')}
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Icon name={mobileMenuOpen ? 'close' : 'menu'} size={24} />
        </button>
      </header>

      {/* Mobile slide-down menu */}
      {mobileMenuOpen && (
        <div className="nav-mobile-menu">
          {navItems.map(({ path, label, icon }) => (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className={`nav-mobile-link ${isActive(path) ? 'nav-mobile-link-active' : ''}`}
            >
              <Icon name={icon} size={20} fill={isActive(path)} />
              <span>{label}</span>
            </button>
          ))}
          <div className="nav-mobile-divider" />
          {user ? (
            <button onClick={() => handleNav('/profile')} className="nav-mobile-link">
              <Icon name="account_circle" size={20} />
              <span>{user.email}</span>
            </button>
          ) : (
            <button onClick={() => handleNav('/login')} className="nav-mobile-link nav-mobile-link-accent">
              <Icon name="login" size={20} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** Standalone mobile bottom nav for non-camera pages */
export function BottomNav({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path) => {
    if (onNavigate) onNavigate(path);
    else navigate(path);
  };

  const isActive = (path) => location.pathname === path;

  const items = [
    { path: '/', label: 'Detection', icon: 'visibility' },
    { path: '/upload', label: 'Upload', icon: 'upload' },
    { path: '/profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <div className="bottom-nav">
      {items.map(({ path, label, icon }) => (
        <button
          key={path}
          onClick={() => handleNav(path)}
          className={`bottom-nav-item ${isActive(path) ? 'bottom-nav-item-active' : ''}`}
        >
          <Icon name={icon} size={24} fill={isActive(path)} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
