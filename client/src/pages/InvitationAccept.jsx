import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plane, CheckCircle2, XCircle, Clock, LogIn, Users, ShieldCheck, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { apiUrl, authConfig } from '../utils/api';

const InvitationAccept = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const action = searchParams.get('action'); // 'accept' or 'decline'

  const [status, setStatus] = useState('loading'); // loading | valid | error | done
  const [inviteInfo, setInviteInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  const isLoggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Invalid invitation link.'); return; }

    axios.get(apiUrl(`/api/invitations/${token}`))
      .then(res => {
        if (res.data.alreadyAccepted) {
          setStatus('done');
          setResultMsg('This invitation has already been accepted. You can open the trip from your dashboard.');
          setInviteInfo({ tripId: res.data.tripId, tripName: res.data.tripName });
        } else {
          setInviteInfo(res.data);
          setStatus('valid');
          // If action is pre-set from URL and user is logged in, auto-trigger
          if (action && isLoggedIn) {
            handleAction(action, res.data);
          }
        }
      })
      .catch(err => {
        setStatus('error');
        setErrorMsg(err.response?.data?.error || 'This invitation link is invalid, expired, or has already been used.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAction = async (act, info = inviteInfo) => {
    if (!isLoggedIn) {
      // Redirect to login, come back here after
      localStorage.setItem('inviteRedirect', `/trip-splitter/invite/${token}?action=${act}`);
      navigate(`/login?redirect=${encodeURIComponent(`/trip-splitter/invite/${token}?action=${act}`)}`);
      return;
    }

    setActionLoading(true);
    try {
      const endpoint = act === 'accept'
        ? apiUrl(`/api/invitations/${token}/accept`)
        : apiUrl(`/api/invitations/${token}/decline`);

      const res = await axios.post(endpoint, {}, authConfig());
      setStatus('done');
      if (act === 'accept') {
        setResultMsg(`You've joined "${info?.tripName || 'the trip'}"! Opening trip...`);
        setTimeout(() => {
          navigate(`/trip-splitter?tripId=${res.data.tripId}`);
        }, 1800);
      } else {
        setResultMsg('Invitation declined. You can close this page.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong.';
      // Handle "wrong account" error specially
      if (err.response?.status === 403) {
        setStatus('error');
        setErrorMsg(msg);
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const cardStyle = {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 12px 40px rgba(24,54,48,0.12)',
    border: '1px solid #e8e3d9'
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #183630 0%, #2a5546 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px'
    }}>
      {/* Logo bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
        <Plane size={28} color="#E5C690" />
        <span style={{ color: '#E3DAC9', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
          FinWise Trip Splitter
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="auth-card"
        style={cardStyle}
      >
        {/* LOADING */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '48px', height: '48px', border: '4px solid #e8e3d9', borderTopColor: '#183630', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px auto' }} />
            <p style={{ color: '#666', fontSize: '15px' }}>Validating your invitation...</p>
          </div>
        )}

        {/* VALID INVITATION */}
        {status === 'valid' && inviteInfo && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ background: '#f0faf5', borderRadius: '50%', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                <Users size={30} color="#183630" />
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 6px 0' }}>
                You're Invited!
              </h1>
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Trip invitation from FinWise</p>
            </div>

            <div style={{ background: '#f8f7f4', borderRadius: '12px', padding: '20px', marginBottom: '24px', border: '1px solid #e8e3d9' }}>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#999', fontWeight: 700 }}>Trip Name</span>
                <p style={{ fontSize: '20px', fontWeight: 800, color: '#183630', margin: '4px 0 0 0' }}>{inviteInfo.tripName}</p>
              </div>
              {inviteInfo.tripDescription && (
                <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px 0' }}>{inviteInfo.tripDescription}</p>
              )}
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#555' }}>
                <span>👤 Invited by <strong>{inviteInfo.creatorName}</strong></span>
                <span>🕐 Expires {new Date(inviteInfo.expiresAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>

            {!isLoggedIn && (
              <div style={{ background: '#fff8ec', border: '1px solid #f6d87a', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: '#7a5c00', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <LogIn size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>You need to be signed in to accept this invitation. After logging in, you'll be brought back here automatically.</span>
              </div>
            )}

            {isLoggedIn && inviteInfo.recipientEmail && (
              <div style={{ background: '#f0faf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#065f46', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <ShieldCheck size={16} />
                <span>Invitation for <strong>{inviteInfo.recipientEmail}</strong></span>
              </div>
            )}

            {errorMsg && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#b91c1c', display: 'flex', gap: '10px' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleAction('accept')}
                disabled={actionLoading}
                style={{
                  flex: 1, padding: '14px', background: '#183630', color: '#ffffff',
                  border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '15px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <CheckCircle2 size={18} />
                {isLoggedIn ? (actionLoading ? 'Joining...' : 'Accept & Join Trip') : 'Sign In to Accept'}
              </button>

              <button
                onClick={() => handleAction('decline')}
                disabled={actionLoading}
                style={{
                  padding: '14px 20px', background: '#ffffff', color: '#ef4444',
                  border: '1.5px solid #fca5a5', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <XCircle size={16} />
                Decline
              </button>
            </div>
          </>
        )}

        {/* DONE */}
        {status === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#f0faf5', borderRadius: '50%', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <CheckCircle2 size={32} color="#059669" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 10px 0' }}>
              {resultMsg.includes('declined') ? 'Invitation Declined' : 'Welcome to the Trip!'}
            </h2>
            <p style={{ color: '#555', fontSize: '14px', margin: '0 0 24px 0' }}>{resultMsg}</p>
            {inviteInfo?.tripId && !resultMsg.includes('declined') && (
              <button
                onClick={() => navigate(`/trip-splitter?tripId=${inviteInfo.tripId}`)}
                style={{ background: '#183630', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 28px', fontWeight: 800, cursor: 'pointer', fontSize: '15px' }}
              >
                Open Trip Dashboard
              </button>
            )}
            {!inviteInfo?.tripId && (
              <button
                onClick={() => navigate('/dashboard')}
                style={{ background: '#183630', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 28px', fontWeight: 800, cursor: 'pointer', fontSize: '15px' }}
              >
                Go to Dashboard
              </button>
            )}
          </div>
        )}

        {/* ERROR */}
        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fef2f2', borderRadius: '50%', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <XCircle size={32} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 10px 0' }}>
              Invitation Invalid
            </h2>
            <p style={{ color: '#666', fontSize: '14px', margin: '0 0 24px 0' }}>{errorMsg}</p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: '#183630', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontWeight: 700, cursor: 'pointer' }}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </motion.div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default InvitationAccept;
