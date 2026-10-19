import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Briefcase, MapPin, IndianRupee, Calendar, 
  Edit3, Save, X, Navigation, CheckCircle2, ShieldCheck, 
  Sparkles, RefreshCw, Key, AlertTriangle, Trash2, Link2, Unlink, Lock, Eye, EyeOff
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { apiUrl, authConfig } from '../utils/api';
import { formatINR } from '../utils/currency';
import { useNotification } from '../context/NotificationContext';
import { initGoogleIdentityServices, promptGoogleOneTap } from '../utils/googleAuth';

const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Tier 2', 'Tier 3'];

export default function Profile() {
  const navigate = useNavigate();
  const { showToast } = useNotification();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    location: 'Tier 2',
    locationRegion: '',
    locationSource: 'manual',
    userType: 'Student',
    openingBalance: 0,
    openingBalanceDate: new Date().toISOString().slice(0, 10),
    income: 0,
    authProvider: 'local',
    isGoogleConnected: false,
    hasPassword: true
  });

  const [editForm, setEditForm] = useState({ ...profile });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(apiUrl('/api/auth/profile'), authConfig());
      setProfile(data);
      setEditForm({
        name: data.name || '',
        email: data.email || '',
        location: data.location || 'Tier 2',
        locationRegion: data.locationRegion || '',
        locationSource: data.locationSource || 'manual',
        userType: data.userType || 'Student',
        openingBalance: data.openingBalance ?? 0,
        openingBalanceDate: data.openingBalanceDate ? new Date(data.openingBalanceDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        income: data.income ?? 0
      });
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to load profile settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkGoogle = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId && window.google?.accounts?.id) {
      initGoogleIdentityServices(clientId, async (response) => {
        if (!response?.credential) return;
        try {
          const { data } = await axios.post(
            apiUrl('/api/auth/link-google'),
            { credential: response.credential },
            authConfig()
          );
          if (data.profile) {
            setProfile(prev => ({ ...prev, ...data.profile }));
            localStorage.setItem('user', JSON.stringify({ ...profile, ...data.profile }));
          }
          showToast(data.msg || 'Google account linked successfully!', 'success');
        } catch (err) {
          showToast(err.response?.data?.error || 'Failed to link Google account.', 'error');
        }
      });
      promptGoogleOneTap((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          showToast('Google Sign-In prompt was not displayed. Ensure http://localhost:5173 is authorized in Google Cloud Console.', 'error');
        }
      });
    } else if (!clientId) {
      showToast('Google OAuth Client ID is not configured in environment variables (VITE_GOOGLE_CLIENT_ID).', 'info');
    } else {
      showToast('Google Sign-In library is loading. Please wait a moment.', 'info');
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!profile.hasPassword) {
      showToast('Cannot disconnect Google account without setting a local password first.', 'error');
      return;
    }
    try {
      const { data } = await axios.post(apiUrl('/api/auth/unlink-google'), {}, authConfig());
      if (data.profile) {
        setProfile(prev => ({ ...prev, ...data.profile }));
        localStorage.setItem('user', JSON.stringify({ ...profile, ...data.profile }));
      }
      showToast('Google account disconnected successfully.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to disconnect Google account.', 'error');
    }
  };

  const handleDeleteAccountSubmit = async (e) => {
    e.preventDefault();
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type "DELETE" exactly to confirm.');
      return;
    }
    if (profile.hasPassword && !deletePassword) {
      setDeleteError('Please enter your account password.');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');
    try {
      await axios.delete(apiUrl('/api/auth/delete-account'), {
        headers: authConfig().headers,
        data: {
          confirmation: deleteConfirmText,
          password: deletePassword
        }
      });
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setShowDeleteModal(false);
      showToast('Your account and personal data have been permanently deleted.', 'info');
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.response?.data?.msg || 'Failed to delete account. Please verify your password.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartEdit = () => {
    setEditForm({
      name: profile.name || '',
      email: profile.email || '',
      location: profile.location || 'Tier 2',
      locationRegion: profile.locationRegion || '',
      locationSource: profile.locationSource || 'manual',
      userType: profile.userType || 'Student',
      openingBalance: profile.openingBalance ?? 0,
      openingBalanceDate: profile.openingBalanceDate ? new Date(profile.openingBalanceDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      income: profile.income ?? 0
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditForm({
      name: profile.name || '',
      email: profile.email || '',
      location: profile.location || 'Tier 2',
      locationRegion: profile.locationRegion || '',
      locationSource: profile.locationSource || 'manual',
      userType: profile.userType || 'Student',
      openingBalance: profile.openingBalance ?? 0,
      openingBalanceDate: profile.openingBalanceDate ? new Date(profile.openingBalanceDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      income: profile.income ?? 0
    });
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.location.trim()) {
      showToast('Name and city location are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        location: editForm.location.trim(),
        userType: editForm.userType,
        openingBalance: Number(editForm.openingBalance) || 0,
        openingBalanceDate: editForm.openingBalanceDate
      };
      const { data } = await axios.put(apiUrl('/api/auth/profile'), payload, authConfig());
      setProfile(data);
      localStorage.setItem('user', JSON.stringify(data));
      setIsEditing(false);
      showToast('Profile and settings updated successfully.', 'success');
      window.dispatchEvent(new Event('transactions-changed'));
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to save profile changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser. Please select your city manually.', 'error');
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { data } = await axios.post(
            apiUrl('/api/auth/detect-location'),
            { latitude: coords.latitude, longitude: coords.longitude },
            authConfig()
          );
          setProfile(prev => ({ ...prev, ...data }));
          setEditForm(prev => ({
            ...prev,
            location: data.location,
            locationRegion: data.locationRegion,
            locationSource: 'geolocation'
          }));
          localStorage.setItem('user', JSON.stringify({ ...profile, ...data }));
          showToast(`Location detected: ${data.location}${data.locationRegion ? `, ${data.locationRegion}` : ''}`, 'success');
        } catch (err) {
          showToast(err.response?.data?.error || 'Unable to detect city from coordinates. Please select manually.', 'error');
        } finally {
          setDetecting(false);
        }
      },
      (geoErr) => {
        setDetecting(false);
        const msg = geoErr.code === geoErr.PERMISSION_DENIED
          ? 'Location permission was denied. Please select your city manually.'
          : 'Unable to access your GPS position. Please select your city manually.';
        showToast(msg, 'error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const locationOptions = CITIES.includes(editForm.location) ? CITIES : [editForm.location, ...CITIES];

  return (
    <div style={{ display: 'flex', background: 'var(--bg-main, #F7F4EE)', minHeight: '100vh', color: 'var(--text-main, #183630)' }}>
      <Sidebar />

      <main className="app-main">
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="stitch-badge badge-dark" style={{ background: '#183630', color: '#E5C690' }}>
                <ShieldCheck size={13} /> PROFILE & ACCOUNT
              </span>
            </div>
            <h1 style={{ fontSize: '30px', margin: 0, color: 'var(--text-main, #183630)' }}>
              Account Settings
            </h1>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
              Manage your personal identity, living cost tier, and baseline financial runway.
            </p>
          </div>

          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="btn-action"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 22px',
                fontSize: '14px',
                fontWeight: 700,
                background: '#183630',
                color: '#ffffff',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              <Edit3 size={16} /> Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn-secondary"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                <X size={16} /> Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-action"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 22px',
                  fontSize: '14px',
                  fontWeight: 700,
                  background: '#183630',
                  color: '#ffffff',
                  borderRadius: '12px',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                <Save size={16} /> {saving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          )}
        </header>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 12px', color: '#183630' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading account profile...</p>
          </div>
        ) : (
          <div style={{ maxWidth: '820px' }}>
            
            {/* User Identity Banner Card */}
            <div 
              className="bento-card" 
              style={{ 
                background: '#ffffff', 
                padding: '28px 32px', 
                marginBottom: '28px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px',
                border: '1px solid var(--border, #E2DCD5)',
                boxShadow: '0 4px 20px rgba(24, 54, 48, 0.04)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #183630 0%, #2e5a44 100%)', 
                  color: '#E5C690', 
                  display: 'grid', 
                  placeItems: 'center', 
                  fontWeight: 800, 
                  fontSize: '24px',
                  border: '2px solid #E5C690'
                }}>
                  {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-main, #183630)' }}>
                    {profile.name || 'FinWise User'}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748B)' }}>
                      {profile.email}
                    </span>
                    <span style={{ fontSize: '12px', background: '#F0EBE1', color: '#183630', padding: '2px 10px', borderRadius: '12px', fontWeight: 600 }}>
                      {profile.userType || 'Student'}
                    </span>
                    <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '2px 10px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} /> Verified Identity
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', display: 'block' }}>
                  Current City
                </span>
                <strong style={{ fontSize: '18px', color: '#183630', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <MapPin size={16} color="#059669" /> {profile.location || 'Tier 2'}
                </strong>
                {profile.locationRegion && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>
                    {profile.locationRegion}
                  </span>
                )}
              </div>
            </div>

            {/* Read-Only Mode */}
            {!isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* SECTION 1: ACCOUNT & IDENTITY */}
                <div className="bento-card" style={{ background: '#ffffff', padding: '28px 32px', border: '1px solid var(--border, #E2DCD5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border, #E2DCD5)' }}>
                    <div style={{ background: '#F0EBE1', padding: '8px', borderRadius: '10px', color: '#183630' }}>
                      <User size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main, #183630)' }}>Account & Identity</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Personal details and portal credentials</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Full Name</span>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main, #183630)' }}>{profile.name || 'Not provided'}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email Address</span>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main, #183630)' }}>{profile.email || 'Not provided'}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Account Classification</span>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main, #183630)' }}>{profile.userType || 'Student'}</strong>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: REGIONAL & LIVING COST TIER */}
                <div className="bento-card" style={{ background: '#ffffff', padding: '28px 32px', border: '1px solid var(--border, #E2DCD5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border, #E2DCD5)', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#F0EBE1', padding: '8px', borderRadius: '10px', color: '#183630' }}>
                        <MapPin size={18} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main, #183630)' }}>Regional & Living Cost Tier</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Determines benchmark dining, transit, and rental cost thresholds</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={detectLocation}
                      disabled={detecting}
                      className="btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '10px',
                        cursor: detecting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Navigation size={14} className={detecting ? 'spin-icon' : ''} />
                      {detecting ? 'Detecting via GPS...' : 'Auto-Detect via GPS'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Active City / Tier</span>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main, #183630)' }}>{profile.location || 'Tier 2'}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Detected State / Region</span>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main, #183630)' }}>{profile.locationRegion || 'Standard Region'}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Configuration Mode</span>
                      <span style={{ fontSize: '12px', background: profile.locationSource === 'geolocation' ? 'rgba(16, 185, 129, 0.1)' : '#F0EBE1', color: profile.locationSource === 'geolocation' ? '#059669' : '#183630', padding: '3px 10px', borderRadius: '8px', fontWeight: 700, display: 'inline-block' }}>
                        {profile.locationSource === 'geolocation' ? '📍 GPS Auto-Configured' : '⚙️ Manually Selected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: FINANCIAL BASELINE */}
                <div className="bento-card" style={{ background: '#ffffff', padding: '28px 32px', border: '1px solid var(--border, #E2DCD5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border, #E2DCD5)' }}>
                    <div style={{ background: '#F0EBE1', padding: '8px', borderRadius: '10px', color: '#183630' }}>
                      <IndianRupee size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main, #183630)' }}>Financial Baseline & Safe Runway</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Opening balance anchor used to calculate safe daily liquidity</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Opening Balance</span>
                      <strong style={{ fontSize: '18px', color: '#059669', fontWeight: 800 }}>{formatINR(profile.openingBalance ?? 0)}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Baseline Effective Date</span>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main, #183630)' }}>
                        {profile.openingBalanceDate ? new Date(profile.openingBalanceDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Initial account registration'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Monthly Income / Allowance</span>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main, #183630)' }}>{formatINR(profile.income ?? 0)}</strong>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              /* Edit Mode Form */
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* SECTION 1: ACCOUNT & IDENTITY */}
                <div className="bento-card" style={{ background: '#ffffff', padding: '28px 32px', border: '1px solid var(--border, #E2DCD5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border, #E2DCD5)' }}>
                    <div style={{ background: '#F0EBE1', padding: '8px', borderRadius: '10px', color: '#183630' }}>
                      <User size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main, #183630)' }}>Edit Account & Identity</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Update your name and career profile</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                    <div>
                      <label htmlFor="edit-name" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}>
                        Full Name
                      </label>
                      <input 
                        id="edit-name"
                        className="input-wrapper" 
                        value={editForm.name} 
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                        required 
                        aria-label="Full Name"
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-email" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}>
                        Email Address (Read-Only)
                      </label>
                      <input 
                        id="edit-email"
                        className="input-wrapper" 
                        value={editForm.email} 
                        disabled 
                        style={{ background: '#F8FAFC', color: 'var(--text-muted, #64748B)', cursor: 'not-allowed' }}
                        aria-label="Email Address"
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-usertype" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}>
                        Account Classification
                      </label>
                      <select 
                        id="edit-usertype"
                        className="input-wrapper" 
                        value={editForm.userType} 
                        onChange={e => setEditForm({ ...editForm, userType: e.target.value })}
                        aria-label="Account Classification"
                      >
                        <option value="Student">Student</option>
                        <option value="Working Professional">Working Professional</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: REGIONAL & LIVING COST TIER */}
                <div className="bento-card" style={{ background: '#ffffff', padding: '28px 32px', border: '1px solid var(--border, #E2DCD5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border, #E2DCD5)', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#F0EBE1', padding: '8px', borderRadius: '10px', color: '#183630' }}>
                        <MapPin size={18} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main, #183630)' }}>Edit Regional & Living Cost Tier</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Select city or use GPS auto-detect</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={detectLocation}
                      disabled={detecting}
                      className="btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '10px',
                        cursor: detecting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Navigation size={14} className={detecting ? 'spin-icon' : ''} />
                      {detecting ? 'Detecting via GPS...' : 'Auto-Detect via GPS'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                    <div>
                      <label htmlFor="edit-location" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}>
                        City / Living Region
                      </label>
                      <select 
                        id="edit-location"
                        className="input-wrapper" 
                        value={editForm.location} 
                        onChange={e => setEditForm({ ...editForm, location: e.target.value, locationSource: 'manual' })}
                        aria-label="City Location"
                      >
                        {locationOptions.map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>

                    {editForm.locationRegion && (
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}>
                          Detected State / Region
                        </label>
                        <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '10px', fontSize: '14px', color: 'var(--text-muted, #64748B)' }}>
                          {editForm.locationRegion}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 3: FINANCIAL BASELINE */}
                <div className="bento-card" style={{ background: '#ffffff', padding: '28px 32px', border: '1px solid var(--border, #E2DCD5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border, #E2DCD5)' }}>
                    <div style={{ background: '#F0EBE1', padding: '8px', borderRadius: '10px', color: '#183630' }}>
                      <IndianRupee size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main, #183630)' }}>Edit Financial Baseline</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Configure opening balance used for available safe calculations</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                    <div>
                      <label htmlFor="edit-opening-balance" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}>
                        Opening Balance (INR ₹)
                      </label>
                      <input 
                        id="edit-opening-balance"
                        type="number" 
                        min="0" 
                        step="0.01" 
                        className="input-wrapper" 
                        value={editForm.openingBalance} 
                        onChange={e => setEditForm({ ...editForm, openingBalance: e.target.value })} 
                        required 
                        aria-label="Opening Balance in INR"
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-balance-date" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', marginBottom: '6px', display: 'block' }}>
                        Balance As Of Date
                      </label>
                      <input 
                        id="edit-balance-date"
                        type="date" 
                        className="input-wrapper" 
                        value={editForm.openingBalanceDate} 
                        onChange={e => setEditForm({ ...editForm, openingBalanceDate: e.target.value })} 
                        required 
                        aria-label="Balance Date"
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn-secondary"
                    disabled={saving}
                    style={{ padding: '12px 24px', fontSize: '14px', borderRadius: '12px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-action"
                    disabled={saving}
                    style={{
                      padding: '12px 28px',
                      fontSize: '14px',
                      fontWeight: 700,
                      background: '#183630',
                      color: '#ffffff',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>

              </form>
            )}

            {/* SECTION 4: AUTHENTICATION & CONNECTED ACCOUNTS */}
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="bento-card" style={{ background: '#ffffff', padding: '28px 32px', border: '1px solid var(--border, #E2DCD5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border, #E2DCD5)', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#F0EBE1', padding: '8px', borderRadius: '10px', color: '#183630' }}>
                      <Key size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main, #183630)' }}>Authentication & Security</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Sign-in methods, OAuth connections, and credentials</span>
                    </div>
                  </div>

                  {profile.isGoogleConnected && (
                    <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '4px 12px', borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCircle2 size={13} /> Google account connected
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Active Sign-In Method</span>
                    <strong style={{ fontSize: '15px', color: 'var(--text-main, #183630)', display: 'block' }}>
                      {profile.authProvider === 'both' ? 'Email & Password + Google Linked' : profile.authProvider === 'google' ? 'Google Account' : 'Email & Password'}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)', marginTop: '2px', display: 'block' }}>
                      {profile.hasPassword ? 'Local credentials active' : 'Passwordless single sign-on'}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Google Integration</span>
                    {profile.isGoogleConnected ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <strong style={{ fontSize: '14px', color: '#059669' }}>Connected</strong>
                        </div>
                        {profile.hasPassword && (
                          <button
                            type="button"
                            onClick={handleUnlinkGoogle}
                            style={{
                              fontSize: '12px',
                              color: '#dc2626',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600
                            }}
                          >
                            <Unlink size={12} /> Disconnect Google
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={handleLinkGoogle}
                          className="btn-secondary"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          Link Google Account
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Password Protection</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {profile.hasPassword ? (
                        <>
                          <Lock size={14} color="#059669" />
                          <strong style={{ fontSize: '14px', color: 'var(--text-main, #183630)' }}>Configured</strong>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} color="#64748B" />
                          <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748B)' }}>Google SSO Only</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 5: DANGER ZONE */}
              <div 
                className="bento-card" 
                style={{ 
                  background: '#ffffff', 
                  padding: '28px 32px', 
                  border: '1px solid #fca5a5',
                  boxShadow: '0 4px 20px rgba(220, 38, 38, 0.04)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #fee2e2', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '10px', color: '#dc2626' }}>
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#dc2626' }}>Danger Zone</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Irreversible actions regarding your account and records</span>
                    </div>
                  </div>

                  <span style={{ fontSize: '11px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: '8px', fontWeight: 800, letterSpacing: '0.5px' }}>
                    IRREVERSIBLE
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                  <div style={{ maxWidth: '520px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-main, #183630)' }}>
                      Delete Account & Personal Data
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748B)', margin: 0, lineHeight: 1.5 }}>
                      Permanently wipe your profile, personal transaction ledger, financial goals, travel plans, and What-If scenarios. Shared trip history for collaborative groups you participated in will be safely preserved for remaining members.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError('');
                      setDeleteConfirmText('');
                      setDeletePassword('');
                      setShowDeleteModal(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontWeight: 700,
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#b91c1c'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#dc2626'; }}
                  >
                    <Trash2 size={16} /> Delete Account
                  </button>
                </div>
              </div>
            </div>

            {/* Delete Account Confirmation Modal */}
            <AnimatePresence>
              {showDeleteModal && (
                <div 
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget && !isDeleting) setShowDeleteModal(false);
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      width: '100%',
                      maxWidth: '500px',
                      background: '#ffffff',
                      borderRadius: '20px',
                      padding: '32px',
                      border: '1px solid var(--border, #E2DCD5)',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                      color: 'var(--text-main, #183630)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center' }}>
                          <AlertTriangle size={22} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', letterSpacing: '0.5px' }}>
                            PERMANENT ACCOUNT DELETION
                          </span>
                          <h2 style={{ fontSize: '20px', fontWeight: 400, margin: '2px 0 0 0', color: 'var(--text-main, #183630)' }}>
                            Are you absolutely sure?
                          </h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setShowDeleteModal(false)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94A3B8)', cursor: 'pointer', padding: '4px' }}
                        aria-label="Close dialog"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748B)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                      This operation cannot be undone. Before proceeding, review how your data is handled:
                    </p>

                    <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid var(--border, #E2DCD5)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🗑️</span>
                        <div style={{ fontSize: '12px', color: 'var(--text-main, #183630)', lineHeight: 1.4 }}>
                          <strong>Personal Data Erased:</strong> All your personal income/expense ledger transactions, savings goals, travel plans, and simulations will be permanently wiped.
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🛡️</span>
                        <div style={{ fontSize: '12px', color: 'var(--text-main, #183630)', lineHeight: 1.4 }}>
                          <strong>Shared Group Integrity Preserved:</strong> Collaborative group trips and settlement history you participated in remain active for surviving members so group balances are never corrupted.
                        </div>
                      </div>
                    </div>

                    {deleteError && (
                      <div style={{ 
                        padding: '12px 14px', 
                        background: '#fef2f2', 
                        border: '1px solid #fca5a5', 
                        borderRadius: '10px', 
                        color: '#dc2626', 
                        fontSize: '13px', 
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span>⚠️</span>
                        <span>{deleteError}</span>
                      </div>
                    )}

                    <form onSubmit={handleDeleteAccountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', display: 'block', marginBottom: '6px' }}>
                          Type <span style={{ color: '#dc2626', fontFamily: 'monospace', fontWeight: 800 }}>DELETE</span> to confirm:
                        </label>
                        <input
                          type="text"
                          className="input-wrapper"
                          placeholder="DELETE"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          required
                          disabled={isDeleting}
                          style={{ height: '42px', fontSize: '14px' }}
                          aria-label="Confirm Deletion text"
                        />
                      </div>

                      {profile.hasPassword && (
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #183630)', display: 'block', marginBottom: '6px' }}>
                            Enter your password:
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showDeletePassword ? 'text' : 'password'}
                              className="input-wrapper"
                              placeholder="Account password"
                              value={deletePassword}
                              onChange={(e) => setDeletePassword(e.target.value)}
                              required
                              disabled={isDeleting}
                              style={{ height: '42px', fontSize: '14px', paddingRight: '40px' }}
                              aria-label="Account Password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowDeletePassword(!showDeletePassword)}
                              style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted, #94A3B8)',
                                cursor: 'pointer'
                              }}
                              aria-label={showDeletePassword ? 'Hide password' : 'Show password'}
                            >
                              {showDeletePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setShowDeleteModal(false)}
                          disabled={isDeleting}
                          className="btn-secondary"
                          style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '10px' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isDeleting || deleteConfirmText !== 'DELETE' || (profile.hasPassword && !deletePassword)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 20px',
                            fontSize: '13px',
                            fontWeight: 700,
                            background: (deleteConfirmText === 'DELETE' && (!profile.hasPassword || deletePassword)) ? '#dc2626' : '#cbd5e1',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: (deleteConfirmText === 'DELETE' && (!profile.hasPassword || deletePassword) && !isDeleting) ? 'pointer' : 'not-allowed',
                            boxShadow: (deleteConfirmText === 'DELETE') ? '0 2px 8px rgba(220, 38, 38, 0.25)' : 'none'
                          }}
                        >
                          {isDeleting ? (
                            <>
                              <RefreshCw size={14} className="spin-icon" /> Deleting Account...
                            </>
                          ) : (
                            <>
                              <Trash2 size={14} /> Permanently Delete My Account
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </div>
        )}

      </main>
    </div>
  );
}
