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
import { notifyBookingCreated, notifyAwbStockAlert, notifyBookingStatusChanged } from '../../services/notifications.js';
import { generateFFRMessage } from '../../utils/ffr.js';
import { generateBookingConfirmationPdf } from '../../utils/pdf.js';

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
  // Cost & profit
  buyRatePerKg: '', buyCurrency: 'USD', exchangeRateUsdEur: '',
};

/* ─── Main component ─── */
export default function BookingForm({ onSuccess, editingBooking = null }) {
  const isEditMode = !!editingBooking;
  const {
    currentUserProfile, agentProfiles, shipperProfiles, consigneeProfiles,
    flightSchedules, iataAirportCodes, awbStockAllocations, rateTableEntries, bookings,
    isAdmin, myAgentId, globalSettings,
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
    buyRatePerKg: b.buyRatePerKg || '',
    buyCurrency: b.buyCurrency || 'USD',
    exchangeRateUsdEur: b.exchangeRateUsdEur || '',
  });

  const [form, setForm] = useState(isEditMode ? buildFormFromBooking(editingBooking) : INITIAL_FORM);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFfrModal,   setShowFfrModal]   = useState(false);
  const [ffrCopied,      setFfrCopied]      = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm,      setEmailForm]      = useState({ to: '', cc: '', subject: '', body: '' });

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
    const rateResult = form.isRateOverridden
      ? null
      : getRateForBooking(form.origin, form.destination, form.currency, chg, rateTable);
    // getRateForBooking returns { rate, minCharge } or null — extract the numeric rate safely
    const rate = form.isRateOverridden
      ? parseFloat(form.ratePerKg) || 0
      : (rateResult?.rate ?? 0);

    if (!form.isRateOverridden) setForm(f => ({ ...f, ratePerKg: rate.toFixed(2) }));

    const freight = chg * rate;
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

  /* ── AWB preview — shows next AWB and remaining stock before save ── */
  const awbPreview = useMemo(() => {
    if (!form.awbInputPrefix || !form.awbInputNumber || !form.selectedAgentProfileId) return null;
    // Find the allocation this AWB belongs to
    const alloc = (awbStockAllocations || []).find(a =>
      a.prefix === form.awbInputPrefix &&
      a.agentProfileId === form.selectedAgentProfileId &&
      isSerialLTE(a.startNumber, form.awbInputNumber) &&
      isSerialLTE(form.awbInputNumber, a.endNumber)
    );
    const awb = `${form.awbInputPrefix}-${form.awbInputNumber}`;
    if (!alloc) return { awb, remaining: null, total: null };
    const total     = calculateAwbCount(alloc.startNumber, alloc.endNumber);
    const used      = (alloc.usedAwbs || []).length;
    // In edit mode the current AWB isn't in usedAwbs yet, so we don't subtract it again
    const remaining = total - used;
    const pct       = total > 0 ? remaining / total : 1;
    const level     = pct > 0.5 ? 'green' : pct > 0.25 ? 'amber' : 'red';
    return { awb, remaining, total, level };
  }, [form.awbInputPrefix, form.awbInputNumber, form.selectedAgentProfileId, awbStockAllocations]);

  /* ── Profit calculator ── */
  const profitCalc = useMemo(() => {
    const chg      = parseFloat(displayChargeableWeightKg) || 0;
    const totalSell = parseFloat(displayTotalCharges) || 0;
    const buyRate  = parseFloat(form.buyRatePerKg) || 0;
    const exRate   = parseFloat(form.exchangeRateUsdEur) || 1;
    const casPct   = globalSettings?.casSplitPct    ?? 70;
    const acrosPct = globalSettings?.acrossSplitPct ?? 30;

    // Revenue → convert sell total to EUR
    let revenueEur;
    if (form.currency === 'EUR')      revenueEur = totalSell;
    else if (form.currency === 'USD') revenueEur = exRate > 0 ? totalSell / exRate : totalSell;
    else                              revenueEur = totalSell; // other currencies: shown as-is

    // Cost → buy rate × chargeable weight → convert to EUR
    const costRaw = chg * buyRate;
    const costEur = form.buyCurrency === 'EUR' ? costRaw
                  : (exRate > 0 ? costRaw / exRate : costRaw);

    const profitEur  = revenueEur - costEur;
    const casSplit   = profitEur * (casPct   / 100);
    const acrosSplit = profitEur * (acrosPct / 100);

    return { revenueEur, costEur, profitEur, casSplit, acrosSplit, casPct, acrosPct };
  }, [displayChargeableWeightKg, displayTotalCharges, form.buyRatePerKg, form.buyCurrency,
      form.currency, form.exchangeRateUsdEur, globalSettings]);

  /* ── FFR message (computed from current form state) ── */
  const ffrText = useMemo(() => generateFFRMessage({
    awbInputPrefix:    form.awbInputPrefix,
    awbInputNumber:    form.awbInputNumber,
    origin:            form.origin,
    destination:       form.destination,
    pieces:            form.pieces,
    weightKg:          form.weightKg,
    volumeM3:          displayVolumeM3,
    natureOfGoods:     form.natureOfGoods,
    flightSegments:    form.flightSegments,
    bookingStatus:     form.bookingStatus,
    handlingInformation: form.handlingInformation,
    selectedShcCode:   form.selectedShcCode,
    dimensionLines:    form.dimensionLines,
    ffrReference:      form.ffrReference,
    agentIataCassNumber: form.agentCassDisplay,
    agent_details_name:  form.agentNameDisplay,
    agentCity:           form.agentCityForFFR,
    osiGhaText:          form.osiGhaText,
    ffrRemarks:          form.ffrRemarks,
  }), [form, displayVolumeM3]);

  /* ── Build booking-like object from current form for PDF/FFR (no Firestore needed) ── */
  const formAsBooking = () => ({
    awb: `${form.awbInputPrefix}-${form.awbInputNumber}`,
    awbInputPrefix: form.awbInputPrefix,
    awbInputNumber: form.awbInputNumber,
    origin: form.origin, destination: form.destination,
    pieces: form.pieces, weightKg: form.weightKg,
    chargeableWeightKg: displayChargeableWeightKg,
    volumeM3: displayVolumeM3,
    natureOfGoods: form.natureOfGoods, selectedShcCode: form.selectedShcCode,
    bookingStatus: form.bookingStatus,
    flightSegments: form.flightSegments, dimensionLines: form.dimensionLines,
    shipperName: form.shipperName, shipperStreet: form.shipperStreet,
    shipperCity: form.shipperCity, shipperCountry: form.shipperCountry, shipperContact: form.shipperContact,
    consigneeName: form.consigneeName, consigneeStreet: form.consigneeStreet,
    consigneeCity: form.consigneeCity, consigneeCountry: form.consigneeCountry, consigneeContact: form.consigneeContact,
    agent_details_name: form.agentNameDisplay, agentIataCassNumber: form.agentCassDisplay,
    agent_id: form.agentIdInput, agentCity: form.agentCityForFFR,
    ffrReference: form.ffrReference, handlingInformation: form.handlingInformation,
    osiGhaText: form.osiGhaText, ffrRemarks: form.ffrRemarks,
    currency: form.currency, ratePerKg: form.ratePerKg,
    freightCharges: displayFreightCharges, otherCharges: form.otherCharges,
    totalCalculatedCharges: displayTotalCharges, paymentType: form.paymentType,
    createdAt: isEditMode ? editingBooking?.createdAt : null,
  });

  const handlePreviewPdf = () => {
    if (!window.jspdf) { toast.error('PDF library not loaded yet. Try again in a moment.'); return; }
    generateBookingConfirmationPdf(formAsBooking(), flightSchedules || [], iataAirportCodes || [], { preview: true });
  };

  const handleOpenEmailModal = () => {
    const awb = `${form.awbInputPrefix}-${form.awbInputNumber}`;
    const agent = form.agentNameDisplay || 'Agent';
    const route = (form.origin && form.destination) ? `${form.origin}→${form.destination}` : '';
    const flight = form.flightSegments?.[0]?.flightNumber || '';
    setEmailForm({
      to: '',
      cc: '',
      subject: `Booking Confirmation – AWB ${awb}${route ? ` | ${route}` : ''}`,
      body: `Dear ${agent},\n\nPlease find attached the booking confirmation for AWB ${awb}${route ? ` (${route})` : ''}${flight ? `, flight ${flight}` : ''}.\n\nKind regards,\nAcrossCargo`,
    });
    setShowEmailModal(true);
  };

  const handleSendEmail = () => {
    // 1. Download the PDF so the user can attach it
    if (window.jspdf) {
      generateBookingConfirmationPdf(formAsBooking(), flightSchedules || [], iataAirportCodes || []);
    }
    // 2. Open mailto in email client
    const params = new URLSearchParams();
    if (emailForm.cc)      params.set('cc',      emailForm.cc);
    if (emailForm.subject) params.set('subject', emailForm.subject);
    if (emailForm.body)    params.set('body',    emailForm.body);
    const mailto = `mailto:${encodeURIComponent(emailForm.to)}?${params.toString()}`;
    window.location.href = mailto;
    toast.success('PDF downloaded — attach it to the email that just opened.');
    setShowEmailModal(false);
  };

  /* ── Auto-select agent for agent-role users (create mode only) ── */
  useEffect(() => {
    if (isEditMode || isAdmin || !myAgentId || !agentProfiles?.length) return;
    if (form.selectedAgentProfileId) return; // already set
    const profile = agentProfiles.find(p => p.agentId === myAgentId);
    if (profile) handleAgentSelect(profile.id);
  }, [isEditMode, isAdmin, myAgentId, agentProfiles]); // eslint-disable-line

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
      // Cost & profit
      buyRatePerKg: form.buyRatePerKg,
      buyCurrency: form.buyCurrency,
      exchangeRateUsdEur: form.exchangeRateUsdEur,
      totalCostEur:   profitCalc.costEur.toFixed(2),
      revenueEur:     profitCalc.revenueEur.toFixed(2),
      profitEur:      profitCalc.profitEur.toFixed(2),
      casSplitEur:    profitCalc.casSplit.toFixed(2),
      acrossSplitEur: profitCalc.acrosSplit.toFixed(2),
    };

    const validationError = validateBookingData(data);
    if (validationError) { setFormError(validationError); return; }

    // ── Capacity check (before any Firestore write) ──
    for (const seg of data.flightSegments) {
      if (!seg.flightScheduleId || !seg.departureDate) continue;
      const key = `${seg.flightScheduleId}_${seg.departureDate}`;
      const cap = flightCapacityMap[key];
      if (!cap) continue;
      const thisKg  = parseFloat(displayChargeableWeightKg) || 0;
      const thisCbm = parseFloat(displayVolumeM3) || 0;
      if (cap.maxKg !== null && cap.bookedKg + thisKg > cap.maxKg) {
        const avail = Math.max(0, cap.maxKg - cap.bookedKg).toFixed(1);
        setFormError(
          `Cannot book: flight ${cap.flightNumber || seg.flightNumber} on ${seg.departureDate} ` +
          `has only ${avail} kg available. This shipment requires ${thisKg.toFixed(1)} kg.`
        );
        return;
      }
      if (cap.maxCbm !== null && cap.bookedCbm + thisCbm > cap.maxCbm) {
        const availCbm = Math.max(0, cap.maxCbm - cap.bookedCbm).toFixed(3);
        setFormError(
          `Cannot book: flight ${cap.flightNumber || seg.flightNumber} on ${seg.departureDate} ` +
          `has only ${availCbm} m³ available. This shipment requires ${thisCbm.toFixed(3)} m³.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // ── EDIT MODE: simple updateDoc ──
      if (isEditMode && editingBooking?.id) {
        const oldStatus = editingBooking.bookingStatus;
        await updateDoc(doc(db, 'bookings', editingBooking.id), {
          ...data,
          updatedAt: serverTimestamp(),
          updatedBy: currentUserProfile?.email || 'unknown',
        });
        toast.success('Booking updated successfully.');
        // Notify agent if status changed
        const agentProfile = agentProfiles?.find(p => p.id === data.selectedAgentProfileId);
        notifyBookingStatusChanged(data, oldStatus, agentProfile);
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

      // ── Post-create notifications (fire-and-forget) ──
      const agentProfile = agentProfiles?.find(p => p.id === data.selectedAgentProfileId);
      notifyBookingCreated(data, agentProfile);

      // Check AWB stock level for this agent — alert if < 25% remaining
      const agentAllocs = (awbStockAllocations || []).filter(a => a.agentProfileId === data.selectedAgentProfileId);
      for (const alloc of agentAllocs) {
        const { calculateAwbCount } = await import('../../utils/awb.js');
        const total    = calculateAwbCount(alloc.startNumber, alloc.endNumber);
        const used     = (alloc.usedAwbs || []).length + 1; // +1 for the one just created
        const avail    = total - used;
        if (total > 0 && avail / total < 0.25) {
          notifyAwbStockAlert(alloc, agentProfile, avail, total);
          break; // alert once per booking
        }
      }

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
      const { bookedKg, bookedCbm } = (bookings || []).reduce((acc, b) => {
        if (isEditMode && b.id === editingBooking?.id) return acc;
        const hit = (b.flightSegments || []).find(
          s => s.flightScheduleId === seg.flightScheduleId && s.departureDate === seg.departureDate
        );
        if (!hit) return acc;
        return {
          bookedKg:  acc.bookedKg  + (parseFloat(b.chargeableWeightKg) || 0),
          bookedCbm: acc.bookedCbm + (parseFloat(b.volumeM3)           || 0),
        };
      }, { bookedKg: 0, bookedCbm: 0 });
      map[key] = { maxKg, maxCbm, bookedKg, bookedCbm, flightNumber: flight?.flightNumber || seg.flightNumber };
    });
    return map;
  }, [form.flightSegments, flightSchedules, bookings, isEditMode, editingBooking]);

  /* ── Airports list ── */
  const airports = useMemo(() => {
    const managed = (iataAirportCodes || []).map(a => ({ code: a.code, label: `${a.code} — ${a.city || a.cityName || a.name || a.code}` }));
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
              {isAdmin ? (
                <select className="form-select" value={form.selectedAgentProfileId} onChange={e => handleAgentSelect(e.target.value)}>
                  <option value="">Select agent…</option>
                  {(agentProfiles || []).map(a => <option key={a.id} value={a.id}>{a.agentName}</option>)}
                </select>
              ) : (
                <input className="form-input" value={form.agentNameDisplay || '—'} readOnly
                  style={{ background: 'var(--color-gray-50)', color: 'var(--color-gray-600)' }} />
              )}
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
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge-blue">{form.agentNameDisplay}</span>
              {form.agentCassDisplay && <span className="badge badge-gray">CASS: {form.agentCassDisplay}</span>}
              {form.agentAddressDisplay && <span className="badge badge-gray">{form.agentAddressDisplay}</span>}
            </div>
          )}

          {/* AWB preview indicator */}
          {!isEditMode && awbPreview && (
            <div style={{
              marginTop: 'var(--space-3)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              background: awbPreview.level === 'green' ? '#f0fdf4'
                        : awbPreview.level === 'amber' ? '#fffbeb'
                        : awbPreview.level === 'red'   ? '#fef2f2'
                        : 'var(--color-gray-50)',
              border: `1px solid ${awbPreview.level === 'green' ? '#bbf7d0'
                                  : awbPreview.level === 'amber' ? '#fde68a'
                                  : awbPreview.level === 'red'   ? '#fecaca'
                                  : 'var(--color-border)'}`,
            }}>
              {/* AWB number */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"
                  style={{ width: 15, height: 15, flexShrink: 0,
                    color: awbPreview.level === 'green' ? '#16a34a' : awbPreview.level === 'amber' ? '#d97706' : awbPreview.level === 'red' ? '#dc2626' : 'var(--color-gray-500)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem',
                  color: awbPreview.level === 'green' ? '#15803d' : awbPreview.level === 'amber' ? '#b45309' : awbPreview.level === 'red' ? '#b91c1c' : 'var(--color-text)' }}>
                  {awbPreview.awb}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>will be assigned</span>
              </div>

              {/* Stock level pill */}
              {awbPreview.remaining !== null && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.72rem', fontWeight: 600,
                  padding: '3px 9px', borderRadius: 20,
                  background: awbPreview.level === 'green' ? '#dcfce7' : awbPreview.level === 'amber' ? '#fef3c7' : '#fee2e2',
                  color:      awbPreview.level === 'green' ? '#166534' : awbPreview.level === 'amber' ? '#92400e' : '#991b1b',
                }}>
                  {awbPreview.remaining} / {awbPreview.total} remaining
                  {awbPreview.level === 'amber' && ' ⚠ low stock'}
                  {awbPreview.level === 'red'   && ' ⚠ critical'}
                </span>
              )}
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
                    if (cap.maxKg === null && cap.maxCbm === null) return (
                      <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-400)' }}>
                        No payload limit configured for this flight.
                      </div>
                    );
                    const thisKg  = parseFloat(displayChargeableWeightKg) || 0;
                    const thisCbm = parseFloat(displayVolumeM3) || 0;

                    // Kg metrics
                    const afterKg  = cap.maxKg !== null ? cap.bookedKg + thisKg : null;
                    const pctKg    = (cap.maxKg && afterKg !== null) ? Math.round((afterKg / cap.maxKg) * 100) : null;
                    const fullKg   = cap.maxKg !== null && afterKg > cap.maxKg;
                    const warnKg   = !fullKg && pctKg >= 80;

                    // Cbm metrics
                    const afterCbm = cap.maxCbm !== null ? cap.bookedCbm + thisCbm : null;
                    const pctCbm   = (cap.maxCbm && afterCbm !== null) ? Math.round((afterCbm / cap.maxCbm) * 100) : null;
                    const fullCbm  = cap.maxCbm !== null && afterCbm > cap.maxCbm;
                    const warnCbm  = !fullCbm && pctCbm >= 80;

                    const isFull    = fullKg || fullCbm;
                    const isWarning = !isFull && (warnKg || warnCbm);
                    const bgColor   = isFull ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0fdf4';
                    const txtColor  = isFull ? '#991b1b' : isWarning ? '#92400e' : '#166534';

                    const Bar = ({ pct, fullBar }) => {
                      const color = fullBar ? '#ef4444' : (pct >= 80 ? '#f59e0b' : '#22c55e');
                      return (
                        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 5 }}>
                          <div style={{ background: color, borderRadius: 99, height: 5, width: `${Math.min(pct, 100)}%`, transition: 'width 300ms' }} />
                        </div>
                      );
                    };

                    return (
                      <div style={{ marginTop: 'var(--space-3)', background: bgColor, borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: txtColor }}>
                            {isFull ? '🔴 Over capacity' : isWarning ? '🟡 Near capacity' : '🟢 Capacity available'}
                          </span>
                        </div>

                        {/* Weight bar */}
                        {cap.maxKg !== null && (
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: txtColor, marginBottom: 3 }}>
                              <span>Weight — booked <strong>{cap.bookedKg.toFixed(1)}</strong> + this <strong>+{thisKg.toFixed(1)}</strong> kg</span>
                              <span><strong>{pctKg}%</strong> of {cap.maxKg.toLocaleString()} kg</span>
                            </div>
                            <Bar pct={pctKg} fullBar={fullKg} />
                          </div>
                        )}

                        {/* Volume bar */}
                        {cap.maxCbm !== null && (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: txtColor, marginBottom: 3 }}>
                              <span>Volume — booked <strong>{cap.bookedCbm.toFixed(3)}</strong> + this <strong>+{thisCbm.toFixed(3)}</strong> m³</span>
                              <span><strong>{pctCbm}%</strong> of {cap.maxCbm} m³</span>
                            </div>
                            <Bar pct={pctCbm} fullBar={fullCbm} />
                          </div>
                        )}
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

      {/* ── 9. COST & PROFIT CALCULATOR ── */}
      <div className="card" style={S}>
        <div className="card-header">
          <span className="card-title">💰 Cost & Profit Calculator</span>
        </div>
        <div className="card-body">

          {/* Input row */}
          <div className="form-grid form-grid-3" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Buy Rate (per kg)</label>
              <input type="number" className="form-input" value={form.buyRatePerKg}
                onChange={set('buyRatePerKg')} placeholder="0.00" step="0.01" min="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Buy Currency</label>
              <select className="form-select" value={form.buyCurrency} onChange={set('buyCurrency')}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                USD → EUR Rate
                <span style={{ fontWeight: 400, color: 'var(--color-gray-400)', marginLeft: 6, fontSize: '0.72rem' }}>
                  daily rate
                </span>
              </label>
              <input type="number" className="form-input" value={form.exchangeRateUsdEur}
                onChange={set('exchangeRateUsdEur')} placeholder="e.g. 1.08" step="0.0001" min="0"
                disabled={form.buyCurrency === 'EUR' && form.currency === 'EUR'}
                style={form.buyCurrency === 'EUR' && form.currency === 'EUR'
                  ? { background: 'var(--color-gray-50)', color: 'var(--color-gray-400)' } : {}} />
            </div>
          </div>

          {/* Total Cost */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)', border: '1px solid var(--color-border)',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--color-gray-700)', flex: 1 }}>Total Cost</span>
            <span style={{
              fontWeight: 700, fontSize: '1.1rem',
              color: profitCalc.costEur > 0 ? '#b91c1c' : 'var(--color-gray-400)',
            }}>
              EUR {profitCalc.costEur.toFixed(2)}
            </span>
          </div>

          {/* Profit Summary box */}
          {(() => {
            const { revenueEur, costEur, profitEur, casSplit, acrosSplit, casPct, acrosPct } = profitCalc;
            const isProfit = profitEur >= 0;
            const bgColor  = profitEur > 0 ? '#f0fdf4' : profitEur < 0 ? '#fef2f2' : 'var(--color-gray-50)';
            const border   = profitEur > 0 ? '#bbf7d0' : profitEur < 0 ? '#fecaca' : 'var(--color-border)';
            return (
              <div style={{ background: bgColor, border: `1px solid ${border}`, borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em', color: 'var(--color-gray-500)', marginBottom: 'var(--space-3)', textTransform: 'uppercase' }}>
                  💰 Profit Summary (EUR)
                </div>

                {/* Revenue / Cost / Profit */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                  {[
                    { label: 'Revenue', value: revenueEur, color: '#15803d' },
                    { label: 'Cost',    value: costEur,    color: '#b91c1c' },
                    { label: 'Profit',  value: profitEur,  color: isProfit ? '#15803d' : '#b91c1c' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-gray-500)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color, fontFamily: 'monospace' }}>
                        {value >= 0 ? '' : '−'}{Math.abs(value).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Split */}
                <div style={{ borderTop: `1px solid ${border}`, paddingTop: 'var(--space-3)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
                    Split
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{
                      flex: 1, textAlign: 'center', padding: 'var(--space-2)',
                      background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--radius-sm)',
                    }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-gray-500)', marginBottom: 2 }}>CAS {casPct}%</div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: isProfit ? '#15803d' : '#b91c1c' }}>
                        {casSplit >= 0 ? '' : '−'}{Math.abs(casSplit).toFixed(2)}
                      </div>
                    </div>
                    <div style={{
                      flex: 1, textAlign: 'center', padding: 'var(--space-2)',
                      background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--radius-sm)',
                    }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-gray-500)', marginBottom: 2 }}>Across {acrosPct}%</div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: isProfit ? '#15803d' : '#b91c1c' }}>
                        {acrosSplit >= 0 ? '' : '−'}{Math.abs(acrosSplit).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── 10. ADDITIONAL INFO ── */}
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingBottom: 'var(--space-8)', flexWrap: 'wrap' }}>
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
        <button type="button" className="button button-secondary" onClick={() => setShowFfrModal(true)}
          style={{ background: '#0b1f5b', color: '#fff', borderColor: '#0b1f5b' }}>
          📋 Generate FFR
        </button>
        <button type="button" className="button button-secondary" onClick={handlePreviewPdf}
          style={{ background: '#1c9246', color: '#fff', borderColor: '#1c9246' }}>
          🖨 Preview / Print PDF
        </button>
        <button type="button" className="button button-secondary" onClick={handleOpenEmailModal}
          style={{ background: '#138756', color: '#fff', borderColor: '#138756' }}>
          ✉ Send PDF by Email
        </button>
        <button type="submit" className="button button-primary button-lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Saving…
            </span>
          ) : isEditMode ? 'Save Changes' : 'Create Booking'}
        </button>
      </div>

      {/* ── FFR MODAL ── */}
      {showFfrModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4)',
        }} onClick={() => setShowFfrModal(false)}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            width: '100%', maxWidth: 640,
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-4) var(--space-5)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>📋 FFR Message</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: 2 }}>
                  IATA Cargo-IMP format
                </div>
              </div>
              <button type="button" className="button button-ghost button-sm"
                onClick={() => setShowFfrModal(false)} style={{ fontSize: '1.2rem', lineHeight: 1 }}>×</button>
            </div>

            {/* Body — monospaced FFR text */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-5)' }}>
              <pre style={{
                fontFamily: "'Courier New', monospace",
                fontSize: '0.85rem',
                lineHeight: 1.7,
                color: '#e2e8f0',
                background: '#141322',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                margin: 0,
              }}>{ffrText}</pre>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end',
              padding: 'var(--space-4) var(--space-5)',
              borderTop: '1px solid var(--color-border)',
            }}>
              <button type="button" className="button button-ghost"
                onClick={() => setShowFfrModal(false)}>
                Close
              </button>
              <button type="button" className="button button-primary"
                onClick={() => {
                  navigator.clipboard.writeText(ffrText).then(() => {
                    setFfrCopied(true);
                    setTimeout(() => setFfrCopied(false), 2000);
                  });
                }}>
                {ffrCopied ? '✓ Copied!' : '📋 Copy FFR'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── EMAIL MODAL ── */}
      {showEmailModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4)',
        }} onClick={() => setShowEmailModal(false)}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            width: '100%', maxWidth: 520,
            display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-4) var(--space-5)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>✉ Send Booking PDF by Email</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: 2 }}>
                  Opens your email client — PDF will be downloaded for you to attach
                </div>
              </div>
              <button type="button" className="button button-ghost button-sm"
                onClick={() => setShowEmailModal(false)} style={{ fontSize: '1.2rem', lineHeight: 1 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label required">To (email address)</label>
                <input className="form-input" type="email" value={emailForm.to}
                  onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))}
                  placeholder="agent@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">CC (optional)</label>
                <input className="form-input" type="email" value={emailForm.cc}
                  onChange={e => setEmailForm(f => ({ ...f, cc: e.target.value }))}
                  placeholder="copy@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" value={emailForm.subject}
                  onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea className="form-textarea" rows={5} value={emailForm.body}
                  onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))} />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', margin: 0 }}>
                The PDF will be downloaded automatically. Attach it to the email that opens in your email client.
              </p>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end',
              padding: 'var(--space-4) var(--space-5)',
              borderTop: '1px solid var(--color-border)',
            }}>
              <button type="button" className="button button-ghost"
                onClick={() => setShowEmailModal(false)}>Cancel</button>
              <button type="button" className="button button-primary"
                disabled={!emailForm.to}
                onClick={handleSendEmail}>
                ✉ Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
