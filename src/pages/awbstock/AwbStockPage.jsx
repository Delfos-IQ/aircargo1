import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase.js';
import {
  collection, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import { useFirestoreCollection } from '../../hooks/useFirestoreCollection.js';
import {
  calculateEndSerial, calculateAwbCount, isValidAwbSerialWithCheckDigit
} from '../../utils/awb.js';
import { airlinePrefixData } from '../../data/airlines.js';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout.jsx';

/* ──── TABS ──────────────────────────────────────── */
const TABS = { MASTERS: 'masters', ALLOCATIONS: 'allocations' };

/* ──── MASTERS SECTION ───────────────────────────── */
function MastersSection({ masters, allocations }) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ prefix: '', startNumber: '', quantity: '50', endNumber: '', dateAdded: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const isEditing = !!editingItem;

  // Auto-calculate end number
  useEffect(() => {
    const qty = parseInt(formData.quantity, 10);
    if (formData.startNumber && qty > 0 && isValidAwbSerialWithCheckDigit(formData.startNumber)) {
      const end = calculateEndSerial(formData.startNumber, qty);
      setFormData(prev => ({ ...prev, endNumber: end || '' }));
    }
  }, [formData.startNumber, formData.quantity]);

  const openAdd = () => {
    setEditingItem(null);
    setFormData({ prefix: '', startNumber: '', quantity: '50', endNumber: '', dateAdded: new Date().toISOString().split('T')[0] });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    const qty = calculateAwbCount(item.startNumber, item.endNumber);
    setFormData({ ...item, quantity: String(qty) });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidAwbSerialWithCheckDigit(formData.startNumber)) {
      toast.error('Invalid start number (must be 8 digits with mod-7 check digit)');
      return;
    }
    if (!formData.endNumber) {
      toast.error('End number not calculated. Check the start number and quantity.');
      return;
    }
    setSaving(true);
    try {
      const { quantity, ...dataToSave } = formData;
      if (isEditing) {
        const { id, ...rest } = dataToSave;
        await updateDoc(doc(db, 'awbStockMasters', editingItem.id), rest);
        toast.success('Master updated');
      } else {
        await addDoc(collection(db, 'awbStockMasters'), dataToSave);
        toast.success('Master created');
      }
      setShowForm(false);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'awbStockMasters', id));
      toast.success('Master deleted');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setDeleteId(null);
  };

  const getMasterStats = (master) => {
    const total = calculateAwbCount(master.startNumber, master.endNumber);
    const allocs = allocations.filter(a => a.masterStockId === master.id);
    const used = allocs.reduce((sum, a) => sum + (a.usedAwbs || []).length, 0);
    const allocated = allocs.reduce((sum, a) => sum + calculateAwbCount(a.startNumber, a.endNumber), 0);
    return { total, used, allocated, available: total - allocated };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
          {masters.length} stock batch{masters.length !== 1 ? 'es' : ''}
        </p>
        <button className="button button-primary" onClick={openAdd}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          New Batch
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {masters.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
            <p>No master stock records</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Prefix</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Total</th>
                  <th>Allocated</th>
                  <th>Available</th>
                  <th>Date</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...masters].sort((a, b) => `${a.prefix}-${a.startNumber}`.localeCompare(`${b.prefix}-${b.startNumber}`)).map(item => {
                  const { total, allocated, available } = getMasterStats(item);
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.prefix}</td>
                      <td style={{ fontFamily: 'monospace' }}>{item.startNumber}</td>
                      <td style={{ fontFamily: 'monospace' }}>{item.endNumber}</td>
                      <td>{total}</td>
                      <td>{allocated}</td>
                      <td>
                        <span style={{ color: available > 0 ? 'var(--color-green-600)' : 'var(--color-red-600)', fontWeight: 600 }}>
                          {available}
                        </span>
                      </td>
                      <td>{item.dateAdded || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="button button-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => openEdit(item)}>Edit</button>
                          {deleteId === item.id ? (
                            <>
                              <button className="button button-danger" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleDelete(item.id)}>OK</button>
                              <button className="button button-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setDeleteId(null)}>No</button>
                            </>
                          ) : (
                            <button className="button button-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--color-red-600)' }} onClick={() => setDeleteId(item.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{isEditing ? 'Edit Batch' : 'New AWB Batch'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Airline Prefix *</label>
                <select className="form-select" value={formData.prefix} onChange={e => setFormData(prev => ({ ...prev, prefix: e.target.value }))} required>
                  <option value="">Select prefix</option>
                  {airlinePrefixData.map(a => (
                    <option key={a.prefix} value={a.prefix}>{a.prefix} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Start Number (8 digits) *</label>
                <input type="text" className="form-input" value={formData.startNumber} onChange={e => setFormData(prev => ({ ...prev, startNumber: e.target.value }))} required maxLength={8} placeholder="e.g. 12700004" disabled={isEditing} />
                {formData.startNumber && !isValidAwbSerialWithCheckDigit(formData.startNumber) && (
                  <p style={{ color: 'var(--color-red-600)', fontSize: '0.75rem', marginTop: 4 }}>Invalid serial (mod-7 check digit)</p>
                )}
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Quantity *</label>
                <input type="number" className="form-input" value={formData.quantity} onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value }))} required min="1" />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>End Number (auto-calculated)</label>
                <input type="text" className="form-input" value={formData.endNumber} readOnly style={{ background: 'var(--color-gray-50)', cursor: 'not-allowed' }} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Date *</label>
                <input type="date" className="form-input" value={formData.dateAdded} onChange={e => setFormData(prev => ({ ...prev, dateAdded: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="button button-ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : isEditing ? 'Update' : 'Create Batch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──── ALLOCATIONS SECTION ───────────────────────── */
function AllocationsSection({ masters, allocations, agents }) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ masterStockId: '', prefix: '', agentProfileId: '', startNumber: '', endNumber: '', quantity: '50', dateAllocated: new Date().toISOString().split('T')[0], usedAwbs: [] });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');

  const isEditing = !!editingItem;

  const selectedMaster = useMemo(() =>
    masters.find(m => m.id === formData.masterStockId), [masters, formData.masterStockId]
  );

  // When master changes, auto-fill prefix and compute next available start
  useEffect(() => {
    if (!selectedMaster || isEditing) return;
    const masterAllocs = allocations.filter(a => a.masterStockId === selectedMaster.id).sort((a, b) => b.endNumber.localeCompare(a.endNumber));
    const nextStart = masterAllocs.length > 0
      ? (() => {
          const lastEnd = masterAllocs[0].endNumber;
          const next = (parseInt(lastEnd.substring(0, 7), 10) + 1);
          const checkDigit = next % 7;
          return String(next).padStart(7, '0') + String(checkDigit);
        })()
      : selectedMaster.startNumber;
    setFormData(prev => ({ ...prev, prefix: selectedMaster.prefix, startNumber: nextStart }));
  }, [formData.masterStockId]);

  // Auto-calculate end
  useEffect(() => {
    const qty = parseInt(formData.quantity, 10);
    if (formData.startNumber && qty > 0 && isValidAwbSerialWithCheckDigit(formData.startNumber)) {
      const end = calculateEndSerial(formData.startNumber, qty);
      setFormData(prev => ({ ...prev, endNumber: end || '' }));
    }
  }, [formData.startNumber, formData.quantity]);

  const openAdd = () => {
    setEditingItem(null);
    setFormData({ masterStockId: '', prefix: '', agentProfileId: '', startNumber: '', endNumber: '', quantity: '50', dateAllocated: new Date().toISOString().split('T')[0], usedAwbs: [] });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    const qty = calculateAwbCount(item.startNumber, item.endNumber);
    setFormData({ ...item, quantity: String(qty) });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { quantity, ...dataToSave } = formData;
      if (isEditing) {
        const { id, ...rest } = dataToSave;
        await updateDoc(doc(db, 'awbStockAllocations', editingItem.id), rest);
        toast.success('Allocation updated');
      } else {
        await addDoc(collection(db, 'awbStockAllocations'), { ...dataToSave, usedAwbs: [] });
        toast.success('Allocation created');
      }
      setShowForm(false);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'awbStockAllocations', id));
      toast.success('Allocation deleted');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setDeleteId(null);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return allocations;
    const q = search.toLowerCase();
    return allocations.filter(a => {
      const agent = agents.find(ag => ag.id === a.agentProfileId);
      return (
        (a.prefix || '').toLowerCase().includes(q) ||
        (a.startNumber || '').toLowerCase().includes(q) ||
        (agent?.agentName || '').toLowerCase().includes(q)
      );
    });
  }, [allocations, agents, search]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {allocations.length} allocation{allocations.length !== 1 ? 's' : ''}
          </p>
          <input type="text" className="form-input" placeholder="Search agent or range…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
        </div>
        <button className="button button-primary" onClick={openAdd}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          New Allocation
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
            <p>No allocations found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Prefix</th>
                  <th>Range</th>
                  <th>Agent</th>
                  <th>Total</th>
                  <th>Used</th>
                  <th>Available</th>
                  <th>Date</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => `${a.agentProfileId}-${a.prefix}-${a.startNumber}`.localeCompare(`${b.agentProfileId}-${b.prefix}-${b.startNumber}`)).map(item => {
                  const agent = agents.find(a => a.id === item.agentProfileId);
                  const total = calculateAwbCount(item.startNumber, item.endNumber);
                  const used = (item.usedAwbs || []).length;
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.prefix}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.startNumber}→{item.endNumber}</td>
                      <td>{agent?.agentName || item.agentProfileId || '—'}</td>
                      <td>{total}</td>
                      <td>{used}</td>
                      <td>
                        <span style={{ color: (total - used) > 0 ? 'var(--color-green-600)' : 'var(--color-red-600)', fontWeight: 600 }}>
                          {total - used}
                        </span>
                      </td>
                      <td>{item.dateAllocated || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="button button-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => openEdit(item)}>Edit</button>
                          {deleteId === item.id ? (
                            <>
                              <button className="button button-danger" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleDelete(item.id)}>OK</button>
                              <button className="button button-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setDeleteId(null)}>No</button>
                            </>
                          ) : (
                            <button className="button button-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--color-red-600)' }} onClick={() => setDeleteId(item.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{isEditing ? 'Edit Allocation' : 'New Allocation'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Master Stock *</label>
                <select className="form-select" value={formData.masterStockId} onChange={e => setFormData(prev => ({ ...prev, masterStockId: e.target.value }))} required disabled={isEditing}>
                  <option value="">Select master stock</option>
                  {masters.map(m => {
                    const total = calculateAwbCount(m.startNumber, m.endNumber);
                    const allocs = allocations.filter(a => a.masterStockId === m.id);
                    const allocated = allocs.reduce((sum, a) => sum + calculateAwbCount(a.startNumber, a.endNumber), 0);
                    const avail = total - allocated;
                    return <option key={m.id} value={m.id}>{m.prefix}-{m.startNumber} to {m.endNumber} (Available: {avail})</option>;
                  })}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Agent *</label>
                <select className="form-select" value={formData.agentProfileId} onChange={e => setFormData(prev => ({ ...prev, agentProfileId: e.target.value }))} required>
                  <option value="">Select agent</option>
                  {[...agents].sort((a, b) => (a.agentName || '').localeCompare(b.agentName || '')).map(a => (
                    <option key={a.id} value={a.id}>{a.agentName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Start Number *</label>
                <input type="text" className="form-input" value={formData.startNumber} onChange={e => setFormData(prev => ({ ...prev, startNumber: e.target.value }))} required maxLength={8} placeholder="8 digits" disabled={isEditing} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Quantity *</label>
                <input type="number" className="form-input" value={formData.quantity} onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value }))} required min="1" />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>End Number (auto)</label>
                <input type="text" className="form-input" value={formData.endNumber} readOnly style={{ background: 'var(--color-gray-50)', cursor: 'not-allowed' }} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Allocation Date *</label>
                <input type="date" className="form-input" value={formData.dateAllocated} onChange={e => setFormData(prev => ({ ...prev, dateAllocated: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="button button-ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : isEditing ? 'Update' : 'Allocate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──── MAIN PAGE ─────────────────────────────────── */
export default function AwbStockPage() {
  const { data: masters } = useFirestoreCollection('awbStockMasters');
  const { data: allocations } = useFirestoreCollection('awbStockAllocations');
  const { data: agents } = useFirestoreCollection('agentProfiles');
  const [tab, setTab] = useState(TABS.MASTERS);

  return (
    <Layout>
      <div className="page-wrapper">
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>AWB Stock</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)', marginTop: 4 }}>
            Manage master stock and agent allocations
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', marginBottom: 'var(--space-6)' }}>
          {[{ id: TABS.MASTERS, label: 'Master Stock' }, { id: TABS.ALLOCATIONS, label: 'Agent Allocations' }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -2,
                background: 'transparent',
                color: tab === t.id ? 'var(--color-primary)' : 'var(--color-gray-500)',
                fontWeight: tab === t.id ? 600 : 400,
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                transition: 'all 150ms',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === TABS.MASTERS
          ? <MastersSection masters={masters} allocations={allocations} />
          : <AllocationsSection masters={masters} allocations={allocations} agents={agents} />
        }
      </div>
    </Layout>
  );
}
