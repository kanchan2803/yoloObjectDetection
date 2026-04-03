import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false); // Toggle between Login and Register
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isRegistering ? 'http://localhost:5000/api/register' : 'http://localhost:5000/api/login';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        if (isRegistering) {
          alert("Account created! You can now log in.");
          setIsRegistering(false);
          setPassword(''); // clear password field
        } else {
          // Success! Pass the user data AND the JWT token to our context
          login(data.user, data.token);
          navigate('/profile');
        }
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (err) {
      console.error(err);
      setError('Server is offline. Is your Node backend running?');
    }
  };

  return (
    <div style={styles.pageContainer}>
      <h1 style={styles.heading}>{isRegistering ? "Create Account" : "Sign In"}</h1>
      <p style={styles.text}>Welcome to your Offline Visual Assistant.</p>
      
      {error && <p style={styles.errorText}>{error}</p>}

      <form onSubmit={handleAuth} style={styles.form}>
        <div style={styles.inputGroup}>
          <label htmlFor="email" style={styles.label}>Email Address</label>
          <input 
            type="email" id="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input} required
          />
        </div>
        
        <div style={styles.inputGroup}>
          <label htmlFor="password" style={styles.label}>Password</label>
          <input 
            type="password" id="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input} required
          />
        </div>

        <button type="submit" style={styles.primaryButton}>
          {isRegistering ? "Register Account" : "Log In Securely"}
        </button>
      </form>
      
      <button 
        onClick={() => setIsRegistering(!isRegistering)} 
        style={styles.toggleButton}
      >
        {isRegistering ? "Already have an account? Log In" : "Need an account? Register Here"}
      </button>

      <button onClick={() => navigate('/')} style={styles.secondaryButton}>
        Cancel & Return to Camera
      </button>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100dvh', backgroundColor: '#000000', color: '#FFFFFF', padding: '20px', fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: '32px', marginBottom: '10px', fontWeight: 'bold' },
  text: { fontSize: '18px', color: '#A1A1A6', marginBottom: '20px' },
  errorText: { color: '#FF3B30', backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '24px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '18px', fontWeight: '600' },
  input: { padding: '16px', fontSize: '18px', borderRadius: '12px', border: '2px solid #38383A', backgroundColor: '#1C1C1E', color: '#FFFFFF' },
  primaryButton: { padding: '18px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#0A84FF', color: '#FFFFFF', border: 'none', borderRadius: '30px', cursor: 'pointer' },
  toggleButton: { padding: '16px', fontSize: '16px', color: '#0A84FF', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', marginTop: '10px', width: '100%' },
  secondaryButton: { padding: '18px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#38383A', color: '#FFFFFF', border: 'none', borderRadius: '30px', cursor: 'pointer', width: '100%', marginTop: '20px' }
};