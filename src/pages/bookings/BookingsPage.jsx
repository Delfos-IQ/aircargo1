import React, { useState } from 'react';
import Layout from '../../components/Layout.jsx';
import Footer from '../../components/Footer.jsx';
import BookingForm from './BookingForm.jsx';
import BookingTable from './BookingTable.jsx';

const VIEWS = { LIST: 'list', NEW: 'new', EDIT: 'edit' };

export default function BookingsPage() {
  const [view, setView] = useState(VIEWS.LIST);
  const [editingBooking, setEditingBooking] = useState(null);

  const handleEdit = (booking) => {
    setEditingBooking(booking);
    setView(VIEWS.EDIT);
  };

  const handleDone = () => {
    setEditingBooking(null);
    setView(VIEWS.LIST);
  };

  return (
    <Layout>
      <div className="page-wrapper">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {view === VIEWS.NEW ? 'New Booking' : view === VIEWS.EDIT ? `Edit AWB ${editingBooking?.awb || ''}` : 'Bookings'}
            </h1>
            <p className="page-subtitle">Cargo booking management and AWB issuance</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className={'button ' + (view === VIEWS.LIST ? 'button-primary' : 'button-secondary')}
              onClick={handleDone}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 16, height: 16 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              View bookings
            </button>
            <button
              className={'button ' + (view === VIEWS.NEW ? 'button-primary' : 'button-secondary')}
              onClick={() => { setEditingBooking(null); setView(VIEWS.NEW); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 16, height: 16 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New booking
            </button>
          </div>
        </div>

        {view === VIEWS.LIST && <BookingTable onEdit={handleEdit} />}
        {view === VIEWS.NEW  && <BookingForm onSuccess={handleDone} />}
        {view === VIEWS.EDIT && <BookingForm onSuccess={handleDone} editingBooking={editingBooking} />}
      </div>
      <Footer />
    </Layout>
  );
}
