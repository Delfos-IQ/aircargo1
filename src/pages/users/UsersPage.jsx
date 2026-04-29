import React, { useState } from 'react';
import { db, secondaryAuth } from '../../services/firebase.js';
import { setDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useFirestoreCollection } from '../../hooks/useFirestoreCollection.js';
import { useAppContext } from '../../context/AppContext.jsx';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout.jsx';

const INITIAL = { username: '', email: '', password: '', role: 'user', agentId: '' };

export default function UsersPage() {
  const { data: users, isLoading } = useFirestoreCollection('userProfiles');
  const { agentProfiles } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const isEditing = !!editingUser;

  const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const openAdd = () => { setEditingUser(null); setFormData(INITIAL); setShowForm(true); };
  const openEdit = (u) => { setEditingUser(u); setFormData({ ...INITIAL, ...u }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingUser(null); setFormData(INITIAL); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username) { toast.error('Username is required'); return; }
    setSaving(true);
    try {
      if (isEditing) {
        const { id, uid, email, password, ...rest } = formData;
        await updateDoc(doc(db, 'userProfiles', editingUser.id), {
          ...rest,
          username: rest.username.toUpperCase(),
          agentId: rest.agentId || null,
        });
        toast.success('User updated');
      } else {
        if (!formData.email || !formData.password) { toast.error('Email and password are required'); setSaving(false); return; }
        // Use secondaryAuth so the admin session is NOT replaced by the new user
        const credential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        // Sign out from secondary instance immediately — it's only used for creation
        await signOut(secondaryAuth);
        // Document ID = Firebase UID — required for Firestore Security Rules
        await setDoc(doc(db, 'userProfiles', credential.user.uid), {
          uid:      credential.user.uid,
          email:    formData.email.toLowerCase(),
          username: formData.username.toUpperCase(),
          role:     formData.role || 'user',
          agentId:  formData.agentId || null,
        });
        toast.success('User created');
      }
      closeForm();
    } catch (err) {
      console.error(err);
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'userProfiles', id));
      toast.success('User deleted from system');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setDeleteConfirmId(null);
  };

  return (
    <Layout>
      <div className="page-wrapper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>User Management</h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)', marginTop: 4 }}>{users.length} user{users.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="button button-primary" onClick={openAdd}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New User
          </button>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              <p>No users registered</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Agent ID</th>
                    <th style={{ width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-full)',
                            fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                            background: u.role === 'admin' ? '#dbeafe' : u.role === 'operator' ? '#d1fae5' : '#f3f4f6',
                            color:      u.role === 'admin' ? '#1e40af' : u.role === 'operator' ? '#065f46' : '#4b5563',
                          }}>
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>
                        {u.agentId || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="button button-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => openEdit(u)}>Edit</button>
                          {deleteConfirmId === u.id ? (
                            <>
                              <button className="button button-danger" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleDelete(u.id)}>Confirm</button>
                              <button className="button button-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                            </>
                          ) : (
                            <button className="button button-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--color-red-600)' }} onClick={() => setDeleteConfirmId(u.id)}>Delete</button>
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

        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{isEditing ? 'Edit User' : 'New User'}</h2>
                <button onClick={closeForm} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', display: 'flex' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 20, height: 20 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Username *</label>
                  <input type="text" className="form-input" value={formData.username} onChange={e => handleChange('username', e.target.value.toUpperCase())} required placeholder="USERNAME" />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Email *</label>
                  <input type="email" className="form-input" value={formData.email} onChange={e => handleChange('email', e.target.value.toLowerCase())} required disabled={isEditing} placeholder="user@company.com" />
                </div>
                {!isEditing && (
                  <div className="form-group">
                    <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Password *</label>
                    <input type="password" className="form-input" value={formData.password} onChange={e => handleChange('password', e.target.value)} required={!isEditing} placeholder="Minimum 6 characters" />
                  </div>
                )}
                <div className="form-group">
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Role *</label>
                  <select className="form-select" value={formData.role} onChange={e => handleChange('role', e.target.value)}>
                    <option value="user">Agent — only own bookings</option>
                    <option value="operator">Operator — all operations, no billing/users</option>
                    <option value="admin">Admin — full access</option>
                  </select>
                </div>
                {formData.role !== 'admin' && (
                  <div className="form-group">
                    <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                      Linked Agent Profile
                      <span style={{ fontWeight: 400, color: 'var(--color-gray-500)', marginLeft: 4 }}>(optional)</span>
                    </label>
                    <select
                      className="form-select"
                      value={formData.agentId || ''}
                      onChange={e => handleChange('agentId', e.target.value)}
                    >
                      <option value="">— not linked —</option>
                      {(agentProfiles || []).map(a => (
                        <option key={a.id} value={a.agentId}>{a.agentName} ({a.agentId})</option>
                      ))}
                    </select>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: 4 }}>
                      Determines which bookings this user can see and create.
                    </p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                  <button type="button" className="button button-ghost" onClick={closeForm} disabled={saving}>Cancel</button>
                  <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : isEditing ? 'Update' : 'Create User'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
