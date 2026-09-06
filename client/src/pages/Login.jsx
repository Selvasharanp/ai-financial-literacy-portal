import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', formData);
            localStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err) {
            alert("Error: Unauthorized Access");
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)' }}>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bento-card"
                style={{ width: '100%', maxWidth: '420px', background: '#fff' }}
            >
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ color: 'var(--primary)', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <ShieldCheck size={40} strokeWidth={2.5} />
                    </div>
                    <h1 className="title-main" style={{ fontSize: '24px' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Authorized Node Access Required</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600', marginBottom: '8px', display: 'block' }}>Email ID</label>
                        <input type="email" className="input-wrapper" placeholder="name@network.com" onChange={(e) => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600', marginBottom: '8px', display: 'block' }}>Access Key</label>
                        <input type="password" className="input-wrapper" placeholder="••••••••" onChange={(e) => setFormData({...formData, password: e.target.value})} />
                    </div>
                    <button type="submit" className="btn-action">
                        Login to Portal <ChevronRight size={20} />
                    </button>
                </form>

                <div style={{ marginTop: '30px', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                    <Link to="/register" style={{ color: 'var(--text-muted)', fontSize: '14px', textDecoration: 'none', fontWeight: '500' }}>
                        Don't have an account? <span style={{ color: 'var(--primary)' }}>Register New Entity</span>
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;