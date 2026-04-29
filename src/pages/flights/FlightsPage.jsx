import React, { useState, useMemo } from 'react';
import { db } from '../../services/firebase.js';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useFirestoreCollection } from '../../hooks/useFirestoreCollection.js';
import Layout from '../../components/Layout.jsx';
import toast from 'react-hot-toast';

const DAYS = [
  { num: '1', label: 'Mo' },
  { num: '2', label: 'Tu' },
  { num: '3', label: 'We' },
  { num: '4', label: 'Th' },
  { num: '5', label: 'Fr' },
  { num: '6', label: 'Sa' },
  { num: '7', label: 'Su' },
];

const DaysBadges = ({ value = '' }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {DAYS.map(d => (
      <span key={d.num} style={{
        display: 'inline-block', width: 22, textAlign: 'center',
        padding: '1px 0', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600,
        background: value.includes(d.num) ? 'var(--color-primary, #1e3a8a)' : 'var(--color-gray-100, #f3f4f6)',
        color: value.includes(d.num) ? '#fff' : 'var(--color-gray-400, #9ca3af)',
      }}>{d.label}</span>
    ))}
  </div>
);

const DaysCheckboxes = ({ value = '', onChange }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {DAYS.map(d => {
      const checked = value.includes(d.num);
      return (
        <label key={d.num} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          cursor: 'pointer', userSelect: 'none',
          padding: '4px 8px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 500,
          background: checked ? 'var(--color-primary, #1e3a8a)' : 'var(--color-gray-100, #f3f4f6)',
          color: checked ? '#fff' : 'var(--color-gray-600, #4b5563)',
          border: `1px solid ${checked ? 'transparent' : 'var(--color-border, #e5e7eb)'}`,
          transition: 'all 120ms',
        }}>
          <input type="checkbox" checked={checked} style={{ display: 'none' }}
            onChange={() => {
              const next = checked
                ? value.replace(d.num, '')
                : [...value.split('').filter(x => x !== d.num), d.num].sort().join('');
              onChange(next);
            }}
          />
          {d.label}
        </label>
      );
    })}
  </div>
);

const INITIAL = {
  flightNumber: '', origin: '', destination: '', carrierCode: '',
  aircraftType: '', daysOfOperation: '', std: '', sta: '',
  maxPayloadKg: '', maxPayloadCbm: '',
};

export default function FlightsPage() {
  const { data: items, isLoading } = useFirestoreCollection('flightSchedules');
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(INITIAL);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...items].sort((a, b) => (a.flightNumber || '').localeCompare(b.flightNumber || ''));
    return q ? list.filter(i =>
      [i.flightNumber, i.origin, i.destination, i.carrierCode, i.aircraftType]
        .some(v => String(v || '').toLowerCase().includes(q))
    ) : list;
  }, [items, search]);

  const openAdd  = () => { setEditing(null); setForm(INITIAL); setShowForm(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...INITIAL, ...item }); setShowForm(true); };
  const close    = () => { setShowForm(false); setEditing(null); setForm(INITIAL); };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.daysOfOperation) { toast.error('Select at least one day of operation'); return; }
    setSaving(true);
    try {
      const data = {
        flightNumber:   form.flightNumber.toUpperCase().trim(),
        origin:         form.origin.toUpperCase().trim(),
        destination:    form.destination.toUpperCase().trim(),
        carrierCode:    form.carrierCode.toUpperCase().trim(),
        aircraftType:   form.aircraftType.toUpperCase().trim(),
        daysOfOperation: form.daysOfOperation,
        std:            form.std,
        sta:            form.sta,
        maxPayloadKg:   form.maxPayloadKg ? parseFloat(form.maxPayloadKg) : null,
        maxPayloadCbm:  form.maxPayloadCbm ? parseFloat(form.maxPayloadCbm) : null,
      };
      if (editing) {
        await updateDoc(doc(db, 'flightSchedules', editing.id), data);
        toast.success('Flight updated');
      } else {
        if (items.some(i => i.flightNumber?.toUpperCase() === data.flightNumber)) {
          toast.error('A flight with this number already exists'); setSaving(false); return;
        }
        await addDoc(collection(db, 'flightSchedules'), data);
        toast.success('Flight created');
      }
      close();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'flightSchedules', id));
      toast.success('Flight deleted');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setDeletingId(null);
  };

  return (
    <Layout>
      <div className="page-wrapper">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>
              Flight Schedules
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)', marginTop: 4 }}>
              {items.length} flight{items.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          <button className="button button-primary" onClick={openAdd}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Flight
          </button>
        </div>

        {/* Search */}
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <input type="text" className="form-input" placeholder="Search by flight, route, carrier, aircraft…"
            value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 400 }} />
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              <p>No flights found{search ? ' matching your search' : ''}. Click "New Flight" to add one.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Flight</th>
                    <th>Route</th>
                    <th>Carrier</th>
                    <th>Aircraft</th>
                    <th>Days</th>
                    <th>STD</th>
                    <th>STA</th>
                    <th style={{ textAlign: 'right' }}>Max KG</th>
                    <th style={{ textAlign: 'right' }}>Max CBM</th>
                    <th style={{ width: 110 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.flightNumber}</strong></td>
                      <td>{item.origin}→{item.destination}</td>
                      <td>{item.carrierCode}</td>
                      <td>{item.aircraftType || '—'}</td>
                      <td><DaysBadges value={item.daysOfOperation} /></td>
                      <td>{item.std || '—'}</td>
                      <td>{item.sta || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{item.maxPayloadKg ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{item.maxPayloadCbm ?? '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="button button-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => openEdit(item)}>Edit</button>
                          {deletingId === item.id ? (
                            <>
                              <button className="button button-danger" style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                onClick={() => handleDelete(item.id)}>Confirm</button>
                              <button className="button button-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                onClick={() => setDeletingId(null)}>Cancel</button>
                            </>
                          ) : (
                            <button className="button button-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--color-red-600)' }}
                              onClick={() => setDeletingId(item.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
                  {editing ? 'Edit Flight' : 'New Flight Schedule'}
                </h2>
                <button onClick={close} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', display: 'flex' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 20, height: 20 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Flight Number *</label>
                    <input className="form-input" value={form.flightNumber} required disabled={!!editing}
                      placeholder="e.g. IB6251"
                      onChange={e => set('flightNumber', e.target.value.toUpperCase())} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Carrier Code *</label>
                    <input className="form-input" value={form.carrierCode} required maxLength={2}
                      placeholder="e.g. IB"
                      onChange={e => set('carrierCode', e.target.value.toUpperCase())} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Origin *</label>
                    <input className="form-input" value={form.origin} required maxLength={3}
                      placeholder="e.g. MAD"
                      onChange={e => set('origin', e.target.value.toUpperCase())} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Destination *</label>
                    <input className="form-input" value={form.destination} required maxLength={3}
                      placeholder="e.g. JFK"
                      onChange={e => set('destination', e.target.value.toUpperCase())} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">STD *</label>
                    <input type="time" className="form-input" value={form.std} required
                      onChange={e => set('std', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">STA *</label>
                    <input type="time" className="form-input" value={form.sta} required
                      onChange={e => set('sta', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Aircraft Type *</label>
                    <input className="form-input" value={form.aircraftType} required
                      placeholder="e.g. B77L"
                      onChange={e => set('aircraftType', e.target.value.toUpperCase())} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Days of Operation *</label>
                  <DaysCheckboxes value={form.daysOfOperation} onChange={v => set('daysOfOperation', v)} />
                </div>

                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Max Payload (KG)</label>
                    <input type="number" className="form-input" value={form.maxPayloadKg} min="0"
                      placeholder="e.g. 20000"
                      onChange={e => set('maxPayloadKg', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Payload (CBM)</label>
                    <input type="number" className="form-input" value={form.maxPayloadCbm} min="0" step="0.1"
                      placeholder="e.g. 120"
                      onChange={e => set('maxPayloadCbm', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                  <button type="button" className="button button-ghost" onClick={close} disabled={saving}>Cancel</button>
                  <button type="submit" className="button button-primary" disabled={saving}>
                    {saving ? 'Saving…' : editing ? 'Update' : 'Save Flight'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
