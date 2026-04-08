/**
 * Login — Cognito-based authentication with first-time password change support.
 */
import React, { useState, useEffect } from 'react';
import { signIn, getCurrentUser } from 'aws-amplify/auth';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    let mounted = true;
    
    const checkIfAlreadyLoggedIn = async () => {
      try {
        await getCurrentUser();
        // User is already logged in, redirect to home
        if (mounted) {
          navigate('/', { replace: true });
        }
      } catch (err) {
        // User is not logged in, stay on login page
      }
    };
    
    checkIfAlreadyLoggedIn();
    
    return () => {
      mounted = false;
    };
  }, []); // Remove navigate from dependencies to prevent loop

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { isSignedIn, nextStep } = await signIn({
        username: email,
        password: password
      });

      if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        // User needs to change password
        setRequiresNewPassword(true);
        setUser({ username: email });
        setLoading(false);
      } else if (isSignedIn) {
        // Login successful
        if (onLoginSuccess) {
          onLoginSuccess();
        }
        navigate('/', { replace: true });
      }
    } catch (err) {
      
      if (err.name === 'UserAlreadyAuthenticatedException') {
        // User is already authenticated, sign them out first then try again
        setError('Please wait, clearing previous session...');
        try {
          const { signOut } = await import('aws-amplify/auth');
          await signOut({ global: true });
          setError('Session cleared. Please try logging in again.');
          setLoading(false);
        } catch (signOutErr) {
          setError('Please refresh the page and try again.');
          setLoading(false);
        }
      } else {
        setError(err.message || 'Failed to login. Please check your credentials.');
        setLoading(false);
      }
    }
  };

  const handleNewPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { confirmSignIn } = await import('aws-amplify/auth');
      await confirmSignIn({ challengeResponse: newPassword });
      
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to change password');
      setLoading(false);
    }
  };

  if (requiresNewPassword) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Change Password</h2>
          <p className="info-text">You must change your password before continuing</p>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleNewPasswordSubmit}>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength="8"
                placeholder="Enter new password"
              />
              <small>Must be at least 8 characters with uppercase, lowercase, and numbers</small>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength="8"
                placeholder="Confirm new password"
              />
            </div>

            <button type="submit" disabled={loading} className="login-button">
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>IVF Witness Capture</h2>
        <p className="subtitle">Sign in to continue</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
          <p><Link to="/forgot-password">Forgot password?</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Login;
