import React from 'react';
import { LayoutDashboard, Receipt, GraduationCap, Target, LogOut, Sparkles, UserRound } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
        { icon: <Receipt size={20} />, label: 'Transactions', path: '/transactions' },
        { icon: <GraduationCap size={20} />, label: 'Literacy Hub', path: '/literacy' },
        { icon: <Target size={20} />, label: 'Savings Goals', path: '/goals' },
        { icon: <UserRound size={20} />, label: 'Profile', path: '/profile' },
    ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="sidebar" style={{ 
            width: '260px', height: '100vh', padding: '30px', display: 'flex', flexDirection: 'column', 
            borderRight: '1px solid var(--border)', position: 'fixed', left: 0, top: 0, background: '#fff', zIndex: 100
        }}>
            <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '50px' }}>
                <div style={{ background: 'var(--text-main)', padding: '8px', borderRadius: '10px' }}>
                    <Sparkles size={20} color="var(--primary)" fill="var(--primary)" />
                </div>
                <h2 style={{ fontFamily: 'Orbitron', fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-1px' }}>AI Fin</h2>
            </div>

            <nav className="sidebar-nav" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {menuItems.map((item) => (
                    <div 
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="sidebar-item"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', transition: '0.2s',
                            background: location.pathname === item.path ? 'var(--bg-subtle)' : 'transparent',
                            color: location.pathname === item.path ? 'var(--text-main)' : 'var(--text-muted)',
                            fontWeight: location.pathname === item.path ? '700' : '500',
                            border: location.pathname === item.path ? '1px solid var(--border)' : '1px solid transparent'
                        }}
                    >
                        {item.icon} {item.label}
                    </div>
                ))}
            </nav>

            <button className="sidebar-logout" onClick={handleLogout} style={{ 
                display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 16px', background: 'transparent', 
                border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginTop: 'auto' 
            }}>
                <LogOut size={20} /> Logout Session
            </button>
        </div>
    );
};

export default Sidebar;
