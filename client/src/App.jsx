import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import LiteracyHub from './pages/LiteracyHub';
import Goals from './pages/Goals';
import Profile from './pages/Profile';
import SmartFinance from './pages/SmartFinance';
import TripSplitter from './pages/TripSplitter';
import InvitationAccept from './pages/InvitationAccept';
import TravelBudgetPlanner from './pages/TravelBudgetPlanner';

// Global Components
import AIChatbot from './components/AIChatbot';
import { NotificationProvider } from './context/NotificationContext';

// Global Styles
import './index.css';

const getSavedUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;

  const user = getSavedUser();
  if (user && user.hasCompletedOnboarding === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

const OnboardingRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;

  const user = getSavedUser();
  if (user && user.hasCompletedOnboarding === true) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (token) {
    const user = getSavedUser();
    if (user && user.hasCompletedOnboarding === false) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const ChatbotGate = () => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  return token && !['/login', '/register', '/onboarding'].includes(location.pathname) ? <AIChatbot /> : null;
};

function App() {
  return (
    <Router>
      <NotificationProvider>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />

          {/* Onboarding Route */}
          <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />

          {/* Core Feature Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/transactions" element={<Navigate to="/dashboard" replace />} />
          <Route path="/travel-planner" element={<ProtectedRoute><TravelBudgetPlanner /></ProtectedRoute>} />
          <Route path="/budget-explorer" element={<Navigate to="/travel-planner" replace />} />
          <Route path="/literacy" element={<ProtectedRoute><LiteracyHub /></ProtectedRoute>} />
          <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
          <Route path="/trip-splitter" element={<ProtectedRoute><TripSplitter /></ProtectedRoute>} />
          <Route path="/trip-splitter/invite/:token" element={<InvitationAccept />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/smart-finance" element={<Navigate to="/literacy" replace />} />

          {/* Redirect empty path */}
          <Route path="/" element={<Navigate to="/dashboard" />} />
          
          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>

        <ChatbotGate />
      </NotificationProvider>
    </Router>
  );
}

export default App;
