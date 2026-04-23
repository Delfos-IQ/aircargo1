import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext.jsx';
import { buildUTCDateRange, formatDate } from '../../utils/dates.js';
import { generateInvoicePdf } from '../../utils/pdf.js';
import Layout from '../../components/Layout.jsx';
import Footer from '../../components/Footer.jsx';
import toast from 'react-hot-toast';

export default function BillingPage() {
  const { bookings, agentProfiles } = useAppContext();
  const [selectedAgentId,    setSelectedAgentId]    = useState('');
  const [dateFrom,           setDateFrom]           = useState('');
  const [dateTo,             setDateTo]             = useState('');
  const [bookingsForInvoice, setBookingsForInvoice] = useState([]);
  const [filtered,           setFiltered]           = useState(false);

  const agentsWithBookings = useMemo(() => {
    if (!bookings || !agentProfiles) return [];
    const ids = new Set(bookings.map(b => b.selectedAgentProfileId).filter(Boolean));
    return agentProfiles.filter(a => ids.has(a.id));
  }, [bookings, agentProfiles]);

  const handleFilter = () => {
    if (!selectedAgentId || !dateFrom || !dateTo) {
      toast.error('Please select an agent and a date range.');
      return;
    }
    const { startDate, endDate } = buildUTCDateRange(dateFrom, dateTo);
    const result = (bookings || [])
      .filter(b => {
        const d = b.createdAt?.toDate();
        return b.selectedAgentProfileId === selectedAgentId && d && d >= startDate && d <= endDate;
      })
      .sort((a, b) => a.createdAt.toDate() - b.createdAt.toDate());
    setBookingsForInvoice(result);
    setFiltered(true);
    if (!result.length) toast('No bookings found for that agent and date range.', { icon: 'ℹ️' });
  };

  const selectedAgent = agentProfiles?.find(a => a.id === selectedAgentId);
  const total = bookingsForInvoice.reduce((sum, b) => sum + (parseFloat(b.totalCalculatedCharges) || 0), 0);

  return (
    <Layout>
      <div className="page-wrapper">
        <div className="page-header">
          <div>
            <h1 className="page-title">Invoicing & Billing</h1>
            <p className="page-subtitle">Generate agent invoices for a date range</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <span className="card-title">Generate Agent Invoice</span>
          </div>
          <div className="card-body">
            <div className="filter-row">
              <div className="form-group">
                <label className="form-label">Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Select agent…</option>
                  {agentsWithBookings.map(a => (
                    <option key={a.id} value={a.id}>{a.agentName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="form-input"
                />
              </div>
              <button onClick={handleFilter} className="button button-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 16, height: 16 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Filter
              </button>
            </div>
          </div>
        </div>

        {/* Resultado */}
        {filtered && (
          bookingsForInvoice.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="empty-state-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div className="empty-state-text">No results</div>
                  <div className="empty-state-sub">No bookings found for that agent and date range.</div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Cabecera factura */}
              {selectedAgent && (
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                  <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>
                        Invoiced agent
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-gray-900)' }}>
                        {selectedAgent.agentName}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-1)' }}>
                          Total invoiced
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary-700)' }}>
                          {total.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-400)' }}>
                          {bookingsForInvoice.length} booking{bookingsForInvoice.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <button
                        className="button button-primary"
                        onClick={() => generateInvoicePdf(selectedAgent, bookingsForInvoice, dateFrom, dateTo)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 15, height: 15 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Generate Invoice PDF
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>AWB</th>
                      <th>Date</th>
                      <th>Origin</th>
                      <th>Destination</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingsForInvoice.map((b, i) => (
                      <tr key={b.id || i}>
                        <td data-label="AWB" className="font-mono">{b.awb}</td>
                        <td data-label="Date">{formatDate(b.createdAt)}</td>
                        <td data-label="Origin">{b.origin}</td>
                        <td data-label="Destination">{b.destination}</td>
                        <td data-label="Amount" className="text-right">
                          <span style={{ fontWeight: 600 }}>
                            {b.currency} {(parseFloat(b.totalCalculatedCharges) || 0).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right">TOTAL</td>
                      <td className="text-right" style={{ fontSize: 'var(--font-size-base)' }}>
                        {total.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        )}
      </div>
      <Footer />
    </Layout>
  );
}
