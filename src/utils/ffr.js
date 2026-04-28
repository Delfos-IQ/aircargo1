/**
 * Genera el mensaje FFR (Freight Forwarder Request) en formato IATA Cargo-IMP.
 */

const formatDateDDMMM = (dateStr) => {
  if (!dateStr) return 'NIL';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d)) return 'NIL';
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return String(d.getDate()).padStart(2,'0') + months[d.getMonth()];
};

export const generateFFRMessage = (booking) => {
  let msg = 'FFR/7\n';

  const awbMain = `${booking.awbInputPrefix}-${booking.awbInputNumber}${(booking.origin||'NIL').toUpperCase()}${(booking.destination||'NIL').toUpperCase()}`;

  // Weight field
  let kWeight = 'K0';
  const wt = parseFloat(booking.weightKg || '0');
  if (!isNaN(wt)) {
    const intPart = Math.floor(wt);
    const dec = Math.round((wt - intPart) * 10);
    if (dec === 0) kWeight = `K${intPart}`;
    else if (dec <= 5) kWeight = `K${intPart}P5`;
    else kWeight = `K${intPart + 1}`;
  }

  // Volume field
  let mcVol = 'MC0.00';
  const vol = parseFloat(String(booking.volumeM3 || '0'));
  if (!isNaN(vol)) mcVol = `MC${(Math.round(vol * 100) / 100).toFixed(2)}`;

  const ngp = (booking.natureOfGoods || 'GENERAL CARGO').toUpperCase();
  msg += `${awbMain}/T${booking.pieces || '0'}${kWeight}${mcVol}/${ngp}\n`;

  // Flight segments
  if (booking.flightSegments?.length) {
    booking.flightSegments.forEach(seg => {
      const fn = (seg.flightNumber || 'NIL').toUpperCase();
      const dt = formatDateDDMMM(seg.departureDate);
      const orig = (seg.segmentOrigin || 'NIL').toUpperCase();
      const dest = (seg.segmentDestination || 'NIL').toUpperCase();
      const st = (booking.bookingStatus || 'NN').toUpperCase();
      msg += `FLT/${fn}/${dt}/${orig}${dest}/${st}\n`;
    });
  }

  // SSR
  if (booking.handlingInformation) {
    const ssr = booking.handlingInformation.replace(/^SSR\//i, '').trim();
    if (ssr) msg += `SSR/${ssr.toUpperCase()}\n`;
  }

  // SHP
  if (booking.selectedShcCode) msg += `SHP/${booking.selectedShcCode.toUpperCase()}\n`;

  // DIM lines
  if (booking.dimensionLines?.length) {
    const grouped = {};
    booking.dimensionLines.forEach(ln => {
      if (ln.length && ln.width && ln.height && ln.pieces && parseFloat(ln.pieces) > 0) {
        const key = `CMT${ln.length}-${ln.width}-${ln.height}`;
        if (!grouped[key]) grouped[key] = { l: ln.length, w: ln.width, h: ln.height, total: 0 };
        grouped[key].total += parseInt(ln.pieces, 10);
      }
    });
    Object.values(grouped).forEach(g => {
      if (g.total > 0) msg += `DIM/K0/CMT${g.l}-${g.w}-${g.h}/${g.total}\n`;
    });
  }

  // REF
  msg += `REF/${(booking.ffrReference || 'NIL_REF').toUpperCase()}/ACROSS\n`;

  // CUS / agent
  const cassRaw = (booking.agentIataCassNumber || 'NIL_CASS').replace(/\//g, '');
  const regAgent = cassRaw.slice(0, 7);
  const agentId  = cassRaw.slice(7);
  msg += `CUS//${regAgent}/${agentId}/AGT\n`;
  msg += `/${(booking.agent_details_name || 'NIL_AGENT_NAME').toUpperCase()}\n`;
  msg += `/${(booking.agentCity || 'NIL_AGENT_CITY').toUpperCase()}\n`;

  // OSI
  if (booking.osiGhaText) {
    const osi = booking.osiGhaText.replace(/^OSI\//i, '').trim();
    if (osi && osi.toUpperCase() !== 'GHA:') msg += `OSI/${osi.toUpperCase()}\n`;
  }

  msg += 'SRI/ACROSS\n';
  return msg.trimEnd();
};
