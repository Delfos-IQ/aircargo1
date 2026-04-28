import React from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import Layout from '../../components/Layout.jsx';

const FIELDS = [
  { key: 'code', label: 'IATA Code (e.g. LIS)', required: true, transform: v => v.toUpperCase(), maxLength: 3 },
  { key: 'name', label: 'Airport Name', required: true },
  { key: 'city', label: 'City', required: true },
  { key: 'country', label: 'Country', required: true },
];

const COLUMNS = [
  { label: 'Code', key: 'code' },
  { label: 'Airport', key: 'name' },
  { label: 'City', key: 'city' },
  { label: 'Country', key: 'country' },
];

export default function AirportsPage() {
  return (
    <Layout>
      <CrudPage
        title="IATA Airport Codes"
        collectionName="managedIataAirportCodes"
        initialFormData={{ code: '', name: '', city: '', country: '' }}
        fields={FIELDS}
        listColumns={COLUMNS}
        searchKeys={['code', 'name', 'city', 'country']}
        uniqueKey="code"
        sortFn={(a, b) => (a.code || '').localeCompare(b.code || '')}
      />
    </Layout>
  );
}
