import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext.jsx';

/* ── SVG icon helper ── */
const Icon = ({ d, size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: size, height: size, flexShrink: 0 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const NAV_ITEMS = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/dashboard',
        icon: <Icon d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'bookings', label: 'Bookings / AWBs', path: '/bookings',
        icon: <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
      { id: 'awb-stock', label: 'AWB Stock', path: '/awb-stock',
        icon: <Icon d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /> },
      { id: 'flights', label: 'Flights', path: '/flights',
        icon: <Icon d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /> },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'billing', label: 'Billing', path: '/billing',
        icon: <Icon d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m10.5-1.5H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m10.5-10.5h-7.5A2.25 2.25 0 009 8.25v7.5" /> },
      { id: 'reports', label: 'Reports', path: '/reports',
        icon: <Icon d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /> },
      { id: 'rates', label: 'Rates', path: '/rates',
        icon: <Icon d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /> },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { id: 'agents', label: 'Agents', path: '/agents',
        icon: <Icon d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /> },
      { id: 'shippers', label: 'Shippers', path: '/shippers',
        icon: <Icon d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /> },
      { id: 'consignees', label: 'Consignees', path: '/consignees',
        icon: <Icon d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> },
      { id: 'gha', label: 'GHA Profiles', path: '/gha',
        icon: <Icon d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /> },
      { id: 'airports', label: 'IATA Airports', path: '/airports',
        icon: <Icon d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /> },
      { id: 'users', label: 'Users', path: '/users',
        icon: <Icon d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /> },
    ],
  },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUserProfile, logout } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (currentUserProfile?.username || currentUserProfile?.email || 'U')
    .slice(0, 2).toUpperCase();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div className="app-shell">
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
          onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/across_logo.png" alt="GSSA Logo" />
          <div>
            <div className="sidebar-logo-text">GSSA Cargo</div>
            <div className="sidebar-logo-sub">Management System</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.id}
                    className={`sidebar-link${isActive ? ' active' : ''}`}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {currentUserProfile?.username || currentUserProfile?.email || 'User'}
            </div>
            <div className="sidebar-user-role">{currentUserProfile?.role || 'user'}</div>
          </div>
          <button onClick={handleLogout} title="Log out"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--sidebar-text)', padding: 4, borderRadius: 'var(--radius-md)', display: 'flex', transition: 'color 150ms' }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--sidebar-text)'}
          >
            <Icon d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="main-content">
        <div style={{ display: 'none', padding: '12px 16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', alignItems: 'center', justifyContent: 'space-between' }} className="mobile-topbar">
          <button onClick={() => setMobileOpen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-gray-700)', display: 'flex' }}>
            <Icon d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" size={22} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-800)' }}>GSSA Cargo</span>
          <div className="sidebar-avatar" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>{initials}</div>
        </div>
        {children}
      </div>

      <style>{`@media (max-width: 768px) { .mobile-topbar { display: flex !important; } }`}</style>
    </div>
  );
}
