import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext.jsx';
import { buildUTCDateRange, formatDate } from '../../utils/dates.js';
import { generateCargoSalesReportPdf } from '../../utils/pdf.js';
import Layout from '../../components/Layout.jsx';
import Footer from '../../components/Footer.jsx';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const { bookings, agentProfiles, iataAirportCodes, isAdmin, myAgentId } = useAppContext();
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [reportData, setReportData] = useState([]);
  const [generated,  setGenerated]  = useState(false);

  // Agents only see their own bookings
  const scopedBookings = React.useMemo(() => {
    const all = bookings || [];
    return isAdmin ? all : all.filter(b => b.agent_id === myAgentId);
  }, [bookings, isAdmin, myAgentId]);

  const handleGenerate = () => {
    if (!dateFrom || !dateTo) {
      toast.error('Please select a start date and an end date.');
      return;
    }
    const { startDate, endDate } = buildUTCDateRange(dateFrom, dateTo);
    const filtered = scopedBookings.filter(b => {
      const d = b.createdAt?.toDate();
      return d && d >= startDate && d <= endDate;
    });
    setReportData(filtered);
    setGenerated(true);
    if (!filtered.length) toast('No bookings found in that date range.', { icon: 'ℹ️' });
  };

  const total = reportData.reduce((sum, b) => sum + (parseFloat(b.totalCalculatedCharges) || 0), 0);

  return (
    <Layout>
      <div className="page-wrapper">
        <div className="page-header">
          <div>
            <h1 className="page-title">Reporting & Analytics</h1>
            <p className="page-subtitle">Revenue report by date range</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <span className="card-title">Revenue Report by Date</span>
          </div>
          <div className="card-body">
            <div className="filter-row">
              <div className="form-group">
                <label htmlFor="dateFrom" className="form-label">Start date</label>
                <input
                  type="date"
                  id="dateFrom"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="dateTo" className="form-label">End date</label>
                <input
                  type="date"
                  id="dateTo"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="form-input"
                />
              </div>
              {reportData.length > 0 && (
                <button
                  onClick={() => generateCargoSalesReportPdf(reportData, dateFrom, dateTo, agentProfiles, iataAirportCodes)}
                  className="button button-secondary"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 16, height: 16 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export PDF
                </button>
              )}
              <button onClick={handleGenerate} className="button button-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 16, height: 16 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Generate report
              </button>
            </div>
          </div>
        </div>

        {/* Resultado */}
        {generated && (
          reportData.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="empty-state-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div className="empty-state-text">No results</div>
                  <div className="empty-state-sub">No bookings found for the selected date range.</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>AWB</th>
                    <th>Date</th>
                    <th>Agent</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((b, i) => (
                    <tr key={b.id || i}>
                      <td data-label="AWB" className="font-mono">{b.awb}</td>
                      <td data-label="Date">{formatDate(b.createdAt)}</td>
                      <td data-label="Agent">
                        {agentProfiles?.find(a => a.id === b.selectedAgentProfileId)?.agentName || (
                          <span style={{ color: 'var(--color-gray-400)' }}>N/A</span>
                        )}
                      </td>
                      <td data-label="Revenue" className="text-right">
                        <span style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
                          {(parseFloat(b.totalCalculatedCharges) || 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="text-right">
                      TOTAL — {reportData.length} booking{reportData.length !== 1 ? 's' : ''}
                    </td>
                    <td className="text-right" style={{ fontSize: 'var(--font-size-base)' }}>
                      {total.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}
      </div>
      <Footer />
    </Layout>
  );
}
