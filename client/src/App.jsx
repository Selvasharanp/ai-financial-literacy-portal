import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import LiteracyHub from './pages/LiteracyHub';
import Goals from './pages/Goals';
import Profile from './pages/Profile';

// Global Components
import AIChatbot from './components/AIChatbot';

// Global Styles
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Core Feature Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/literacy" element={<LiteracyHub />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/profile" element={<Profile />} />

        {/* Redirect empty path to login */}
        <Route path="/" element={<Navigate to="/login" />} />
        
        {/* Catch-all route to redirect back to login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>

      {/* This ensures the AI Chatbot is available on every page after login */}
      <AIChatbot />
    </Router>
  );
}

export default App;
