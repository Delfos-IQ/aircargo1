/**
 * PDF generation utilities using jsPDF + jsPDF-AutoTable (loaded via CDN).
 * These functions rely on window.jspdf being available.
 */
import { airlinePrefixData } from '../data/airlines.js';
import { formatNumberWithSeparators } from './numbers.js';

const formatDateStr = (val) => {
  if (!val) return 'N/A';
  if (typeof val === 'string' && val.includes('-')) {
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  }
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    if (isNaN(d)) return 'N/A';
    return d.toLocaleDateString('en-GB');
  } catch { return 'N/A'; }
};

const formatDDMMM = (dateStr) => {
  if (!dateStr) return 'NIL';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d)) return 'NIL';
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return String(d.getDate()).padStart(2,'0') + months[d.getMonth()];
};

/* ──────────────────────────────────────────────────────────────
   BOOKING CONFIRMATION PDF
─────────────────────────────────────────────────────────────── */
export const generateBookingConfirmationPdf = (booking, flightSchedules = [], iataAirportCodes = [], { preview = false } = {}) => {
  const { jsPDF } = window.jspdf;
  const pdoc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  const getAirport = (code) => {
    const a = iataAirportCodes.find(ap => ap.code === code);
    return a ? `${a.code} (${a.name || a.city || code})` : code || 'N/A';
  };

  let y = 15;
  const lineGap = 5;
  const sectionGap = 6;
  const LEFT = 15;
  const RIGHT = pdoc.internal.pageSize.getWidth() - 15;
  const MID = 80;

  const checkPage = () => {
    if (y > 270) { pdoc.addPage(); y = 20; }
  };

  const drawSection = (title, rows) => {
    checkPage();
    pdoc.setFontSize(10);
    pdoc.setFont('helvetica', 'bold');
    pdoc.setFillColor(243, 244, 246);
    pdoc.rect(LEFT, y - 4, RIGHT - LEFT, 6, 'F');
    pdoc.text(title.toUpperCase(), LEFT + 2, y);
    y += lineGap;
    pdoc.setFontSize(8.5);
    pdoc.setFont('helvetica', 'normal');
    rows.forEach(({ label, value }) => {
      checkPage();
      pdoc.setFont('helvetica', 'bold');
      pdoc.text(`${label}:`, LEFT + 3, y);
      pdoc.setFont('helvetica', 'normal');
      const valStr = String(value || 'N/A');
      const lines = pdoc.splitTextToSize(valStr, RIGHT - MID - 5);
      pdoc.text(lines, MID, y);
      y += lineGap * Math.max(1, lines.length);
    });
    y += sectionGap / 2;
  };

  // Title
  pdoc.setFontSize(16);
  pdoc.setFont('helvetica', 'bold');
  pdoc.setTextColor(17, 24, 39);
  pdoc.text('BOOKING CONFIRMATION', pdoc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
  y += 8;

  // Sub-header
  pdoc.setFontSize(9);
  pdoc.setFont('helvetica', 'normal');
  pdoc.setTextColor(107, 114, 128);
  const airline = airlinePrefixData.find(ap => ap.prefix === booking.awbInputPrefix);
  pdoc.text(`AWB: ${booking.awb || 'N/A'}`, LEFT, y);
  pdoc.text(`Date: ${formatDateStr(booking.createdAt)}`, RIGHT, y, { align: 'right' });
  y += 5;
  pdoc.text(`Airline: ${airline ? `${airline.prefix} – ${airline.name}` : booking.awbInputPrefix || 'N/A'}`, LEFT, y);
  y += 8;
  pdoc.setTextColor(17, 24, 39);

  drawSection('Shipment Details', [
    { label: 'Origin', value: getAirport(booking.origin) },
    { label: 'Destination', value: getAirport(booking.destination) },
    { label: 'Pieces', value: booking.pieces },
    { label: 'Gross Weight', value: `${booking.weightKg} kg` },
    { label: 'Chargeable Weight', value: `${booking.chargeableWeightKg || '—'} kg` },
    { label: 'Volume', value: `${booking.volumeM3 || '—'} m³` },
    { label: 'Commodity', value: booking.natureOfGoods },
    { label: 'SHC', value: booking.selectedShcCode },
    { label: 'Status', value: booking.bookingStatus },
  ]);

  // Flight segments table
  if (booking.flightSegments?.length) {
    checkPage();
    pdoc.setFontSize(10);
    pdoc.setFont('helvetica', 'bold');
    pdoc.setFillColor(243, 244, 246);
    pdoc.rect(LEFT, y - 4, RIGHT - LEFT, 6, 'F');
    pdoc.text('FLIGHT ITINERARY', LEFT + 2, y);
    y += 3;

    pdoc.autoTable({
      startY: y,
      head: [['Flight', 'Date', 'Origin', 'Destination', 'STD', 'STA', 'Status']],
      body: booking.flightSegments.map(seg => {
        const fs = flightSchedules.find(s => s.flightNumber?.toUpperCase() === seg.flightNumber?.toUpperCase());
        return [seg.flightNumber || 'NIL', formatDDMMM(seg.departureDate), seg.segmentOrigin || '—', seg.segmentDestination || '—', fs?.std || '—', fs?.sta || '—', booking.bookingStatus || '—'];
      }),
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      margin: { left: LEFT, right: 15 },
    });
    y = pdoc.lastAutoTable.finalY + sectionGap;
  }

  // Dimensions
  if (booking.dimensionLines?.length) {
    drawSection('Dimensions', booking.dimensionLines.map((d, i) => ({
      label: `Line ${i + 1}`,
      value: `${d.pieces} pcs — ${d.length}×${d.width}×${d.height} cm`,
    })));
  }

  drawSection('Shipper', [
    { label: 'Name', value: booking.shipperName },
    { label: 'Address', value: booking.shipperStreet },
    { label: 'City/Country', value: `${booking.shipperCity || ''}, ${booking.shipperCountry || ''}` },
    { label: 'Contact', value: booking.shipperContact },
  ]);

  drawSection('Consignee', [
    { label: 'Name', value: booking.consigneeName },
    { label: 'Address', value: booking.consigneeStreet },
    { label: 'City/Country', value: `${booking.consigneeCity || ''}, ${booking.consigneeCountry || ''}` },
    { label: 'Contact', value: booking.consigneeContact },
  ]);

  drawSection('Agent', [
    { label: 'Name', value: booking.agent_details_name },
    { label: 'IATA/CASS', value: booking.agentIataCassNumber || booking.agent_id },
    { label: 'Reference', value: booking.ffrReference },
  ]);

  drawSection('Charges', [
    { label: 'Currency', value: booking.currency },
    { label: 'Rate/kg', value: String(booking.ratePerKg) },
    { label: 'Freight', value: String(booking.freightCharges) },
    { label: 'Total', value: String(booking.totalCalculatedCharges) },
    { label: 'Payment Type', value: booking.paymentType },
  ]);

  // Other charges table
  if (booking.otherCharges?.length) {
    checkPage();
    pdoc.autoTable({
      startY: y,
      head: [['Code', 'Description', 'Amount']],
      body: booking.otherCharges.map(oc => [oc.chargeCode, oc.chargeDescription, parseFloat(oc.chargeAmount).toFixed(2)]),
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      margin: { left: LEFT, right: 15 },
    });
    y = pdoc.lastAutoTable.finalY + sectionGap;
  }

  if (preview) {
    const url = pdoc.output('bloburl');
    window.open(url, '_blank');
  } else {
    pdoc.save(`Booking_${(booking.awb || 'AWB').replace('-', '')}.pdf`);
  }
};

/* ──────────────────────────────────────────────────────────────
   CARGO SALES REPORT PDF  (landscape A4)
─────────────────────────────────────────────────────────────── */
export const generateCargoSalesReportPdf = (reportBookings, dateFrom, dateTo, agentProfiles = [], iataAirportCodes = []) => {
  if (!reportBookings?.length) return;
  const { jsPDF } = window.jspdf;
  const pdoc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

  const firstBooking = reportBookings[0] || {};
  const getCity = (code) => iataAirportCodes.find(c => c.code === code)?.city || code || 'N/A';
  const station = firstBooking.origin ? `${firstBooking.origin} (${getCity(firstBooking.origin)})` : 'N/A';
  const airline = airlinePrefixData.find(a => a.prefix === firstBooking.awbInputPrefix);
  const carrierText = airline ? `${airline.name} (${firstBooking.awbInputPrefix})` : firstBooking.awbInputPrefix || 'N/A';

  const pageW = pdoc.internal.pageSize.getWidth();

  // Header
  pdoc.setFont('helvetica', 'bold');
  pdoc.setFontSize(20);
  pdoc.setTextColor(30, 58, 138);
  pdoc.text('CARGO SALES REPORT', pageW / 2, 20, { align: 'center' });

  pdoc.setFontSize(9);
  pdoc.setTextColor(75, 85, 99);
  pdoc.setFont('helvetica', 'normal');
  pdoc.text(`Carrier: ${carrierText}`, 20, 30);
  pdoc.text(`Station: ${station}`, 20, 35);
  pdoc.text(`Period: ${formatDateStr(dateFrom)} – ${formatDateStr(dateTo)}`, pageW - 20, 30, { align: 'right' });
  pdoc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageW - 20, 35, { align: 'right' });

  const tableBody = reportBookings.map(b => {
    const agent = agentProfiles.find(a => a.id === b.selectedAgentProfileId);
    const flight = b.flightSegments?.[0] || {};
    const otherTotal = (b.otherCharges || []).reduce((s, c) => s + (parseFloat(c.chargeAmount) || 0), 0);
    return [
      agent?.agentName || 'N/A',
      agent?.agentIataCassNumber || '',
      `${b.awbInputPrefix}-${b.awbInputNumber}`,
      formatDateStr(b.createdAt),
      flight.flightNumber || '',
      formatDDMMM(flight.departureDate),
      `${b.origin || ''}-${b.destination || ''}`,
      formatNumberWithSeparators(b.weightKg, 1),
      formatNumberWithSeparators(b.chargeableWeightKg, 1),
      formatNumberWithSeparators(b.ratePerKg, 2),
      formatNumberWithSeparators(b.freightCharges, 2),
      formatNumberWithSeparators(otherTotal, 2),
      formatNumberWithSeparators(b.totalCalculatedCharges, 2),
    ];
  });

  const totGross   = reportBookings.reduce((s, b) => s + (parseFloat(b.weightKg) || 0), 0);
  const totCharge  = reportBookings.reduce((s, b) => s + (parseFloat(b.chargeableWeightKg) || 0), 0);
  const totFreight = reportBookings.reduce((s, b) => s + (parseFloat(b.freightCharges) || 0), 0);
  const totOther   = reportBookings.reduce((s, b) => s + (b.otherCharges || []).reduce((ss, c) => ss + (parseFloat(c.chargeAmount) || 0), 0), 0);
  const totTotal   = reportBookings.reduce((s, b) => s + (parseFloat(b.totalCalculatedCharges) || 0), 0);

  pdoc.autoTable({
    startY: 42,
    head: [['Cargo Agent', 'IATA/CASS', 'AWB No.', 'Date', 'Flight', 'Flt Date', 'Route', 'Gross Wt', 'Chrg Wt', 'Rate', 'Freight', 'Other', 'Total']],
    body: tableBody,
    foot: [[
      { content: 'GRAND TOTAL', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatNumberWithSeparators(totGross, 1), styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatNumberWithSeparators(totCharge, 1), styles: { halign: 'right', fontStyle: 'bold' } },
      { content: '', styles: {} },
      { content: formatNumberWithSeparators(totFreight, 2), styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatNumberWithSeparators(totOther, 2), styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatNumberWithSeparators(totTotal, 2), styles: { halign: 'right', fontStyle: 'bold' } },
    ]],
    theme: 'plain',
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [55, 65, 81] },
    headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold', lineColor: [209, 213, 219], lineWidth: { bottom: 0.3 } },
    footStyles: { fillColor: [229, 231, 235], textColor: [17, 24, 39], fontStyle: 'bold', lineColor: [156, 163, 175], lineWidth: { top: 0.4 } },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' }, 12: { halign: 'right' } },
    didDrawPage: (data) => {
      pdoc.setFontSize(8);
      pdoc.setTextColor(180, 180, 180);
      pdoc.text('Across Aviation SLU', data.settings.margin.left, pdoc.internal.pageSize.height - 8);
      pdoc.text(`Page ${data.pageNumber}`, pageW - data.settings.margin.right, pdoc.internal.pageSize.height - 8, { align: 'right' });
    },
  });

  pdoc.save(`Cargo_Sales_Report_${dateFrom}_${dateTo}.pdf`);
};

/* ──────────────────────────────────────────────────────────────
   VERIFACTU QR helper
   Real Decreto 1007/2023 – generates a QR data URL using qrcodejs
─────────────────────────────────────────────────────────────── */
const buildVerifactuUrl = (nif, invoiceNum, dateStr, total) => {
  // dateStr expected as DD/MM/YYYY → convert to DD-MM-YYYY
  const fecha = dateStr.replace(/\//g, '-');
  const importe = parseFloat(total).toFixed(2);
  return `https://www2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=${nif}&numserie=${encodeURIComponent(invoiceNum)}&fecha=${fecha}&importe=${importe}`;
};

const getQrDataUrl = (text) => {
  if (!window.QRCode) return null;
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden;';
  document.body.appendChild(container);
  try {
    new window.QRCode(container, {
      text,
      width: 160,
      height: 160,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: window.QRCode?.CorrectLevel?.M,
    });
    const canvas = container.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : null;
  } catch {
    return null;
  } finally {
    document.body.removeChild(container);
  }
};

/* ──────────────────────────────────────────────────────────────
   INVOICE PDF  (portrait A4)
─────────────────────────────────────────────────────────────── */
export const generateInvoicePdf = (agent, bookings, dateFrom, dateTo) => {
  if (!agent || !bookings?.length) return;
  const { jsPDF } = window.jspdf;
  const pdoc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdoc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  pdoc.setFontSize(22);
  pdoc.setFont('helvetica', 'bold');
  pdoc.setTextColor(30, 58, 138);
  pdoc.text('INVOICE', pageW - 20, y, { align: 'right' });

  // Our company
  pdoc.setFontSize(9);
  pdoc.setFont('helvetica', 'normal');
  pdoc.setTextColor(55, 65, 81);
  ['Across Aviation SLU', 'C/Juan Díaz, 2 2ª Planta', '29015 Málaga, España', 'CIF: B93644862'].forEach(line => {
    pdoc.text(line, 20, y);
    y += 5;
  });
  y += 8;

  // Bill to + invoice details
  pdoc.setFontSize(10);
  pdoc.setFont('helvetica', 'bold');
  pdoc.setTextColor(17, 24, 39);
  pdoc.text('Bill To:', 20, y);
  pdoc.text('Details:', pageW / 2 + 20, y);
  y += 6;

  pdoc.setFontSize(9);
  const agentLines = [
    agent.agentName || 'N/A',
    ...(agent.agentAddress ? pdoc.splitTextToSize(agent.agentAddress, 75) : []),
    `${agent.agentCity || ''}, ${agent.agentCountryCode || ''}`.trim().replace(/^,\s*/, ''),
  ].filter(Boolean);

  pdoc.setFont('helvetica', 'normal');
  pdoc.text(agentLines, 20, y);

  const invNum = `INV-${agent.agentId || 'X'}-${Date.now()}`;
  const detailsStartY = y;
  [
    ['Invoice #:', invNum],
    ['Date:', new Date().toLocaleDateString('en-GB')],
    ['Period:', `${formatDateStr(dateFrom)} – ${formatDateStr(dateTo)}`],
  ].forEach(([label, val]) => {
    pdoc.setFont('helvetica', 'bold');
    pdoc.text(label, pageW / 2 + 20, y);
    pdoc.setFont('helvetica', 'normal');
    pdoc.text(val, pageW / 2 + 45, y);
    y += 6;
  });

  y = Math.max(detailsStartY + agentLines.length * 5, y) + 10;

  const otherTotal = (b) => (b.otherCharges || []).reduce((s, c) => s + (parseFloat(c.chargeAmount) || 0), 0);
  const tableBody = bookings.map(b => [
    b.awb, formatDateStr(b.createdAt), `${b.origin}-${b.destination}`,
    formatNumberWithSeparators(b.chargeableWeightKg, 1),
    formatNumberWithSeparators(b.freightCharges, 2),
    formatNumberWithSeparators(otherTotal(b), 2),
    formatNumberWithSeparators(b.totalCalculatedCharges, 2),
  ]);

  const totFreight = bookings.reduce((s, b) => s + (parseFloat(b.freightCharges) || 0), 0);
  const totOther   = bookings.reduce((s, b) => s + otherTotal(b), 0);
  const grandTotal = bookings.reduce((s, b) => s + (parseFloat(b.totalCalculatedCharges) || 0), 0);

  pdoc.autoTable({
    startY: y,
    head: [['AWB', 'Date', 'Route', 'Chg.Wt', 'Freight', 'Other', 'Total']],
    body: tableBody,
    foot: [[
      { content: '', colSpan: 4, styles: { fillColor: [229, 231, 235] } },
      { content: formatNumberWithSeparators(totFreight, 2), styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatNumberWithSeparators(totOther, 2), styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatNumberWithSeparators(grandTotal, 2), styles: { halign: 'right', fontStyle: 'bold' } },
    ]],
    theme: 'grid',
    headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold', lineColor: [209, 213, 219], lineWidth: 0.2 },
    footStyles: { fillColor: [229, 231, 235], textColor: [17, 24, 39], fontStyle: 'bold', lineColor: [156, 163, 175], lineWidth: { top: 0.4 } },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [55, 65, 81] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
  });

  y = pdoc.lastAutoTable.finalY + 12;
  pdoc.setFontSize(13);
  pdoc.setFont('helvetica', 'bold');
  pdoc.setTextColor(17, 24, 39);
  pdoc.text(`TOTAL: ${bookings[0]?.currency || 'EUR'} ${formatNumberWithSeparators(grandTotal, 2)}`, pageW - 20, y, { align: 'right' });
  y += 12;
  pdoc.setFontSize(9);
  pdoc.setFont('helvetica', 'normal');
  pdoc.setTextColor(107, 114, 128);
  pdoc.text('Payment due within 30 days. Thank you for your business.', 20, y);
  y += 14;

  // ── Verifactu QR (Real Decreto 1007/2023) ──────────────────
  const COMPANY_NIF  = 'B93644862';                       // CIF without hyphen
  const invoiceDate  = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
  const verifactuUrl = buildVerifactuUrl(COMPANY_NIF, invNum, invoiceDate, grandTotal);
  const qrImg        = getQrDataUrl(verifactuUrl);

  const QR_SIZE = 28; // mm
  if (qrImg) {
    pdoc.addImage(qrImg, 'PNG', 20, y, QR_SIZE, QR_SIZE);
    pdoc.setFontSize(7);
    pdoc.setFont('helvetica', 'bold');
    pdoc.setTextColor(55, 65, 81);
    pdoc.text('Verifactu', 20 + QR_SIZE / 2, y + QR_SIZE + 3, { align: 'center' });
    pdoc.setFont('helvetica', 'normal');
    pdoc.setFontSize(6);
    pdoc.setTextColor(107, 114, 128);
    pdoc.text('Real Decreto 1007/2023', 20 + QR_SIZE / 2, y + QR_SIZE + 6.5, { align: 'center' });
    // Also print the URL in tiny font so inspectors can verify manually
    const urlLines = pdoc.splitTextToSize(verifactuUrl, pageW - 20 - (20 + QR_SIZE + 4));
    pdoc.text(urlLines, 20 + QR_SIZE + 4, y + 4);
  }

  pdoc.save(`Invoice_${(agent.agentName || 'Agent').replace(/\s+/g,'_')}_${dateFrom}_${dateTo}.pdf`);
};
