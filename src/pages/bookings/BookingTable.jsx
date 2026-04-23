import React, { useState, useMemo } from 'react';
import { db } from '../../services/firebase.js';
import { doc, deleteDoc } from 'firebase/firestore';
import { useAppContext } from '../../context/AppContext.jsx';
import { formatDate } from '../../utils/dates.js';
import { generateFFRMessage } from '../../utils/ffr.js';
import { generateBookingConfirmationPdf } from '../../utils/pdf.js';
import toast from 'react-hot-toast';

/* ── FFR Modal ─────────────────────────────────────── */
function FfrModal({ booking, onClose }) {
  const msg = generateFFRMessage(booking);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
            FFR Message — AWB {booking.awb}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', display: 'flex' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <pre style={{
            background: 'var(--color-gray-50)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: 16, fontFamily: 'monospace',
            fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre', overflowX: 'auto', margin: 0,
          }}>{msg}</pre>
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {copied && <span style={{ fontSize: '0.8rem', color: 'var(--color-green-600)', marginRight: 'auto' }}>✓ Copied to clipboard</span>}
          <button className="button button-primary" onClick={handleCopy}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 15, height: 15 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
            Copy FFR
          </button>
          <button className="button button-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── BookingTable ──────────────────────────────────── */
export default function BookingTable({ onEdit }) {
  const { bookings, agentProfiles, flightSchedules, iataAirportCodes } = useAppContext();
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [ffrBooking, setFfrBooking] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    return (bookings || []).filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (b.awb || '').toLowerCase().includes(q) ||
        (b.shipperName || '').toLowerCase().includes(q) ||
        (b.consigneeName || '').toLowerCase().includes(q) ||
        (b.origin || '').toLowerCase().includes(q) ||
        (b.destination || '').toLowerCase().includes(q);
      const matchAgent = !filterAgent || b.selectedAgentProfileId === filterAgent;
      const matchStatus = !filterStatus || b.bookingStatus === filterStatus;
      return matchSearch && matchAgent && matchStatus;
    });
  }, [bookings, search, filterAgent, filterStatus]);

  const agentName = (id) => agentProfiles?.find(a => a.id === id)?.agentName || '—';

  const statusBadge = (status) => {
    const map = { 'KK': 'green', 'NN': 'amber', 'WL': 'amber', 'XX': 'red', 'HX': 'red' };
    const color = map[status] || 'gray';
    const styles = {
      green: { bg: '#dcfce7', text: '#166534' },
      amber: { bg: '#fef3c7', text: '#92400e' },
      red:   { bg: '#fee2e2', text: '#991b1b' },
      gray:  { bg: '#f3f4f6', text: '#374151' },
    };
    const s = styles[color];
    return (
      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 700, background: s.bg, color: s.text }}>
        {status || '—'}
      </span>
    );
  };

  const handleDelete = async (booking) => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      toast.success(`Booking ${booking.awb} deleted`);
    } catch (err) {
      toast.error('Error deleting: ' + err.message);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '2 1 200px', margin: 0 }}>
            <label className="form-label">Search</label>
            <input className="form-input" placeholder="AWB, shipper, consignee, route…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '1 1 160px', margin: 0 }}>
            <label className="form-label">Agent</label>
            <select className="form-select" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
              <option value="">All</option>
              {(agentProfiles || []).map(a => <option key={a.id} value={a.id}>{a.agentName}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '0 1 120px', margin: 0 }}>
            <label className="form-label">Status</label>
            <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              {['KK','NN','WL','XX','HX'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(search || filterAgent || filterStatus) && (
            <button className="button button-ghost" style={{ alignSelf: 'flex-end' }} onClick={() => { setSearch(''); setFilterAgent(''); setFilterStatus(''); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)' }}>
        {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
        {(search || filterAgent || filterStatus) ? ' found' : ' total'}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No bookings match the current filters.</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>AWB</th>
                  <th>Date</th>
                  <th>Agent</th>
                  <th>Route</th>
                  <th>Shipper</th>
                  <th>Pcs</th>
                  <th>Kg</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ width: 150 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => (
                  <tr key={b.id || i}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{b.awb || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(b.createdAt)}</td>
                    <td>{agentName(b.selectedAgentProfileId)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.8rem', background: 'var(--color-gray-100)', padding: '2px 6px', borderRadius: 4 }}>
                        {b.origin || '?'} → {b.destination || '?'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.shipperName || '—'}</td>
                    <td>{b.pieces || '—'}</td>
                    <td>{b.weightKg || '—'}</td>
                    <td>{statusBadge(b.bookingStatus)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {b.currency} {(parseFloat(b.totalCalculatedCharges) || 0).toFixed(2)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {/* Edit */}
                        <button className="button button-ghost" style={{ padding: '4px 7px' }} title="Edit" onClick={() => onEdit?.(b)}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 14, height: 14 }}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                        </button>
                        {/* PDF Confirmation */}
                        <button className="button button-ghost" style={{ padding: '4px 7px', color: 'var(--color-green-600)' }} title="Download booking confirmation PDF" onClick={() => generateBookingConfirmationPdf(b, flightSchedules || [], iataAirportCodes || [])}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 14, height: 14 }}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        </button>
                        {/* FFR */}
                        <button className="button button-ghost" style={{ padding: '4px 7px', color: 'var(--color-blue-600)' }} title="View FFR message" onClick={() => setFfrBooking(b)}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 14, height: 14 }}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                        </button>
                        {/* Delete */}
                        {deleteId === b.id ? (
                          <>
                            <button className="button button-danger" style={{ padding: '4px 7px', fontSize: '0.7rem' }} disabled={deleting} onClick={() => handleDelete(b)}>✓</button>
                            <button className="button button-ghost" style={{ padding: '4px 7px', fontSize: '0.7rem' }} onClick={() => setDeleteId(null)}>✕</button>
                          </>
                        ) : (
                          <button className="button button-ghost" style={{ padding: '4px 7px', color: 'var(--color-red-600)' }} title="Delete" onClick={() => setDeleteId(b.id)}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 14, height: 14 }}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FFR Modal */}
      {ffrBooking && <FfrModal booking={ffrBooking} onClose={() => setFfrBooking(null)} />}
    </div>
  );
}
