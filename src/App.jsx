import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext.jsx';

import LoginPage      from './pages/login/LoginPage.jsx';
import DashboardPage  from './pages/dashboard/DashboardPage.jsx';
import BookingsPage   from './pages/bookings/BookingsPage.jsx';
import ReportsPage    from './pages/reports/ReportsPage.jsx';
import BillingPage    from './pages/billing/BillingPage.jsx';

// Management pages
import AgentsPage     from './pages/agents/AgentsPage.jsx';
import ShippersPage   from './pages/shippers/ShippersPage.jsx';
import ConsigneesPage from './pages/consignees/ConsigneesPage.jsx';
import GhaPage        from './pages/gha/GhaPage.jsx';
import FlightsPage    from './pages/flights/FlightsPage.jsx';
import RatesPage      from './pages/rates/RatesPage.jsx';
import AwbStockPage   from './pages/awbstock/AwbStockPage.jsx';
import AirportsPage   from './pages/airports/AirportsPage.jsx';
import UsersPage      from './pages/users/UsersPage.jsx';

const PrivateRoute = ({ children }) => {
  const { currentUser, isLoading } = useAppContext();
  if (isLoading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--font-size-sm)' }}>Cargando sistema…</p>
    </div>
  );
  return currentUser ? children : <Navigate to="/login" replace />;
};

export default function App() {
  const { currentUser } = useAppContext();

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* Core */}
      <Route path="/dashboard"  element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/bookings"   element={<PrivateRoute><BookingsPage /></PrivateRoute>} />
      <Route path="/reports"    element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
      <Route path="/billing"    element={<PrivateRoute><BillingPage /></PrivateRoute>} />

      {/* Management */}
      <Route path="/agents"     element={<PrivateRoute><AgentsPage /></PrivateRoute>} />
      <Route path="/shippers"   element={<PrivateRoute><ShippersPage /></PrivateRoute>} />
      <Route path="/consignees" element={<PrivateRoute><ConsigneesPage /></PrivateRoute>} />
      <Route path="/gha"        element={<PrivateRoute><GhaPage /></PrivateRoute>} />
      <Route path="/flights"    element={<PrivateRoute><FlightsPage /></PrivateRoute>} />
      <Route path="/rates"      element={<PrivateRoute><RatesPage /></PrivateRoute>} />
      <Route path="/awb-stock"  element={<PrivateRoute><AwbStockPage /></PrivateRoute>} />
      <Route path="/airports"   element={<PrivateRoute><AirportsPage /></PrivateRoute>} />
      <Route path="/users"      element={<PrivateRoute><UsersPage /></PrivateRoute>} />

      <Route path="*" element={<Navigate to={currentUser ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
