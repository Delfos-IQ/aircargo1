import React from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import Layout from '../../components/Layout.jsx';

const FIELDS = [
  { key: 'flightNumber', label: 'Flight Number (e.g. DT653)', required: true, transform: v => v.toUpperCase(), editDisabled: true },
  { key: 'origin', label: 'Origin (e.g. LIS)', required: true, transform: v => v.toUpperCase(), maxLength: 3 },
  { key: 'destination', label: 'Destination (e.g. LAD)', required: true, transform: v => v.toUpperCase(), maxLength: 3 },
  { key: 'carrierCode', label: 'Carrier Code (e.g. DT)', required: true, transform: v => v.toUpperCase(), maxLength: 2 },
  { key: 'aircraftType', label: 'Aircraft Type (e.g. B77L)', required: true, transform: v => v.toUpperCase() },
  { key: 'daysOfOperation', label: 'Days of Operation (e.g. 135 = Mon,Wed,Fri)', required: true, transform: v => v.replace(/[^1-7]/g, '') },
  { key: 'std', label: 'STD (HH:MM)', type: 'time', required: true },
  { key: 'sta', label: 'STA (HH:MM)', type: 'time', required: true },
  { key: 'maxPayloadKg', label: 'Max Payload KG', type: 'number' },
  { key: 'maxPayloadCbm', label: 'Max Payload CBM', type: 'number', step: '0.1' },
];

const COLUMNS = [
  { label: 'Flight', key: 'flightNumber' },
  { label: 'Route', render: item => `${item.origin || ''}→${item.destination || ''}` },
  { label: 'Days', key: 'daysOfOperation' },
  { label: 'STD', key: 'std' },
  { label: 'STA', key: 'sta' },
  { label: 'Aircraft', key: 'aircraftType' },
  { label: 'Max KG', key: 'maxPayloadKg' },
];

export default function FlightsPage() {
  return (
    <Layout>
      <CrudPage
        title="Flight Management"
        collectionName="flightSchedules"
        initialFormData={{ flightNumber: '', origin: '', destination: '', std: '', sta: '', daysOfOperation: '', aircraftType: '', carrierCode: '', maxPayloadKg: '', maxPayloadCbm: '' }}
        fields={FIELDS}
        listColumns={COLUMNS}
        searchKeys={['flightNumber', 'origin', 'destination', 'carrierCode']}
        uniqueKey="flightNumber"
        sortFn={(a, b) => (a.flightNumber || '').localeCompare(b.flightNumber || '')}
      />
    </Layout>
  );
}
