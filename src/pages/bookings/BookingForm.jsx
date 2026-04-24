import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, query, where, getDocs, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase.js';
import { useAppContext } from '../../context/AppContext.jsx';
import {
  airlinePrefixData, iataNatureOfGoodsData, iataOtherChargeCodes,
  shcCodeData, paymentTypes, bookingStatusOptions, twoLetterAirlineCodes,
} from '../../data/index.js';
import {
  generateUniqueId, calculateAwbCount, getNextAwbSerial, isSerialLTE,
  calculateVolumeM3, calculateChargeableWeight, getRateForBooking, validateBookingData,
  formatNumberWithSeparators,
} from '../../utils/index.js';
import toast from 'react-hot-toast';

/* ─── Initial form state ─── */
const INITIAL_FORM = {
  awbInputPrefix: '', awbInputNumber: '',
  origin: '', destination: '',
  pieces: '', weightKg: '',
  natureOfGoods: '', natureOfGoodsCustom: '',
  selectedShcCode: '',
  flightSegments: [],
  dimensionLines: [],
  selectedShipperProfileId: '', shipperName: '', shipperStreet: '',
  shipperCity: '', shipperZip: '', shipperCountry: '', shipperContact: '',
  selectedConsigneeProfileId: '', consigneeName: '', consigneeStreet: '',
  consigneeCity: '', consigneeZip: '', consigneeCountry: '', consigneeContact: '',
  selectedAgentProfileId: '', agentNameDisplay: '', agentCassDisplay: '',
  agentIdInput: '', agentAddressDisplay: '', agentCityForFFR: '',
  currency: 'EUR', ratePerKg: '0.00', isRateOverridden: false,
  otherCharges: [],
  paymentType: 'PPD', ffrReference: '', handlingInformation: '',
  osiGhaText: 'GHA: ', ffrRemarks: '', bookingStatus: 'NN', isFlown: false,
};

/* ─── Main component ─── */
export default function BookingForm({ onSuccess, editingBooking = null }) {
  const isEditMode = !!editingBooking;
  const {
    currentUserProfile, agentProfiles, shipperProfiles, consigneeProfiles,
    flightSchedules, iataAirportCodes, awbStockAllocations, rateTableEntries, bookings,
  } = useAppContext();

  // Build initial state from editing booking if provided
  const buildFormFromBooking = (b) => ({
    ...INITIAL_FORM,
    awbInputPrefix: b.awbInputPrefix || '',
    awbInputNumber: b.awbInputNumber || '',
    origin: b.origin || '',
    destination: b.destination || '',
    pieces: b.pieces || '',
    weightKg: b.weightKg || '',
    natureOfGoods: b.natureOfGoods || '',
    natureOfGoodsCustom: '',
    selectedShcCode: b.selectedShcCode || '',
    flightSegments: b.flightSegments || [],
    dimensionLines: b.dimensionLines || [],
    selectedShipperProfileId: b.selectedShipperProfileId || '',
    shipperName: b.shipperName || '',
    shipperStreet: b.shipperStreet || '',
    shipperCity: b.shipperCity || '',
    shipperZip: b.shipperZip || '',
    shipperCountry: b.shipperCountry || '',
    shipperContact: b.shipperContact || '',
    selectedConsigneeProfileId: b.selectedConsigneeProfileId || '',
    consigneeName: b.consigneeName || '',
    consigneeStreet: b.consigneeStreet || '',
    consigneeCity: b.consigneeCity || '',
    consigneeZip: b.consigneeZip || '',
    consigneeCountry: b.consigneeCountry || '',
    consigneeContact: b.consigneeContact || '',
    selectedAgentProfileId: b.selectedAgentProfileId || '',
    agentNameDisplay: b.agent_details_name || '',
    agentCassDisplay: b.agentIataCassNumber || '',
    agentIdInput: b.agent_id || '',
    agentAddressDisplay: b.agentAddress || '',
    agentCityForFFR: b.agentCity || '',
    currency: b.currency || 'EUR',
    ratePerKg: b.ratePerKg || '0.00',
    isRateOverridden: b.isRateOverridden || false,
    otherCharges: b.otherCharges || [],
    paymentType: b.paymentType || 'PPD',
    ffrReference: b.ffrReference || '',
    handlingInformation: b.handlingInformation || '',
    osiGhaText: b.osiGhaText || 'GHA: ',
    ffrRemarks: b.ffrRemarks || '',
    bookingStatus: b.bookingStatus || 'NN',
    isFlown: b.isFlown || false,
  });

  const [form, setForm] = useState(isEditMode ? buildFormFromBooking(editingBooking) : INITIAL_FORM);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Derived display values ── */
  const [displayChargeableWeightKg, setDisplayChargeableWeightKg] = useState('0.0');
  const [displayVolumeM3, setDisplayVolumeM3] = useState('0.000');
  const [displayFreightCharges, setDisplayFreightCharges] = useState('0.00');
  const [displayTotalCharges, setDisplayTotalCharges] = useState('0.00');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target?.value ?? e }));

  /* ── Auto calculations ── */
  useEffect(() => {
    const volStr = calculateVolumeM3(form.dimensionLines);
    const chgStr = calculateChargeableWeight(form.weightKg, form.dimensionLines);
    const vol = parseFloat(volStr) || 0;
    const chg = parseFloat(chgStr) || 0;
    setDisplayVolumeM3(vol.toFixed(3));
    setDisplayChargeableWeightKg(chg.toFixed(1));

    const rateTable = rateTableEntries?.filter(r => r.agentProfileId === form.selectedAgentProfileId) || [];
    const rate = form.isRateOverridden
      ? parseFloat(form.ratePerKg) || 0
      : getRateForBooking(form.origin, form.destination, form.currency, chg, rateTable);

    if (!form.isRateOverridden) setForm(f => ({ ...f, ratePerKg: rate.toFixed(2) }));

    const freight = chg * (parseFloat(form.isRateOverridden ? form.ratePerKg : rate) || 0);
    setDisplayFreightCharges(freight.toFixed(2));

    const otherTotal = (form.otherCharges || []).reduce((s, c) => s + (parseFloat(c.chargeAmount) || 0), 0);
    setDisplayTotalCharges((freight + otherTotal).toFixed(2));
  }, [form.weightKg, form.dimensionLines, form.origin, form.destination, form.currency,
      form.ratePerKg, form.isRateOverridden, form.otherCharges, form.selectedAgentProfileId, rateTableEntries]);

  /* ── Select agent → auto-assign AWB ── */
  const handleAgentSelect = useCallback((agentId) => {
    const profile = agentProfiles?.find(p => p.id === agentId);
    if (!profile) {
      setForm(f => ({ ...f, selectedAgentProfileId: '', agentNameDisplay: '', agentCassDisplay: '', agentIdInput: '', agentAddressDisplay: '', agentCityForFFR: '', awbInputPrefix: '', awbInputNumber: '' }));
      return;
    }
    const updates = {
      selectedAgentProfileId: agentId,
      agentNameDisplay: profile.agentName,
      agentCassDisplay: profile.agentIataCassNumber || '',
      agentIdInput: profile.agentId || '',
      agentAddressDisplay: profile.agentAddress || '',
      agentCityForFFR: profile.agentCity || '',
    };
    // Auto-assign next available AWB
    const allocs = (awbStockAllocations || [])
      .filter(a => a.agentProfileId === agentId)
      .sort((a, b) => a.startNumber.localeCompare(b.startNumber));
    let found = false;
    for (const alloc of allocs) {
      let serial = alloc.startNumber;
      const max = calculateAwbCount(alloc.startNumber, alloc.endNumber);
      for (let i = 0; i < max; i++) {
        if (!(alloc.usedAwbs || []).includes(serial)) {
          updates.awbInputPrefix = alloc.prefix;
          updates.awbInputNumber = serial;
          found = true;
          break;
        }
        const next = getNextAwbSerial(serial);
        if (!next) break;
        serial = next;
      }
      if (found) break;
    }
    if (!found) {
      updates.awbInputPrefix = '';
      updates.awbInputNumber = '';
      setFormError(`No AWBs available in stock for agent ${profile.agentName}.`);
    }
    setForm(f => ({ ...f, ...updates }));
  }, [agentProfiles, awbStockAllocations]);

  /* ── Select shipper ── */
  const handleShipperSelect = (id) => {
    const p = shipperProfiles?.find(s => s.id === id);
    if (!p) { setForm(f => ({ ...f, selectedShipperProfileId: '' })); return; }
    setForm(f => ({
      ...f,
      selectedShipperProfileId: id,
      shipperName: p.shipperName || '', shipperStreet: p.shipperStreet || '',
      shipperCity: p.shipperCity || '', shipperZip: p.shipperZip || '',
      shipperCountry: p.shipperCountry || '', shipperContact: p.shipperPhone || '',
    }));
  };

  /* ── Select consignee ── */
  const handleConsigneeSelect = (id) => {
    const p = consigneeProfiles?.find(c => c.id === id);
    if (!p) { setForm(f => ({ ...f, selectedConsigneeProfileId: '' })); return; }
    setForm(f => ({
      ...f,
      selectedConsigneeProfileId: id,
      consigneeName: p.consigneeName || '', consigneeStreet: p.consigneeStreet || '',
      consigneeCity: p.consigneeCity || '', consigneeZip: p.consigneeZip || '',
      consigneeCountry: p.consigneeCountry || '', consigneeContact: p.consigneePhone || '',
    }));
  };

  /* ── Flight segments ── */
  const addFlight = () => setForm(f => ({
    ...f, flightSegments: [...f.flightSegments, { id: generateUniqueId(), flightScheduleId: '', flightNumber: '', departureDate: '', segmentOrigin: '', segmentDestination: '', carrierCode: '' }]
  }));
  const removeFlight = (id) => setForm(f => ({ ...f, flightSegments: f.flightSegments.filter(s => s.id !== id) }));
  const updateFlight = (id, field, value) => setForm(f => ({
    ...f, flightSegments: f.flightSegments.map(s => {
      if (s.id !== id) return s;
      if (field === 'flightScheduleId') {
        const sched = flightSchedules?.find(fs => fs.id === value);
        return sched
          ? { ...s, flightScheduleId: value, flightNumber: sched.flightNumber, segmentOrigin: sched.origin, segmentDestination: sched.destination, carrierCode: sched.carrierCode }
          : { ...s, flightScheduleId: '', flightNumber: '', segmentOrigin: '', segmentDestination: '', carrierCode: '' };
      }
      return { ...s, [field]: value };
    })
  }));

  /* ── Dimension lines ── */
  const addDim = () => setForm(f => ({ ...f, dimensionLines: [...f.dimensionLines, { id: generateUniqueId(), pieces: '', length: '', width: '', height: '' }] }));
  const removeDim = (id) => setForm(f => ({ ...f, dimensionLines: f.dimensionLines.filter(d => d.id !== id) }));
  const updateDim = (id, field, value) => setForm(f => ({ ...f, dimensionLines: f.dimensionLines.map(d => d.id === id ? { ...d, [field]: value } : d) }));

  /* ── Other charges ── */
  const addCharge = () => setForm(f => ({ ...f, otherCharges: [...f.otherCharges, { id: generateUniqueId(), chargeCode: '', chargeDescription: '', chargeAmount: '' }] }));
  const removeCharge = (id) => setForm(f => ({ ...f, otherCharges: f.otherCharges.filter(c => c.id !== id) }));
  const updateCharge = (id, field, value) => setForm(f => ({
    ...f, otherCharges: f.otherCharges.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      if (field === 'chargeCode') {
        const pre = iataOtherChargeCodes.find(x => x.code === value);
        updated.chargeDescription = pre ? pre.description : '';
      }
      return updated;
    })
  }));

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const finalNog = form.natureOfGoods === 'OTH' ? form.natureOfGoodsCustom?.trim() : form.natureOfGoods;
    if (!finalNog) { setFormError('Please specify the nature of goods.'); return; }

    const data = {
      awbInputPrefix: form.awbInputPrefix,
      awbInputNumber: form.awbInputNumber,
      awb: `${form.awbInputPrefix}-${form.awbInputNumber}`,
      origin: form.origin, destination: form.destination,
      pieces: form.pieces, weightKg: form.weightKg,
      chargeableWeightKg: displayChargeableWeightKg,
      volumeM3: displayVolumeM3,
      natureOfGoods: finalNog, selectedShcCode: form.selectedShcCode,
      flightSegments: form.flightSegments, dimensionLines: form.dimensionLines,
      selectedShipperProfileId: form.selectedShipperProfileId,
      shipperName: form.shipperName, shipperStreet: form.shipperStreet,
      shipperCity: form.shipperCity, shipperZip: form.shipperZip,
      shipperCountry: form.shipperCountry, shipperContact: form.shipperContact,
      selectedConsigneeProfileId: form.selectedConsigneeProfileId,
      consigneeName: form.consigneeName, consigneeStreet: form.consigneeStreet,
      consigneeCity: form.consigneeCity, consigneeZip: form.consigneeZip,
      consigneeCountry: form.consigneeCountry, consigneeContact: form.consigneeContact,
      selectedAgentProfileId: form.selectedAgentProfileId,
      agent_details_name: form.agentNameDisplay,
      agentIataCassNumber: form.agentCassDisplay,
      agent_id: form.agentIdInput,
      agentAddress: form.agentAddressDisplay,
      agentCity: form.agentCityForFFR,
      currency: form.currency, ratePerKg: form.ratePerKg,
      isRateOverridden: form.isRateOverridden,
      freightCharges: displayFreightCharges,
      otherCharges: form.otherCharges,
      totalCalculatedCharges: displayTotalCharges,
      paymentType: form.paymentType,
      ffrReference: form.ffrReference,
      handlingInformation: form.handlingInformation,
      osiGhaText: form.osiGhaText,
      ffrRemarks: form.ffrRemarks,
      bookingStatus: form.bookingStatus,
      isFlown: form.isFlown,
    };

    const validationError = validateBookingData(data);
    if (validationError) { setFormError(validationError); return; }

    // ── Capacity check (before any Firestore write) ──
    for (const seg of data.flightSegments) {
      if (!seg.flightScheduleId || !seg.departureDate) continue;
      const key = `${seg.flightScheduleId}_${seg.departureDate}`;
      const cap = flightCapacityMap[key];
      if (!cap || cap.maxKg === null) continue;
      const thisKg = parseFloat(displayChargeableWeightKg) || 0;
      if (cap.bookedKg + thisKg > cap.maxKg) {
        const avail = Math.max(0, cap.maxKg - cap.bookedKg).toFixed(1);
        setFormError(
          `Cannot book: flight ${cap.flightNumber || seg.flightNumber} on ${seg.departureDate} ` +
          `has only ${avail} kg available. This shipment requires ${thisKg.toFixed(1)} kg.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // ── EDIT MODE: simple updateDoc ──
      if (isEditMode && editingBooking?.id) {
        await updateDoc(doc(db, 'bookings', editingBooking.id), {
          ...data,
          updatedAt: serverTimestamp(),
          updatedBy: currentUserProfile?.email || 'unknown',
        });
        toast.success('Booking updated successfully.');
        onSuccess?.();
        return;
      }

      // ── CREATE MODE: transaction with AWB stock lock ──
      data.createdAt = serverTimestamp();
      data.createdBy = currentUserProfile?.email || 'unknown';

      const allocQuery = query(
        collection(db, 'awbStockAllocations'),
        where('prefix', '==', data.awbInputPrefix),
        where('agentProfileId', '==', data.selectedAgentProfileId)
      );
      const allocSnap = await getDocs(allocQuery);
      let allocId = null, currentUsedAwbs = [];
      allocSnap.forEach(d => {
        const a = d.data();
        if (isSerialLTE(a.startNumber, data.awbInputNumber) && isSerialLTE(data.awbInputNumber, a.endNumber)) {
          allocId = d.id;
          currentUsedAwbs = a.usedAwbs || [];
        }
      });
      if (!allocId) throw new Error('No valid AWB allocation found for this agent.');

      await runTransaction(db, async (tx) => {
        const awbUsageRef = doc(db, 'awbUsage', data.awb);
        const awbUsageDoc = await tx.get(awbUsageRef);
        if (awbUsageDoc.exists()) throw new Error(`AWB ${data.awb} has already been used.`);
        const updatedUsed = [...currentUsedAwbs];
        if (!updatedUsed.includes(data.awbInputNumber)) updatedUsed.push(data.awbInputNumber);
        const newRef = doc(collection(db, 'bookings'));
        tx.set(newRef, data);
        tx.update(doc(db, 'awbStockAllocations', allocId), { usedAwbs: updatedUsed });
        tx.set(awbUsageRef, { bookingId: newRef.id });
      });

      toast.success('Booking created successfully.');
      setForm(INITIAL_FORM);
      setFormError(null);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      setFormError(err.message);
      toast.error(isEditMode ? 'Error updating booking.' : 'Error creating booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Real-time flight capacity map ── */
  const flightCapacityMap = useMemo(() => {
    const map = {};
    (form.flightSegments || []).forEach(seg => {
      if (!seg.flightScheduleId || !seg.departureDate) return;
      const key = `${seg.flightScheduleId}_${seg.departureDate}`;
      if (map[key] !== undefined) return;
      const flight = (flightSchedules || []).find(f => f.id === seg.flightScheduleId);
      const maxKg  = parseFloat(flight?.maxPayloadKg)  || null;
      const maxCbm = parseFloat(flight?.maxPayloadCbm) || null;
      const bookedKg = (bookings || []).reduce((sum, b) => {
        if (isEditMode && b.id === editingBooking?.id) return sum;
        const hit = (b.flightSegments || []).find(
          s => s.flightScheduleId === seg.flightScheduleId && s.departureDate === seg.departureDate
        );
        return hit ? sum + (parseFloat(b.chargeableWeightKg) || 0) : sum;
      }, 0);
      map[key] = { maxKg, maxCbm, bookedKg, flightNumber: flight?.flightNumber || seg.flightNumber };
    });
    return map;
  }, [form.flightSegments, flightSchedules, bookings, isEditMode, editingBooking]);

  /* ── Airports list ── */
  const airports = useMemo(() => {
    const managed = (iataAirportCodes || []).map(a => ({ code: a.code, label: `${a.code} — ${a.cityName || a.code}` }));
    if (managed.length) return managed;
    return [];
  }, [iataAirportCodes]);

  const S = { marginBottom: 'var(--space-6)' };

  return (
    <form onSubmit={handleSubmit}>
      {formError && (
        <div style={{
          background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
          color: 'var(--color-danger-text)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-size-sm)',
        }}>
          {formError}
        </div>
      )}

      {/* ── 1. AWB & AGENT ── */}
      <div className="card" style={S}>
        <div className="card-header"><span className="card-title">AWB & Agent</span></div>
        <div className="card-body">
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label required">Agent</label>
              <select className="form-select" value={form.selectedAgentProfileId} onChange={e => handleAgentSelect(e.target.value)}>
                <option value="">Select agent…</option>
                {(agentProfiles || []).map(a => <option key={a.id} value={a.id}>{a.agentName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">AWB Prefix</label>
              <input className="form-input font-mono" value={form.awbInputPrefix} onChange={set('awbInputPrefix')} placeholder="180" />
            </div>
            <div className="form-group">
              <label className="form-label required">AWB Number</label>
              <input className="form-input font-mono" value={form.awbInputNumber} onChange={set('awbInputNumber')} placeholder="00000000" />
            </div>
          </div>
          {form.agentNameDisplay && (
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span className="badge badge-blue">{form.agentNameDisplay}</span>
              {form.agentCassDisplay && <span className="badge badge-gray">CASS: {form.agentCassDisplay}</span>}
              {form.agentAddressDisplay && <span className="badge badge-gray">{form.agentAddressDisplay}</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. ROUTE ── */}
      <div className="card" style={S}>
        <div className="card-header"><span className="card-title">Route</span></div>
        <div className="card-body">
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Origin (IATA)</label>
              {airports.length > 0 ? (
                <select className="form-select" value={form.origin} onChange={set('origin')}>
                  <option value="">Select origin…</option>
                  {airports.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
                </select>
              ) : (
                <input className="form-input" value={form.origin} onChange={set('origin')} placeholder="MAD" maxLength={3} style={{ textTransform: 'uppercase' }} />
              )}
            </div>
            <div className="form-group">
              <label className="form-label required">Destination (IATA)</label>
              {airports.length > 0 ? (
                <select className="form-select" value={form.destination} onChange={set('destination')}>
                  <option value="">Select destination…</option>
                  {airports.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
                </select>
              ) : (
                <input className="form-input" value={form.destination} onChange={set('destination')} placeholder="JFK" maxLength={3} style={{ textTransform: 'uppercase' }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. CARGO ── */}
      <div className="card" style={S}>
        <div className="card-header"><span className="card-title">Cargo</span></div>
        <div className="card-body">
          <div className="form-grid form-grid-4">
            <div className="form-group">
              <label className="form-label required">Pieces (pcs)</label>
              <input type="number" className="form-input" value={form.pieces} onChange={set('pieces')} placeholder="0" min="1" />
            </div>
            <div className="form-group">
              <label className="form-label required">Actual weight (kg)</label>
              <input type="number" className="form-input" value={form.weightKg} onChange={set('weightKg')} placeholder="0.0" step="0.1" />
            </div>
            <div className="form-group">
              <label className="form-label">Volume (m³)</label>
              <input className="form-input" value={displayVolumeM3} readOnly style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-500)' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Chargeable weight (kg)</label>
              <input className="form-input" value={displayChargeableWeightKg} readOnly style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-500)' }} />
            </div>
          </div>
          <div className="form-grid form-grid-2" style={{ marginTop: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label required">Nature of goods</label>
              <select className="form-select" value={iataNatureOfGoodsData.some(n => n.description === form.natureOfGoods) ? iataNatureOfGoodsData.find(n => n.description === form.natureOfGoods)?.code : (form.natureOfGoods ? 'OTH' : '')}
                onChange={e => {
                  const item = iataNatureOfGoodsData.find(n => n.code === e.target.value);
                  setForm(f => ({ ...f, natureOfGoods: item ? item.description : 'OTH', natureOfGoodsCustom: '' }));
                }}>
                <option value="">Select…</option>
                {iataNatureOfGoodsData.map(n => <option key={n.code} value={n.code}>{n.description}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">SHC Code</label>
              <select className="form-select" value={form.selectedShcCode} onChange={set('selectedShcCode')}>
                <option value="">No SHC</option>
                {shcCodeData.map(s => <option key={s.code} value={s.code}>{s.code} — {s.description}</option>)}
              </select>
            </div>
          </div>
          {(form.natureOfGoods === 'OTH' || !iataNatureOfGoodsData.some(n => n.description === form.natureOfGoods)) && form.natureOfGoods && (
            <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
              <label className="form-label required">Specify cargo</label>
              <input className="form-input" value={form.natureOfGoodsCustom} onChange={set('natureOfGoodsCustom')} placeholder="Describe the cargo…" />
            </div>
          )}
        </div>
      </div>

      {/* ── 4. DIMENSIONS ── */}
      <div className="card" style={S}>
        <div className="card-header">
          <span className="card-title">Dimensions</span>
          <button type="button" className="button button-secondary button-sm" onClick={addDim}>+ Add row</button>
        </div>
        <div className="card-body">
          {form.dimensionLines.length === 0 ? (
            <p style={{ color: 'var(--color-gray-400)', fontSize: 'var(--font-size-sm)' }}>No dimensions added. Volume will be calculated automatically.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {form.dimensionLines.map((d, i) => (
                <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <input className="form-input" value={d.pieces} onChange={e => updateDim(d.id, 'pieces', e.target.value)} placeholder="Pieces" type="number" min="1" />
                  <input className="form-input" value={d.length} onChange={e => updateDim(d.id, 'length', e.target.value)} placeholder="Length (cm)" type="number" />
                  <input className="form-input" value={d.width} onChange={e => updateDim(d.id, 'width', e.target.value)} placeholder="Width (cm)" type="number" />
                  <input className="form-input" value={d.height} onChange={e => updateDim(d.id, 'height', e.target.value)} placeholder="Height (cm)" type="number" />
                  <button type="button" className="button button-danger button-sm button-icon" onClick={() => removeDim(d.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. FLIGHT SEGMENTS ── */}
      <div className="card" style={S}>
        <div className="card-header">
          <span className="card-title">Flight Segments</span>
          <button type="button" className="button button-secondary button-sm" onClick={addFlight}>+ Add flight</button>
        </div>
        <div className="card-body">
          {form.flightSegments.length === 0 ? (
            <p style={{ color: 'var(--color-gray-400)', fontSize: 'var(--font-size-sm)' }}>No flights added.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {form.flightSegments.map((seg, i) => (
                <div key={seg.id} style={{ background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-600)' }}>SEGMENT {i + 1}</span>
                    <button type="button" className="button button-danger button-sm" onClick={() => removeFlight(seg.id)}>Remove</button>
                  </div>
                  <div className="form-grid form-grid-3">
                    <div className="form-group">
                      <label className="form-label">Scheduled flight</label>
                      <select className="form-select" value={seg.flightScheduleId} onChange={e => updateFlight(seg.id, 'flightScheduleId', e.target.value)}>
                        <option value="">Manual…</option>
                        {(flightSchedules || []).map(fs => <option key={fs.id} value={fs.id}>{fs.flightNumber} — {fs.origin}→{fs.destination}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Flight number</label>
                      <input className="form-input" value={seg.flightNumber} onChange={e => updateFlight(seg.id, 'flightNumber', e.target.value.toUpperCase())} placeholder="IB6251" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Departure date</label>
                      <input type="date" className="form-input" value={seg.departureDate} onChange={e => updateFlight(seg.id, 'departureDate', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Origin</label>
                      <input className="form-input" value={seg.segmentOrigin} onChange={e => updateFlight(seg.id, 'segmentOrigin', e.target.value.toUpperCase())} placeholder="MAD" maxLength={3} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Destination</label>
                      <input className="form-input" value={seg.segmentDestination} onChange={e => updateFlight(seg.id, 'segmentDestination', e.target.value.toUpperCase())} placeholder="JFK" maxLength={3} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Carrier</label>
                      <input className="form-input" value={seg.carrierCode} onChange={e => updateFlight(seg.id, 'carrierCode', e.target.value.toUpperCase())} placeholder="IB" maxLength={2} />
                    </div>
                  </div>
                  {/* ── Capacity indicator ── */}
                  {(() => {
                    const key = `${seg.flightScheduleId}_${seg.departureDate}`;
                    const cap = seg.flightScheduleId && seg.departureDate ? flightCapacityMap[key] : null;
                    if (!cap) return null;
                    if (cap.maxKg === null) return (
                      <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-400)' }}>
                        No payload limit configured for this flight.
                      </div>
                    );
                    const thisKg    = parseFloat(displayChargeableWeightKg) || 0;
                    const afterKg   = cap.bookedKg + thisKg;
                    const pct       = cap.maxKg > 0 ? Math.round((afterKg / cap.maxKg) * 100) : 0;
                    const availKg   = Math.max(0, cap.maxKg - cap.bookedKg);
                    const isFull    = afterKg > cap.maxKg;
                    const isWarning = !isFull && pct >= 80;
                    const barColor  = isFull ? '#ef4444' : isWarning ? '#f59e0b' : '#22c55e';
                    const bgColor   = isFull ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0fdf4';
                    const txtColor  = isFull ? '#991b1b' : isWarning ? '#92400e' : '#166534';
                    return (
                      <div style={{ marginTop: 'var(--space-3)', background: bgColor, borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: txtColor }}>
                            {isFull ? '🔴 Over capacity' : isWarning ? '🟡 Near capacity' : '🟢 Capacity available'}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: txtColor, fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6, marginBottom: 6 }}>
                          <div style={{ background: barColor, borderRadius: 99, height: 6, width: `${Math.min(pct, 100)}%`, transition: 'width 300ms' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: txtColor }}>
                          <span>Booked: <strong>{cap.bookedKg.toFixed(1)} kg</strong></span>
                          <span>This shipment: <strong>+{thisKg.toFixed(1)} kg</strong></span>
                          <span>Available: <strong>{availKg.toFixed(1)} kg</strong></span>
                          <span>Max: <strong>{cap.maxKg.toLocaleString()} kg</strong></span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 6. SHIPPER ── */}
      <div className="card" style={S}>
        <div className="card-header"><span className="card-title">Shipper</span></div>
        <div className="card-body">
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Load from profile</label>
            <select className="form-select" value={form.selectedShipperProfileId} onChange={e => handleShipperSelect(e.target.value)}>
              <option value="">Manual entry…</option>
              {(shipperProfiles || []).map(s => <option key={s.id} value={s.id}>{s.shipperName}</option>)}
            </select>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Name</label>
              <input className="form-input" value={form.shipperName} onChange={set('shipperName')} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact</label>
              <input className="form-input" value={form.shipperContact} onChange={set('shipperContact')} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={form.shipperStreet} onChange={set('shipperStreet')} />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={form.shipperCity} onChange={set('shipperCity')} />
            </div>
            <div className="form-group">
              <label className="form-label">ZIP</label>
              <input className="form-input" value={form.shipperZip} onChange={set('shipperZip')} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input className="form-input" value={form.shipperCountry} onChange={set('shipperCountry')} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. CONSIGNEE ── */}
      <div className="card" style={S}>
        <div className="card-header"><span className="card-title">Consignee</span></div>
        <div className="card-body">
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Load from profile</label>
            <select className="form-select" value={form.selectedConsigneeProfileId} onChange={e => handleConsigneeSelect(e.target.value)}>
              <option value="">Manual entry…</option>
              {(consigneeProfiles || []).map(c => <option key={c.id} value={c.id}>{c.consigneeName}</option>)}
            </select>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Name</label>
              <input className="form-input" value={form.consigneeName} onChange={set('consigneeName')} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact</label>
              <input className="form-input" value={form.consigneeContact} onChange={set('consigneeContact')} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={form.consigneeStreet} onChange={set('consigneeStreet')} />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={form.consigneeCity} onChange={set('consigneeCity')} />
            </div>
            <div className="form-group">
              <label className="form-label">ZIP</label>
              <input className="form-input" value={form.consigneeZip} onChange={set('consigneeZip')} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input className="form-input" value={form.consigneeCountry} onChange={set('consigneeCountry')} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 8. RATES & CHARGES ── */}
      <div className="card" style={S}>
        <div className="card-header"><span className="card-title">Rates & Charges</span></div>
        <div className="card-body">
          <div className="form-grid form-grid-4" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={set('currency')}>
                {['EUR','USD','GBP','CHF','AED','SAR'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Rate/kg</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input type="number" className="form-input" value={form.ratePerKg} onChange={e => setForm(f => ({ ...f, ratePerKg: e.target.value, isRateOverridden: true }))} step="0.01" />
                {form.isRateOverridden && (
                  <button type="button" className="button button-ghost button-sm" title="Reset to automatic rate" onClick={() => setForm(f => ({ ...f, isRateOverridden: false }))}>↺</button>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Freight</label>
              <input className="form-input" value={`${form.currency} ${displayFreightCharges}`} readOnly style={{ background: 'var(--color-gray-50)', fontWeight: 600 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Total</label>
              <input className="form-input" value={`${form.currency} ${displayTotalCharges}`} readOnly style={{ background: 'var(--color-primary-50)', fontWeight: 700, color: 'var(--color-primary-700)' }} />
            </div>
          </div>

          {/* Other charges */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-700)' }}>Other charges</span>
              <button type="button" className="button button-secondary button-sm" onClick={addCharge}>+ Add charge</button>
            </div>
            {form.otherCharges.map(c => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                <select className="form-select" value={c.chargeCode} onChange={e => updateCharge(c.id, 'chargeCode', e.target.value)}>
                  <option value="">Code…</option>
                  {iataOtherChargeCodes.map(x => <option key={x.code} value={x.code}>{x.code}</option>)}
                </select>
                <input className="form-input" value={c.chargeDescription} onChange={e => updateCharge(c.id, 'chargeDescription', e.target.value)} placeholder="Description" />
                <input type="number" className="form-input" value={c.chargeAmount} onChange={e => updateCharge(c.id, 'chargeAmount', e.target.value)} placeholder="0.00" step="0.01" />
                <button type="button" className="button button-danger button-sm button-icon" onClick={() => removeCharge(c.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 9. ADDITIONAL INFO ── */}
      <div className="card" style={S}>
        <div className="card-header"><span className="card-title">Additional Information</span></div>
        <div className="card-body">
          <div className="form-grid form-grid-3" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Payment type</label>
              <select className="form-select" value={form.paymentType} onChange={set('paymentType')}>
                {paymentTypes.map(p => <option key={p.code} value={p.code}>{p.code} — {p.description}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Booking status</label>
              <select className="form-select" value={form.bookingStatus} onChange={set('bookingStatus')}>
                {bookingStatusOptions.map(s => <option key={s.code} value={s.code}>{s.code} — {s.description}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">FFR Reference</label>
              <input className="form-input" value={form.ffrReference} onChange={set('ffrReference')} />
            </div>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Handling instructions</label>
              <textarea className="form-textarea" value={form.handlingInformation} onChange={set('handlingInformation')} rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">OSI / GHA</label>
              <textarea className="form-textarea" value={form.osiGhaText} onChange={set('osiGhaText')} rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">FFR Remarks</label>
              <textarea className="form-textarea" value={form.ffrRemarks} onChange={set('ffrRemarks')} rows={2} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingTop: 'var(--space-6)' }}>
              <input type="checkbox" id="isFlown" checked={form.isFlown} onChange={e => setForm(f => ({ ...f, isFlown: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="isFlown" style={{ fontWeight: 500, color: 'var(--color-gray-700)', cursor: 'pointer' }}>Goods flown (isFlown)</label>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUBMIT ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingBottom: 'var(--space-8)' }}>
        {!isEditMode && (
          <button type="button" className="button button-secondary" onClick={() => { setForm(INITIAL_FORM); setFormError(null); }}>
            Clear form
          </button>
        )}
        {isEditMode && (
          <button type="button" className="button button-ghost" onClick={() => onSuccess?.()}>
            Cancel
          </button>
        )}
        <button type="submit" className="button button-primary button-lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Saving…
            </span>
          ) : isEditMode ? 'Save Changes' : 'Create Booking'}
        </button>
      </div>
    </form>
  );
}
