/**
 * exportBookingsExcel.js
 * Generates a styled multi-sheet Excel workbook from a bookings dataset.
 * Uses ExcelJS (browser build) for full formatting support.
 *
 * Sheets:
 *   1. Bookings  — full data table with header block, freeze pane, auto-filter, totals
 *   2. Summary   — revenue by agent + revenue by booking status
 */

import ExcelJS from 'exceljs';

/* ─── Brand palette ─────────────────────────────────────────── */
const NAVY   = '1B2766';   // AcrossCargo dark navy
const ORANGE = 'D44A12';   // AcrossCargo orange
const LGRAY  = 'F2F4F8';   // Alternating row light
const WHITE  = 'FFFFFF';
const GOLD   = 'FFF3CD';   // Warning / WL / NN rows
const RED_BG = 'FFE2E2';   // Cancelled rows
const GREEN_BG = 'DCFCE7'; // Confirmed rows

/* ─── Status helpers ─────────────────────────────────────────── */
const STATUS_STYLE = {
  KK: { bg: '166534', fg: WHITE, label: 'KK — Confirmed' },
  NN: { bg: 'B45309', fg: WHITE, label: 'NN — Requested' },
  WL: { bg: 'B45309', fg: WHITE, label: 'WL — Waitlisted' },
  XX: { bg: '991B1B', fg: WHITE, label: 'XX — Cancelled' },
  HX: { bg: '991B1B', fg: WHITE, label: 'HX — House Cancel' },
};

/* ─── Helper: apply a consistent border to a cell ───────────── */
function border(cell) {
  const thin = { style: 'thin', color: { argb: 'FFD1D5DB' } };
  cell.border = { top: thin, left: thin, bottom: thin, right: thin };
}

/* ─── Helper: format Firestore timestamp ───────────────────── */
function fmtDate(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().split('T')[0];
  } catch { return ''; }
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT FUNCTION
   bookings    — array of booking objects (already filtered)
   agentProfiles — array of agentProfile objects from context
   filterMeta  — { search, filterAgent, filterStatus } for header info
═══════════════════════════════════════════════════════════════ */
export async function exportBookingsToExcel(bookings, agentProfiles = [], filterMeta = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'AcrossCargo CMS';
  wb.created  = new Date();
  wb.modified = new Date();

  const agentName = (id) => agentProfiles.find(a => a.id === id)?.agentName ?? '—';
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  /* ══════════════════════════════════════
     SHEET 1 — BOOKINGS
  ══════════════════════════════════════ */
  const ws = wb.addWorksheet('Bookings', { views: [{ state: 'frozen', ySplit: 5 }] });

  /* ── Column definitions ── */
  ws.columns = [
    { key: 'awb',      width: 16 },  // A
    { key: 'date',     width: 13 },  // B
    { key: 'agent',    width: 24 },  // C
    { key: 'origin',   width:  8 },  // D
    { key: 'dest',     width:  8 },  // E
    { key: 'shipper',  width: 28 },  // F
    { key: 'consignee',width: 28 },  // G
    { key: 'pcs',      width:  7 },  // H
    { key: 'wt',       width: 10 },  // I
    { key: 'chgwt',    width: 14 },  // J
    { key: 'vol',      width: 10 },  // K
    { key: 'status',   width: 14 },  // L
    { key: 'currency', width:  9 },  // M
    { key: 'rate',     width: 10 },  // N
    { key: 'freight',  width: 14 },  // O
    { key: 'other',    width: 14 },  // P
    { key: 'total',    width: 14 },  // Q
    { key: 'payment',  width: 10 },  // R
    { key: 'flown',    width:  8 },  // S
  ];

  const COL_COUNT = ws.columns.length; // 19

  /* ── Row 1: Company banner ── */
  ws.mergeCells(1, 1, 1, COL_COUNT);
  const r1 = ws.getCell('A1');
  r1.value = 'ACROSSCARGO — Cargo Management Platform';
  r1.font  = { name: 'Arial', bold: true, size: 14, color: { argb: WHITE } };
  r1.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  /* ── Row 2: Export meta ── */
  ws.mergeCells(2, 1, 2, 10);
  ws.mergeCells(2, 11, 2, COL_COUNT);
  const r2a = ws.getCell('A2');
  r2a.value = `Booking Export — Generated ${now}`;
  r2a.font  = { name: 'Arial', size: 10, color: { argb: '374151' } };
  r2a.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8EAF0' } };
  r2a.alignment = { vertical: 'middle' };

  const filterDesc = [
    filterMeta.search      ? `Search: "${filterMeta.search}"`  : null,
    filterMeta.filterAgent ? `Agent: ${agentName(filterMeta.filterAgent)}` : null,
    filterMeta.filterStatus ? `Status: ${filterMeta.filterStatus}` : null,
  ].filter(Boolean).join(' · ') || 'All bookings';

  const r2b = ws.getCell('K2');
  r2b.value = filterDesc;
  r2b.font  = { name: 'Arial', size: 10, italic: true, color: { argb: '6B7280' } };
  r2b.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8EAF0' } };
  r2b.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(2).height = 20;

  /* ── Row 3: Stats bar ── */
  ws.mergeCells(3, 1, 3, 5);
  ws.mergeCells(3, 6, 3, 10);
  ws.mergeCells(3, 11, 3, COL_COUNT);

  const totalRev = bookings.reduce((s, b) => s + (parseFloat(b.totalCalculatedCharges) || 0), 0);
  const kkCount  = bookings.filter(b => b.bookingStatus === 'KK').length;

  const statCells = [
    { ref: 'A3', val: `${bookings.length} bookings` },
    { ref: 'F3', val: `Confirmed (KK): ${kkCount} of ${bookings.length}` },
    { ref: 'K3', val: `Total Revenue: ${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  ];
  statCells.forEach(({ ref, val }) => {
    const c = ws.getCell(ref);
    c.value = val;
    c.font  = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
    c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(3).height = 18;

  /* ── Row 4: Column headers ── */
  const HEADERS = [
    'AWB Number', 'Date', 'Agent', 'Origin', 'Dest.',
    'Shipper', 'Consignee',
    'Pcs', 'Weight (kg)', 'Chg. Wt (kg)', 'Volume (m³)',
    'Status', 'Currency', 'Rate/kg',
    'Freight', 'Other Charges', 'Total Charges',
    'Payment', 'Flown',
  ];

  const hRow = ws.getRow(4);
  HEADERS.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font  = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    border(cell);
  });
  hRow.height = 22;

  /* ── Rows 5+: Data ── */
  const DATA_START = 5;
  bookings.forEach((b, idx) => {
    const rowNum  = DATA_START + idx;
    const isEven  = idx % 2 === 1;
    const bgColor = isEven ? LGRAY : WHITE;
    const freight = parseFloat(b.freightCharges) || 0;
    const other   = (b.otherCharges || []).reduce((s, c) => s + (parseFloat(c.chargeAmount) || 0), 0);
    const total   = parseFloat(b.totalCalculatedCharges) || 0;

    const values = [
      b.awb || '—',
      fmtDate(b.createdAt),
      agentName(b.selectedAgentProfileId),
      b.origin || '—',
      b.destination || '—',
      b.shipperName || '—',
      b.consigneeName || '—',
      parseFloat(b.pieces) || 0,
      parseFloat(b.weightKg) || 0,
      parseFloat(b.chargeableWeightKg) || 0,
      parseFloat(b.volumeM3) || 0,
      b.bookingStatus || '—',
      b.currency || '—',
      parseFloat(b.ratePerKg) || 0,
      freight,
      other,
      total,
      b.paymentType || '—',
      b.isFlown ? 'Yes' : 'No',
    ];

    const dataRow = ws.getRow(rowNum);
    values.forEach((val, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value = val;
      cell.font  = { name: 'Arial', size: 9 };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.alignment = { vertical: 'middle' };
      border(cell);

      // Number formatting
      if (ci === 7)  { cell.numFmt = '#,##0';     cell.alignment.horizontal = 'center'; }  // Pcs
      if (ci === 8)  { cell.numFmt = '#,##0.0';   cell.alignment.horizontal = 'right'; }   // Weight
      if (ci === 9)  { cell.numFmt = '#,##0.0';   cell.alignment.horizontal = 'right'; }   // Chg wt
      if (ci === 10) { cell.numFmt = '#,##0.000'; cell.alignment.horizontal = 'right'; }   // Volume
      if (ci === 13) { cell.numFmt = '#,##0.00';  cell.alignment.horizontal = 'right'; }   // Rate
      if (ci === 14) { cell.numFmt = '#,##0.00';  cell.alignment.horizontal = 'right'; }   // Freight
      if (ci === 15) { cell.numFmt = '#,##0.00';  cell.alignment.horizontal = 'right'; }   // Other
      if (ci === 16) { cell.numFmt = '#,##0.00';  cell.alignment.horizontal = 'right';      // Total — bold
                       cell.font   = { name: 'Arial', size: 9, bold: true }; }
      if (ci === 18) { cell.alignment.horizontal = 'center'; }  // Flown

      // Status badge colouring
      if (ci === 11) {
        const st = STATUS_STYLE[val] || null;
        if (st) {
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.bg } };
          cell.font      = { name: 'Arial', size: 9, bold: true, color: { argb: st.fg } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }

      // Row-level tint for cancelled bookings (overrides alternating only on non-status cols)
      if (['XX', 'HX'].includes(b.bookingStatus) && ci !== 11) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5' } };
      }
    });
    dataRow.height = 16;
  });

  /* ── Totals row ── */
  const totalRow = DATA_START + bookings.length;
  const tRow = ws.getRow(totalRow);

  ws.mergeCells(totalRow, 1, totalRow, 7);
  const tLabel = tRow.getCell(1);
  tLabel.value = `TOTAL — ${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`;
  tLabel.font  = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
  tLabel.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  tLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  const sumCols = { H: 8, I: 9, J: 10, K: 11, O: 15, P: 16, Q: 17 };
  Object.entries(sumCols).forEach(([col, ci]) => {
    const cell  = tRow.getCell(ci);
    const range = `${col}${DATA_START}:${col}${totalRow - 1}`;
    cell.value  = { formula: `SUM(${range})` };
    cell.font   = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.numFmt = ci >= 15 ? '#,##0.00' : (ci === 11 ? '#,##0.000' : '#,##0.0');
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
    border(cell);
  });

  // Fill remaining totals cells with navy
  for (let ci = 12; ci <= COL_COUNT; ci++) {
    if (!Object.values(sumCols).includes(ci)) {
      const cell = tRow.getCell(ci);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    }
  }
  tRow.height = 22;

  /* ── Auto-filter on header row ── */
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COL_COUNT } };

  /* ── Tab color ── */
  ws.properties.tabColor = { argb: NAVY };

  /* ══════════════════════════════════════
     SHEET 2 — SUMMARY
  ══════════════════════════════════════ */
  const ws2 = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  ws2.properties.tabColor = { argb: ORANGE };

  ws2.columns = [
    { width: 32 }, // A
    { width: 14 }, // B — Bookings
    { width: 16 }, // C — Total Revenue
    { width: 13 }, // D — Avg per AWB
    { width: 2  }, // E — spacer
    { width: 20 }, // F — Status
    { width: 14 }, // G — Bookings
    { width: 16 }, // H — Revenue
  ];

  /* ── Summary banner ── */
  ws2.mergeCells('A1:H1');
  const s1 = ws2.getCell('A1');
  s1.value = 'ACROSSCARGO — Booking Summary';
  s1.font  = { name: 'Arial', bold: true, size: 13, color: { argb: WHITE } };
  s1.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  s1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 28;

  ws2.mergeCells('A2:H2');
  const s2 = ws2.getCell('A2');
  s2.value = `Generated ${now} · ${bookings.length} bookings · Total revenue: ${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  s2.font  = { name: 'Arial', size: 10, italic: true, color: { argb: '6B7280' } };
  s2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8EAF0' } };
  s2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(2).height = 18;

  ws2.getRow(3).height = 10; // spacer

  /* ── Revenue by Agent (left table) ── */
  const agentMap = {};
  bookings.forEach(b => {
    const name = agentName(b.selectedAgentProfileId);
    if (!agentMap[name]) agentMap[name] = { count: 0, revenue: 0 };
    agentMap[name].count++;
    agentMap[name].revenue += parseFloat(b.totalCalculatedCharges) || 0;
  });
  const agentRows = Object.entries(agentMap).sort((a, b) => b[1].revenue - a[1].revenue);

  // Section header
  const agentSecRow = 4;
  ['Agent', 'Bookings', 'Total Revenue', 'Avg / AWB'].forEach((h, ci) => {
    const cell = ws2.getRow(agentSecRow).getCell(ci + 1);
    cell.value = h;
    cell.font  = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: ci === 0 ? 'left' : 'right', vertical: 'middle' };
    border(cell);
  });
  ws2.getRow(agentSecRow).height = 20;

  agentRows.forEach(([name, data], idx) => {
    const rn  = agentSecRow + 1 + idx;
    const bg  = idx % 2 === 0 ? WHITE : LGRAY;
    const row = ws2.getRow(rn);

    const cells = [name, data.count, data.revenue, data.count ? data.revenue / data.count : 0];
    cells.forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val;
      cell.font  = { name: 'Arial', size: 9 };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle', horizontal: ci === 0 ? 'left' : 'right' };
      if (ci >= 2) cell.numFmt = '#,##0.00';
      if (ci === 1) cell.numFmt = '#,##0';
      border(cell);
    });
    row.height = 16;
  });

  // Agent totals
  const agTotalRow = agentSecRow + 1 + agentRows.length;
  const agTRow = ws2.getRow(agTotalRow);
  ['TOTAL', agentRows.reduce((s, [, d]) => s + d.count, 0),
            agentRows.reduce((s, [, d]) => s + d.revenue, 0), ''].forEach((val, ci) => {
    const cell = agTRow.getCell(ci + 1);
    cell.value = val;
    cell.font  = { name: 'Arial', bold: true, size: 9, color: { argb: WHITE } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    cell.alignment = { horizontal: ci === 0 ? 'left' : 'right', vertical: 'middle' };
    if (ci === 2) cell.numFmt = '#,##0.00';
    if (ci === 1) cell.numFmt = '#,##0';
    border(cell);
  });
  agTRow.height = 18;

  /* ── Revenue by Status (right table) ── */
  const statusMap = {};
  bookings.forEach(b => {
    const st = b.bookingStatus || 'Unknown';
    if (!statusMap[st]) statusMap[st] = { count: 0, revenue: 0 };
    statusMap[st].count++;
    statusMap[st].revenue += parseFloat(b.totalCalculatedCharges) || 0;
  });
  const statusRows = Object.entries(statusMap).sort((a, b) => b[1].revenue - a[1].revenue);

  ['Status', 'Bookings', 'Revenue'].forEach((h, ci) => {
    const cell = ws2.getRow(agentSecRow).getCell(6 + ci);
    cell.value = h;
    cell.font  = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: ci === 0 ? 'left' : 'right', vertical: 'middle' };
    border(cell);
  });

  statusRows.forEach(([st, data], idx) => {
    const rn  = agentSecRow + 1 + idx;
    const stStyle = STATUS_STYLE[st] || null;
    const row = ws2.getRow(rn);

    [st, data.count, data.revenue].forEach((val, ci) => {
      const cell = row.getCell(6 + ci);
      cell.value = val;
      cell.font  = { name: 'Arial', size: 9, bold: ci === 0 && !!stStyle, color: { argb: ci === 0 && stStyle ? stStyle.fg : '111827' } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: ci === 0 && stStyle ? stStyle.bg : (idx % 2 === 0 ? WHITE : LGRAY) } };
      cell.alignment = { vertical: 'middle', horizontal: ci === 0 ? 'left' : 'right' };
      if (ci === 2) cell.numFmt = '#,##0.00';
      if (ci === 1) cell.numFmt = '#,##0';
      border(cell);
    });
    row.height = 16;
  });

  /* ══════════════════════════════════════
     WRITE & DOWNLOAD
  ══════════════════════════════════════ */
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `AcrossCargo_Bookings_${date}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
