import React, { useState } from 'react';
import { signUp, confirmSignUp } from 'aws-amplify/auth';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

function Signup() {
  const [step, setStep] = useState('signup'); // 'signup' or 'confirm'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    department: '',
    role: 'viewer'
  });
  const [confirmationCode, setConfirmationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username: formData.email,
        password: formData.password,
        options: {
          userAttributes: {
            email: formData.email,
            name: formData.name,
            'custom:role': formData.role,
            'custom:department': formData.department
          },
          autoSignIn: true
        }
      });


      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setStep('confirm');
        setLoading(false);
      } else if (isSignUpComplete) {
        navigate('/login');
      }
    } catch (err) {
      setError(err.message || 'Failed to sign up. Please try again.');
      setLoading(false);
    }
  };

  const handleConfirmSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { isSignUpComplete, nextStep } = await confirmSignUp({
        username: formData.email,
        confirmationCode: confirmationCode
      });

      if (isSignUpComplete) {
        navigate('/login', { 
          state: { message: 'Account confirmed! Please sign in.' }
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to confirm account. Please check the code.');
      setLoading(false);
    }
  };

  if (step === 'confirm') {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Confirm Your Account</h2>
          <p className="info-text">
            We've sent a confirmation code to {formData.email}
          </p>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleConfirmSignup}>
            <div className="form-group">
              <label>Confirmation Code</label>
              <input
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
                placeholder="Enter 6-digit code"
                maxLength="6"
              />
            </div>

            <button type="submit" disabled={loading} className="login-button">
              {loading ? 'Confirming...' : 'Confirm Account'}
            </button>
          </form>

          <div className="login-footer">
            <p><Link to="/login">Back to login</Link></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Create Account</h2>
        <p className="subtitle">Sign up for IVF Witness Capture</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label>Department</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              placeholder="e.g., Embryology, Lab"
            />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="supervisor">Supervisor</option>
              <option value="viewer">Viewer</option>
            </select>
            <small>Admin accounts must be created by an administrator</small>
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="8"
              placeholder="Enter password"
            />
            <small>Must be at least 8 characters with uppercase, lowercase, and numbers</small>
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength="8"
              placeholder="Confirm password"
            />
          </div>

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="login-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
