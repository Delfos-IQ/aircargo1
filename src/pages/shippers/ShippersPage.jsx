import React from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import { countryCodeData } from '../../data/countries.js';
import Layout from '../../components/Layout.jsx';

const FIELDS = [
  { key: 'shipperName', label: 'Shipper Name', required: true, transform: v => v.toUpperCase() },
  { key: 'shipperAddress', label: 'Address', type: 'textarea', rows: 2, transform: v => v.toUpperCase() },
  { key: 'shipperCity', label: 'City', transform: v => v.toUpperCase() },
  { key: 'shipperZipCode', label: 'Postal Code', transform: v => v.toUpperCase() },
  {
    key: 'shipperCountryCode', label: 'Country', type: 'select',
    placeholder: 'Select country',
    options: countryCodeData.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` })),
  },
  { key: 'shipperPhone', label: 'Phone', type: 'tel' },
  { key: 'shipperEmail', label: 'Email', type: 'email', transform: v => v.toLowerCase() },
];

const COLUMNS = [
  { label: 'Shipper', key: 'shipperName' },
  { label: 'City', key: 'shipperCity' },
  { label: 'Country', key: 'shipperCountryCode' },
  { label: 'Phone', key: 'shipperPhone' },
  { label: 'Email', key: 'shipperEmail' },
];

export default function ShippersPage() {
  return (
    <Layout>
      <CrudPage
        title="Shipper Management"
        collectionName="shipperProfiles"
        initialFormData={{ shipperName: '', shipperAddress: '', shipperCity: '', shipperZipCode: '', shipperCountryCode: '', shipperPhone: '', shipperEmail: '' }}
        fields={FIELDS}
        listColumns={COLUMNS}
        searchKeys={['shipperName', 'shipperCity', 'shipperEmail']}
        sortFn={(a, b) => (a.shipperName || '').localeCompare(b.shipperName || '')}
      />
    </Layout>
  );
}
