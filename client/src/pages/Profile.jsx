import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

const cities = ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Tier 2', 'Tier 3'];

export default function Profile() {
  const [profile, setProfile] = useState({ name: '', email: '', location: 'Tier 2' });
  const [status, setStatus] = useState('');
  const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
  useEffect(() => { axios.get('http://localhost:5000/api/auth/profile', config).then(({ data }) => setProfile(data)).catch(() => setStatus('Unable to load profile.')); }, []);
  const save = async (event) => { event.preventDefault(); try { const { data } = await axios.put('http://localhost:5000/api/auth/profile', profile, config); setProfile(data); localStorage.setItem('user', JSON.stringify(data)); setStatus('Profile saved.'); } catch (error) { setStatus(error.response?.data?.error || 'Unable to save profile.'); } };
  return <div style={{ display: 'flex', background: 'var(--bg-subtle)', minHeight: '100vh' }}><Sidebar /><main className="app-main" style={{ marginLeft: '260px', flex: 1, padding: '40px' }}><h1 className="title-main">Profile Settings</h1><p style={{ color: 'var(--text-muted)', margin: '10px 0 30px' }}>Your name personalizes the dashboard. Your city adjusts budget benchmarks.</p><form className="bento-card" onSubmit={save} style={{ maxWidth: '560px', background: '#fff', display: 'grid', gap: '16px' }}><label>Name<input className="input-wrapper" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} required /></label><label>Email<input className="input-wrapper" value={profile.email} disabled /></label><label>City / region<select className="input-wrapper" value={profile.location} onChange={e => setProfile({ ...profile, location: e.target.value })}>{cities.map(city => <option key={city}>{city}</option>)}</select></label>{status && <p style={{ color: status === 'Profile saved.' ? '#059669' : '#dc2626' }}>{status}</p>}<button className="btn-action" type="submit">Save Profile</button></form></main></div>;
}
