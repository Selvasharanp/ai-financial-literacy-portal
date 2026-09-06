import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, ChevronLeft } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '', location: '' });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5000/api/auth/register', formData);
            alert("Success! Identity Created.");
            navigate('/login');
        } catch (err) {
            alert("Registration Failed.");
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)' }}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bento-card"
                style={{ width: '100%', maxWidth: '460px', background: '#fff' }}
            >
                <h2 className="title-main" style={{ fontSize: '24px', marginBottom: '30px' }}>Register Identity</h2>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input type="text" className="input-wrapper" placeholder="Full Name" onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                    <input type="email" className="input-wrapper" placeholder="Email Address" onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                    <input type="text" className="input-wrapper" placeholder="Current Location (City)" onChange={(e) => setFormData({...formData, location: e.target.value})} required />
                    <input type="password" className="input-wrapper" placeholder="New Access Key" onChange={(e) => setFormData({...formData, password: e.target.value})} required />
                    
                    <button type="submit" className="btn-action" style={{ marginTop: '10px' }}>
                        Create Profile <UserPlus size={18} />
                    </button>
                </form>

                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <Link to="/login" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                       <ChevronLeft size={14} /> Back to Secure Login
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;