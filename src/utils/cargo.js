import { isValidAwbSerialWithCheckDigit } from './awb.js';

/** Calcula el volumen total en m³ a partir de líneas de dimensiones. */
export const calculateVolumeM3 = (dimensionLines) => {
  if (!dimensionLines?.length) return '0.000';
  let totalVolume = 0;
  dimensionLines.forEach(({ pieces, length, width, height }) => {
    const p = parseFloat(pieces) || 0;
    const l = parseFloat(length) || 0;
    const w = parseFloat(width)  || 0;
    const h = parseFloat(height) || 0;
    if (p > 0 && l > 0 && w > 0 && h > 0) totalVolume += (l * w * h * p) / 1_000_000;
  });
  return totalVolume.toFixed(3);
};

/** Calcula el peso imputable (chargeable) como máximo entre real y volumétrico. */
export const calculateChargeableWeight = (actualWeightStr, dimensionLines) => {
  const actualWeight = parseFloat(actualWeightStr) || 0;
  let totalVolumetric = 0;
  dimensionLines?.forEach(({ pieces, length, width, height }) => {
    const p = parseFloat(pieces) || 0;
    const l = parseFloat(length) || 0;
    const w = parseFloat(width)  || 0;
    const h = parseFloat(height) || 0;
    if (p > 0 && l > 0 && w > 0 && h > 0) totalVolumetric += (l * w * h * p) / 6000;
  });
  return Math.max(actualWeight, totalVolumetric).toFixed(1);
};

/** Busca la tarifa aplicable en la tabla de tarifas para un booking dado.
 *  Si se pasa airlineCode, prioriza entradas que coincidan con esa aerolínea.
 *  Fallback 1: entradas genéricas sin airlineCode para esa ruta.
 *  Fallback 2: cualquier entrada de esa ruta (compatibilidad con registros antiguos).
 */
export const getRateForBooking = (origin, destination, currency, chargeableWeightKg, rateTable, airlineCode = '') => {
  const matchRoute = r =>
    r.origin?.toUpperCase()   === origin.toUpperCase()      &&
    r.dest?.toUpperCase()     === destination.toUpperCase() &&
    r.currency?.toUpperCase() === currency.toUpperCase();

  // 1. Coincidencia exacta: ruta + aerolínea
  let rateEntry = airlineCode
    ? rateTable.find(r => matchRoute(r) && r.airlineCode?.toUpperCase() === airlineCode.toUpperCase())
    : null;

  // 2. Fallback: tarifa genérica (sin airlineCode) para la misma ruta
  if (!rateEntry) rateEntry = rateTable.find(r => matchRoute(r) && !r.airlineCode);

  // 3. Último recurso: cualquier entrada para esa ruta
  if (!rateEntry) rateEntry = rateTable.find(r => matchRoute(r));

  if (!rateEntry) return null;

  const cw = chargeableWeightKg;
  let applicableRateStr = rateEntry.srN;
  if (rateEntry.srQ3000 && cw >= 3000 && String(rateEntry.srQ3000).trim() !== '') applicableRateStr = String(rateEntry.srQ3000);
  else if (rateEntry.srQ1000 && cw >= 1000 && String(rateEntry.srQ1000).trim() !== '') applicableRateStr = String(rateEntry.srQ1000);
  else if (rateEntry.srQ500  && cw >= 500  && String(rateEntry.srQ500).trim()  !== '') applicableRateStr = String(rateEntry.srQ500);
  else if (rateEntry.srQ300  && cw >= 300  && String(rateEntry.srQ300).trim()  !== '') applicableRateStr = String(rateEntry.srQ300);
  else if (rateEntry.srQ100  && cw >= 100  && String(rateEntry.srQ100).trim()  !== '') applicableRateStr = String(rateEntry.srQ100);

  const applicableRate = parseFloat(String(applicableRateStr || '0').replace(',', '.')) || 0;
  const minCharge      = parseFloat(String(rateEntry.minCharge || '0').replace(',', '.')) || 0;
  return { rate: applicableRate, minCharge };
};

/** Valida los datos de un booking antes de guardarlo. Devuelve string de error o null. */
export const validateBookingData = (data) => {
  const required = [
    'awbInputPrefix', 'awbInputNumber', 'origin', 'destination',
    'pieces', 'weightKg', 'natureOfGoods',
    'currency', 'paymentType', 'bookingStatus',
  ];
  for (const field of required) {
    if (!data[field] || String(data[field]).trim() === '') {
      return `Error: Missing required field - ${field.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}`;
    }
  }
  if (isNaN(parseFloat(data.pieces)) || parseFloat(data.pieces) <= 0)
    return 'Error: Pieces must be a positive number.';
  if (isNaN(parseFloat(data.weightKg)) || parseFloat(data.weightKg) <= 0)
    return 'Error: Weight must be a positive number.';
  if (data.otherCharges?.length) {
    for (const charge of data.otherCharges) {
      if (charge.chargeAmount && (isNaN(parseFloat(charge.chargeAmount)) || parseFloat(charge.chargeAmount) < 0))
        return `Error: Other Charge Amount for ${charge.chargeDescription || charge.chargeCode} must be a non-negative number.`;
    }
  }
  if (data.awbInputPrefix?.length !== 3)  return 'Error: AWB Prefix must be 3 digits.';
  if (data.awbInputNumber?.length !== 8)  return 'Error: AWB Number must be 8 digits.';
  if (!isValidAwbSerialWithCheckDigit(data.awbInputNumber))
    return 'Error: AWB Number has an invalid check digit.';
  if (data.dimensionLines?.length) {
    for (const line of data.dimensionLines) {
      if (!line.pieces || parseFloat(line.pieces) <= 0) return 'Error: Dimension line pieces must be a positive number.';
      if (!line.length || parseFloat(line.length) <= 0) return 'Error: Dimension line length must be a positive number.';
      if (!line.width  || parseFloat(line.width)  <= 0) return 'Error: Dimension line width must be a positive number.';
      if (!line.height || parseFloat(line.height) <= 0) return 'Error: Dimension line height must be a positive number.';
    }
  }
  if (!data.flightSegments?.length) return 'Error: At least one flight segment is required.';
  for (const seg of data.flightSegments) {
    if (!seg.flightNumber?.trim() && !seg.flightScheduleId?.trim())
      return 'Error: Flight segment flight number or schedule is required.';
    if (!seg.departureDate)         return 'Error: Flight segment departure date is required.';
    if (!seg.segmentOrigin?.trim()) return 'Error: Flight segment origin is required.';
    if (!seg.segmentDestination?.trim()) return 'Error: Flight segment destination is required.';
    if (seg.segmentOrigin === seg.segmentDestination)
      return `Error: Flight segment origin and destination cannot be the same (${seg.segmentOrigin}).`;
  }
  return null;
};
