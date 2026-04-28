import React, { useState, useMemo } from 'react';
import { db } from '../services/firebase.js';
import {
  collection, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection.js';
import toast from 'react-hot-toast';

/**
 * Reusable CRUD page component.
 *
 * Props:
 *  - title: string
 *  - collectionName: string
 *  - initialFormData: object
 *  - fields: array of field descriptors (see below)
 *  - listColumns: array of { label, key | render(item) }
 *  - searchKeys: array of field keys to search in
 *  - onBeforeAdd?: async fn(data) => data  — transform/validate before save
 *  - onBeforeUpdate?: async fn(data) => data
 *  - onBeforeDelete?: async fn(id, items) => void
 *  - uniqueKey?: string — field key to check uniqueness on add
 *  - sortFn?: (a,b) => number
 *
 * Field descriptor:
 *  { key, label, type: 'text'|'email'|'tel'|'number'|'textarea'|'select'|'time',
 *    options?: [{value, label}],
 *    required?: bool, placeholder?, maxLength?, step?,
 *    transform?: fn(v)=>v,
 *    editDisabled?: bool,
 *    hideOnEdit?: bool }
 */
export default function CrudPage({
  title,
  collectionName,
  initialFormData,
  fields,
  listColumns,
  searchKeys = [],
  onBeforeAdd,
  onBeforeUpdate,
  onBeforeDelete,
  uniqueKey,
  sortFn,
  extraActions,
}) {
  const { data: items, isLoading } = useFirestoreCollection(collectionName);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const isEditing = !!editingItem;

  const filtered = useMemo(() => {
    let list = [...items];
    if (sortFn) list.sort(sortFn);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(item =>
      searchKeys.some(k => String(item[k] || '').toLowerCase().includes(q))
    );
  }, [items, search, sortFn]);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const openAdd = () => {
    setEditingItem(null);
    setFormData(initialFormData);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({ ...initialFormData, ...item });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing) {
        let data = { ...formData };
        if (onBeforeUpdate) data = await onBeforeUpdate(data);
        const { id, ...rest } = data;
        await updateDoc(doc(db, collectionName, editingItem.id), rest);
        toast.success('Record updated');
      } else {
        // Check uniqueness
        if (uniqueKey && items.some(i => i[uniqueKey]?.toUpperCase?.() === formData[uniqueKey]?.toUpperCase?.())) {
          toast.error(`A record with this ${uniqueKey} already exists`);
          setSaving(false);
          return;
        }
        let data = { ...formData };
        if (onBeforeAdd) data = await onBeforeAdd(data);
        await addDoc(collection(db, collectionName), data);
        toast.success('Record created');
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
      if (onBeforeDelete) await onBeforeDelete(id, items);
      await deleteDoc(doc(db, collectionName, id));
      toast.success('Record deleted');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>{title}</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)', marginTop: 4 }}>
            {items.length} record{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {extraActions}
          <button className="button button-primary" onClick={openAdd}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New
          </button>
        </div>
      </div>

      {/* Search */}
      {searchKeys.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <p>No records found{search ? ' matching your search' : ''}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {listColumns.map(col => (
                    <th key={col.label}>{col.label}</th>
                  ))}
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    {listColumns.map(col => (
                      <td key={col.label}>
                        {col.render ? col.render(item) : (item[col.key] ?? '—')}
                      </td>
                    ))}
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="button button-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </button>
                        {deleteConfirmId === item.id ? (
                          <>
                            <button
                              className="button button-danger"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleDelete(item.id)}
                            >
                              Confirm
                            </button>
                            <button
                              className="button button-ghost"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="button button-ghost"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--color-red-600)' }}
                            onClick={() => setDeleteConfirmId(item.id)}
                          >
                            Delete
                          </button>
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

      {/* Modal form */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4)',
        }}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            width: '100%',
            maxWidth: 520,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{
              padding: 'var(--space-5) var(--space-6)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1,
            }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-gray-900)' }}>
                {isEditing ? 'Edit record' : 'New record'}
              </h2>
              <button
                onClick={closeForm}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', display: 'flex' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 20, height: 20 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {fields.map(field => {
                  if (field.hideOnEdit && isEditing) return null;
                  const disabled = saving || (field.editDisabled && isEditing);
                  const value = formData[field.key] ?? '';

                  if (field.type === 'textarea') return (
                    <div key={field.key} className="form-group">
                      <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                        {field.label}{field.required && ' *'}
                      </label>
                      <textarea
                        className="form-textarea"
                        placeholder={field.placeholder || field.label}
                        value={value}
                        onChange={e => handleChange(field.key, field.transform ? field.transform(e.target.value) : e.target.value)}
                        required={field.required}
                        disabled={disabled}
                        rows={field.rows || 3}
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  );

                  if (field.type === 'select') return (
                    <div key={field.key} className="form-group">
                      <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                        {field.label}{field.required && ' *'}
                      </label>
                      <select
                        className="form-select"
                        value={value}
                        onChange={e => handleChange(field.key, field.transform ? field.transform(e.target.value) : e.target.value)}
                        required={field.required}
                        disabled={disabled}
                      >
                        {field.placeholder && <option value="">{field.placeholder}</option>}
                        {(field.options || []).map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  );

                  return (
                    <div key={field.key} className="form-group">
                      <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-gray-700)', display: 'block', marginBottom: 4 }}>
                        {field.label}{field.required && ' *'}
                      </label>
                      <input
                        type={field.type || 'text'}
                        className="form-input"
                        placeholder={field.placeholder || field.label}
                        value={value}
                        onChange={e => handleChange(field.key, field.transform ? field.transform(e.target.value) : e.target.value)}
                        required={field.required}
                        disabled={disabled}
                        maxLength={field.maxLength}
                        step={field.step}
                        min={field.min}
                        max={field.max}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
                <button type="button" className="button button-ghost" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={saving}>
                  {saving ? 'Saving…' : isEditing ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
