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
    return d.toLocaleDateString('es-ES');
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
  pdoc.text(`Fecha: ${formatDateStr(booking.createdAt)}`, RIGHT, y, { align: 'right' });
  y += 5;
  pdoc.text(`Aerolínea: ${airline ? `${airline.prefix} – ${airline.name}` : booking.awbInputPrefix || 'N/A'}`, LEFT, y);
  y += 8;
  pdoc.setTextColor(17, 24, 39);

  drawSection('Detalles del Envío', [
    { label: 'Origen', value: getAirport(booking.origin) },
    { label: 'Destino', value: getAirport(booking.destination) },
    { label: 'Bultos', value: booking.pieces },
    { label: 'Peso real', value: `${booking.weightKg} kg` },
    { label: 'Peso imputable', value: `${booking.chargeableWeightKg || '—'} kg` },
    { label: 'Volumen', value: `${booking.volumeM3 || '—'} m³` },
    { label: 'Mercancía', value: booking.natureOfGoods },
    { label: 'SHC', value: booking.selectedShcCode },
    { label: 'Estado', value: booking.bookingStatus },
  ]);

  // Flight segments table
  if (booking.flightSegments?.length) {
    checkPage();
    pdoc.setFontSize(10);
    pdoc.setFont('helvetica', 'bold');
    pdoc.setFillColor(243, 244, 246);
    pdoc.rect(LEFT, y - 4, RIGHT - LEFT, 6, 'F');
    pdoc.text('ITINERARIO DE VUELO', LEFT + 2, y);
    y += 3;

    pdoc.autoTable({
      startY: y,
      head: [['Vuelo', 'Fecha', 'Origen', 'Destino', 'STD', 'STA', 'Estado']],
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
    drawSection('Dimensiones', booking.dimensionLines.map((d, i) => ({
      label: `Línea ${i + 1}`,
      value: `${d.pieces} bultos — ${d.length}×${d.width}×${d.height} cm`,
    })));
  }

  drawSection('Shipper', [
    { label: 'Nombre', value: booking.shipperName },
    { label: 'Dirección', value: booking.shipperStreet },
    { label: 'Ciudad/País', value: `${booking.shipperCity || ''}, ${booking.shipperCountry || ''}` },
    { label: 'Contacto', value: booking.shipperContact },
  ]);

  drawSection('Consignee', [
    { label: 'Nombre', value: booking.consigneeName },
    { label: 'Dirección', value: booking.consigneeStreet },
    { label: 'Ciudad/País', value: `${booking.consigneeCity || ''}, ${booking.consigneeCountry || ''}` },
    { label: 'Contacto', value: booking.consigneeContact },
  ]);

  drawSection('Agente', [
    { label: 'Nombre', value: booking.agent_details_name },
    { label: 'IATA/CASS', value: booking.agentIataCassNumber || booking.agent_id },
    { label: 'Referencia', value: booking.ffrReference },
  ]);

  drawSection('Cargos', [
    { label: 'Moneda', value: booking.currency },
    { label: 'Tarifa/kg', value: String(booking.ratePerKg) },
    { label: 'Flete', value: String(booking.freightCharges) },
    { label: 'Total', value: String(booking.totalCalculatedCharges) },
    { label: 'Tipo pago', value: booking.paymentType },
  ]);

  // Other charges table
  if (booking.otherCharges?.length) {
    checkPage();
    pdoc.autoTable({
      startY: y,
      head: [['Código', 'Descripción', 'Importe']],
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
  pdoc.text(`Generated: ${new Date().toLocaleDateString('es-ES')}`, pageW - 20, 35, { align: 'right' });

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
      pdoc.text('AcrossAviation', data.settings.margin.left, pdoc.internal.pageSize.height - 8);
      pdoc.text(`Pág. ${data.pageNumber}`, pageW - data.settings.margin.right, pdoc.internal.pageSize.height - 8, { align: 'right' });
    },
  });

  pdoc.save(`Cargo_Sales_Report_${dateFrom}_${dateTo}.pdf`);
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
  ['AcrossAviation SLU', 'Crta Castilnuevo 98', '19300 Molina de Aragon, Guadalajara', 'CIF: B-93644862'].forEach(line => {
    pdoc.text(line, 20, y);
    y += 5;
  });
  y += 8;

  // Bill to + invoice details
  pdoc.setFontSize(10);
  pdoc.setFont('helvetica', 'bold');
  pdoc.setTextColor(17, 24, 39);
  pdoc.text('Bill To:', 20, y);
  pdoc.text('Detalles:', pageW / 2 + 20, y);
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
    ['Factura #:', invNum],
    ['Fecha:', new Date().toLocaleDateString('es-ES')],
    ['Período:', `${formatDateStr(dateFrom)} – ${formatDateStr(dateTo)}`],
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
    head: [['AWB', 'Fecha', 'Ruta', 'Chg.Wt', 'Flete', 'Otros', 'Total']],
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
  pdoc.text('Pago en 30 días. Gracias por su negocio.', 20, y);

  pdoc.save(`Invoice_${(agent.agentName || 'Agent').replace(/\s+/g,'_')}_${dateFrom}_${dateTo}.pdf`);
};
