import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../utils/api';
import { initGoogleIdentityServices, renderGoogleButton, promptGoogleOneTap } from '../utils/googleAuth';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [infoMsg, setInfoMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) return;

        const setupGsi = () => {
            if (!initGoogleIdentityServices(clientId, handleGoogleCredentialResponse)) {
                return false;
            }
            const container = document.getElementById('google-register-btn-slot');
            if (container) {
                renderGoogleButton(container, {
                    theme: 'outline',
                    size: 'large',
                    width: 368,
                    text: 'signup_with',
                    shape: 'pill'
                });
            }
            return true;
        };

        if (!setupGsi()) {
            const interval = setInterval(() => {
                if (setupGsi()) clearInterval(interval);
            }, 100);
            const timer = setTimeout(() => clearInterval(interval), 5000);
            return () => {
                clearInterval(interval);
                clearTimeout(timer);
            };
        }
    }, []);

    const handleGoogleCredentialResponse = async (response) => {
        if (!response?.credential) return;
        setError('');
        setInfoMsg('');
        setLoading(true);
        try {
            const res = await axios.post(apiUrl('/api/auth/google'), {
                credential: response.credential
            });
            if (res.data?.token) {
                localStorage.setItem('token', res.data.token);
                if (res.data?.user) {
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                }
                if (res.data.user?.hasCompletedOnboarding) {
                    navigate('/dashboard');
                } else {
                    navigate('/onboarding');
                }
            }
        } catch (err) {
            setError(err.response?.data?.msg || err.response?.data?.error || 'Google registration failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleManualGoogleClick = () => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (clientId && window.google?.accounts?.id) {
            initGoogleIdentityServices(clientId, handleGoogleCredentialResponse);
            promptGoogleOneTap((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    setInfoMsg('Google prompt not displayed. Ensure http://localhost:5173 is authorized in Google Cloud Console, or create your account below with Email & Password.');
                }
            });
        } else if (!clientId) {
            setInfoMsg('Google OAuth Client ID is not configured in environment variables (VITE_GOOGLE_CLIENT_ID). You can create your account below with Email & Password.');
        } else {
            setInfoMsg('Google Sign-In library is loading. Please wait a moment or sign up with Email and Password.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfoMsg('');

        if (formData.password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(apiUrl('/api/auth/register'), formData);
            if (res.data?.token) {
                localStorage.setItem('token', res.data.token);
                if (res.data?.user) {
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                }
                navigate('/onboarding');
            } else {
                setError('Registration succeeded but authentication token was missing.');
            }
        } catch (err) {
            if (!err.response) {
                setError('Unable to reach backend server. Please ensure port 5000 is active.');
            } else {
                setError(err.response?.data?.msg || err.response?.data?.error || 'Registration failed.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card-container" style={{ minHeight: '100vh', background: 'var(--bg-main, #F7F4EE)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="auth-card"
                style={{ 
                    width: '100%', 
                    maxWidth: '440px', 
                    background: '#ffffff', 
                    borderRadius: '24px', 
                    border: '1px solid var(--border, #E2DCD5)', 
                    boxShadow: '0 8px 30px rgba(24, 54, 48, 0.06)' 
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        background: '#183630', 
                        color: '#E5C690', 
                        padding: '8px 16px', 
                        borderRadius: '20px', 
                        marginBottom: '16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '1px'
                    }}>
                        <Sparkles size={15} color="#E5C690" />
                        <span>FINWISE AI</span>
                    </div>
                    <h1 style={{ 
                        fontSize: '28px', 
                        letterSpacing: '-0.01em',
                        margin: '0 0 8px 0', 
                        color: 'var(--text-main, #183630)' 
                    }}>
                        Create Account
                    </h1>
                    <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '14px', margin: 0 }}>
                        Start tracking your wealth and safe runway
                    </p>
                </div>

                {error && (
                    <div style={{ 
                        padding: '12px 16px', 
                        background: '#fef2f2', 
                        border: '1px solid #fca5a5', 
                        borderRadius: '12px', 
                        color: '#dc2626', 
                        fontSize: '13px', 
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {infoMsg && (
                    <div style={{ 
                        padding: '12px 16px', 
                        background: '#f0fdf4', 
                        border: '1px solid #86efac', 
                        borderRadius: '12px', 
                        color: '#166534', 
                        fontSize: '12px', 
                        lineHeight: 1.4,
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px'
                    }}>
                        <span>ℹ️</span>
                        <span>{infoMsg}</span>
                    </div>
                )}

                {/* Google Sign-Up Option */}
                <div style={{ marginBottom: '18px' }}>
                    <div id="google-register-btn-slot" style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                            type="button"
                            onClick={handleManualGoogleClick}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                background: '#ffffff',
                                border: '1px solid var(--border, #E2DCD5)',
                                borderRadius: '12px',
                                color: 'var(--text-main, #183630)',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background 0.2s, box-shadow 0.2s',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#F9F8F6'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            <span>Sign up with Google</span>
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '12px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border, #E2DCD5)' }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted, #94A3B8)', fontWeight: 700, letterSpacing: '0.5px' }}>OR SIGN UP WITH EMAIL</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border, #E2DCD5)' }} />
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label 
                            htmlFor="register-name" 
                            style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}
                        >
                            Full Name
                        </label>
                        <input 
                            id="register-name"
                            type="text" 
                            className="input-wrapper" 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})} 
                            required 
                            aria-label="Full Name"
                            style={{ height: '44px', fontSize: '14px' }}
                        />
                    </div>

                    <div>
                        <label 
                            htmlFor="register-email" 
                            style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}
                        >
                            Email Address
                        </label>
                        <input 
                            id="register-email"
                            type="email" 
                            className="input-wrapper" 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})} 
                            required 
                            aria-label="Email Address"
                            style={{ height: '44px', fontSize: '14px' }}
                        />
                    </div>

                    <div>
                        <label 
                            htmlFor="register-password" 
                            style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}
                        >
                            Password (minimum 6 characters)
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                id="register-password"
                                type={showPassword ? 'text' : 'password'} 
                                className="input-wrapper" 
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                                required 
                                minLength={6}
                                aria-label="Password"
                                style={{ height: '44px', fontSize: '14px', paddingRight: '44px' }}
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ 
                                    position: 'absolute', 
                                    right: '12px', 
                                    top: '50%', 
                                    transform: 'translateY(-50%)', 
                                    background: 'none', 
                                    border: 'none', 
                                    color: 'var(--text-muted, #94A3B8)', 
                                    cursor: 'pointer',
                                    display: 'grid',
                                    placeItems: 'center',
                                    padding: '4px'
                                }}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label 
                            htmlFor="register-confirm-password" 
                            style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}
                        >
                            Confirm Password
                        </label>
                        <input 
                            id="register-confirm-password"
                            type={showPassword ? 'text' : 'password'} 
                            className="input-wrapper" 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            required 
                            minLength={6}
                            aria-label="Confirm Password"
                            style={{ height: '44px', fontSize: '14px' }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn-action" 
                        disabled={loading} 
                        style={{ 
                            width: '100%', 
                            padding: '14px', 
                            fontSize: '15px', 
                            fontWeight: 700,
                            marginTop: '8px', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: '8px',
                            background: '#183630',
                            color: '#ffffff',
                            borderRadius: '12px',
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? 'Creating Account...' : 'Register'} <ArrowRight size={18} />
                    </button>
                </form>

                <div style={{ marginTop: '28px', textAlign: 'center', borderTop: '1px solid var(--border, #E2DCD5)', paddingTop: '20px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748B)' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: '#183630', fontWeight: 700, textDecoration: 'none' }}>
                            Sign in
                        </Link>
                    </span>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;
