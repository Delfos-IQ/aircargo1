import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext.jsx';
import Layout from '../../components/Layout.jsx';
import Footer from '../../components/Footer.jsx';

/* ── Stat Card ── */
function StatCard({ label, value, color, icon }) {
  const colors = {
    blue:   { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    indigo: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    green:  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    amber:  { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.text, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-gray-900)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

/* ── Nav Card ── */
function NavCard({ title, description, path, color, icon, onClick }) {
  const colors = {
    blue:   { primary: '#2563eb', light: '#eff6ff', border: '#bfdbfe' },
    indigo: { primary: '#4f46e5', light: '#eef2ff', border: '#c7d2fe' },
    green:  { primary: '#16a34a', light: '#f0fdf4', border: '#bbf7d0' },
    amber:  { primary: '#d97706', light: '#fffbeb', border: '#fde68a' },
    purple: { primary: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe' },
    rose:   { primary: '#e11d48', light: '#fff1f2', border: '#fecdd3' },
    cyan:   { primary: '#0891b2', light: '#ecfeff', border: '#a5f3fc' },
    teal:   { primary: '#0d9488', light: '#f0fdfa', border: '#99f6e4' },
    orange: { primary: '#ea580c', light: '#fff7ed', border: '#fed7aa' },
    pink:   { primary: '#db2777', light: '#fdf2f8', border: '#fbcfe8' },
    slate:  { primary: '#475569', light: '#f8fafc', border: '#e2e8f0' },
    lime:   { primary: '#65a30d', light: '#f7fee7', border: '#d9f99d' },
  };
  const c = colors[color] || colors.blue;
  return (
    <button
      onClick={() => onClick(path)}
      style={{
        background: 'var(--color-surface)', border: `1px solid var(--color-border)`,
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
        textAlign: 'left', cursor: 'pointer', width: '100%',
        boxShadow: 'var(--shadow-sm)', transition: 'all 150ms',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
      }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = c.border; }}
      onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: c.light, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.primary, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', color: 'var(--color-gray-900)' }}>{title}</div>
      </div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)', lineHeight: 1.5 }}>{description}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: c.primary, marginTop: 'var(--space-1)' }}>
        Open
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 13, height: 13 }}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { bookings, agentProfiles, flightSchedules, awbStockAllocations, currentUserProfile } = useAppContext();

  // AWB stock: total available
  const awbAvailable = awbStockAllocations?.reduce((sum, a) => {
    const used = (a.usedAwbs || []).length;
    return sum;
  }, 0) ?? 0;

  const stats = [
    { label: 'Total bookings', value: bookings?.length ?? '…', color: 'blue',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 22, height: 22 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { label: 'Active agents', value: agentProfiles?.length ?? '…', color: 'indigo',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 22, height: 22 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg> },
    { label: 'Scheduled flights', value: flightSchedules?.length ?? '…', color: 'green',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 22, height: 22 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg> },
    { label: 'AWB stock batches', value: awbStockAllocations?.length ?? '…', color: 'amber',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 22, height: 22 }}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg> },
  ];

  const modules = [
    { title: 'Bookings / AWBs', path: '/bookings', color: 'blue', description: 'Create and manage cargo bookings, issue AWBs and generate FFR messages',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { title: 'AWB Stock', path: '/awb-stock', color: 'amber', description: 'Manage AWB stock batches and agent allocations',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg> },
    { title: 'Billing', path: '/billing', color: 'indigo', description: 'Generate agent invoices with PDF export',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m10.5-1.5H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m10.5-10.5h-7.5A2.25 2.25 0 009 8.25v7.5" /></svg> },
    { title: 'Reports', path: '/reports', color: 'green', description: 'Revenue report by date range with PDF export in landscape A4',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
    { title: 'Agents', path: '/agents', color: 'purple', description: 'Freight agent profiles with IATA/CASS data',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg> },
    { title: 'Shippers', path: '/shippers', color: 'cyan', description: 'Shipper database for autocomplete in bookings',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg> },
    { title: 'Consignees', path: '/consignees', color: 'teal', description: 'Consignee database for autocomplete in bookings',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> },
    { title: 'Flights', path: '/flights', color: 'rose', description: 'Flight schedules, routes, operating days and maximum payload',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg> },
    { title: 'Rates', path: '/rates', color: 'orange', description: 'Rate table by route with weight-break pricing',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg> },
    { title: 'GHA Profiles', path: '/gha', color: 'pink', description: 'Ground Handling Agents: names, abbreviations and locations',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg> },
    { title: 'IATA Airports', path: '/airports', color: 'slate', description: 'IATA airport codes for routes and autocomplete',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg> },
    { title: 'Users', path: '/users', color: 'lime', description: 'System user management with roles and permissions',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
  ];

  const username = currentUserProfile?.username || currentUserProfile?.email?.split('@')[0] || 'user';

  return (
    <Layout>
      <div className="page-wrapper">
        {/* Welcome */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>
            Welcome, {username} 👋
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)', marginTop: 4 }}>
            Air cargo management system control panel
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {stats.map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Section title */}
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-gray-800)', marginBottom: 'var(--space-4)', marginTop: 0 }}>
          System modules
        </h2>

        {/* Module cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          {modules.map(m => <NavCard key={m.path} {...m} onClick={navigate} />)}
        </div>
      </div>
      <Footer />
    </Layout>
  );
}
