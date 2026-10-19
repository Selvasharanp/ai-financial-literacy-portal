import { useState, useEffect } from 'react';
import { 
    LayoutDashboard, GraduationCap, Target, LogOut, Sparkles, 
    UserRound, Plane, Luggage, Menu, X
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const savedUser = (() => {
        try {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u) : null;
        } catch {
            return null;
        }
    })();

    const menuItems = [
        { icon: <LayoutDashboard size={18} />, label: 'Dashboard', path: '/dashboard' },
        { icon: <Luggage size={18} />, label: 'Travel Budget Planner', path: '/travel-planner' },
        { icon: <Target size={18} />, label: 'Future Goals', path: '/goals' },
        { icon: <Plane size={18} />, label: 'Trip Splitter', path: '/trip-splitter' },
        { icon: <GraduationCap size={18} />, label: 'Literacy Hub', path: '/literacy' },
        { icon: <UserRound size={18} />, label: 'Profile & Settings', path: '/profile' },
    ];

    const handleLogout = () => {
        setMobileOpen(false);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <>
            <header className="top-navbar">
                {/* Top Navbar Brand */}
                <div className="navbar-brand" onClick={() => navigate('/dashboard')}>
                    <div className="navbar-brand-icon">
                        <Sparkles size={18} />
                    </div>
                    <h2 className="navbar-brand-title">
                        FinWise <span>AI</span>
                    </h2>
                </div>

                {/* Desktop Navigation Menu */}
                <nav className="navbar-links">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <div 
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`navbar-item ${isActive ? 'active' : ''}`}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </div>
                        );
                    })}
                </nav>

                {/* Desktop Logout Button */}
                <button className="navbar-logout-btn" onClick={handleLogout}>
                    <LogOut size={16} /> <span>Logout</span>
                </button>

                {/* Mobile Menu Toggle Button */}
                <button 
                    className="navbar-mobile-toggle" 
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle navigation menu"
                    aria-expanded={mobileOpen}
                >
                    {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </header>

            {/* Mobile Navigation Drawer / Dropdown */}
            {mobileOpen && (
                <div className="navbar-mobile-backdrop" onClick={() => setMobileOpen(false)}>
                    <div className="navbar-mobile-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="navbar-mobile-links">
                            {menuItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <div 
                                        key={item.path}
                                        onClick={() => {
                                            navigate(item.path);
                                            setMobileOpen(false);
                                        }}
                                        className={`navbar-mobile-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="navbar-mobile-icon">{item.icon}</span>
                                        <span className="navbar-mobile-label">{item.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="navbar-mobile-footer">
                            <button className="navbar-mobile-logout-btn" onClick={handleLogout}>
                                <LogOut size={18} /> <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
