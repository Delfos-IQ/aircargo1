import React from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import { countryCodeData } from '../../data/countries.js';
import Layout from '../../components/Layout.jsx';

const FIELDS = [
  { key: 'consigneeName', label: 'Consignee Name', required: true, transform: v => v.toUpperCase() },
  { key: 'consigneeAddress', label: 'Address', type: 'textarea', rows: 2, transform: v => v.toUpperCase() },
  { key: 'consigneeCity', label: 'City', transform: v => v.toUpperCase() },
  { key: 'consigneeZipCode', label: 'Postal Code', transform: v => v.toUpperCase() },
  {
    key: 'consigneeCountryCode', label: 'Country', type: 'select',
    placeholder: 'Select country',
    options: countryCodeData.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` })),
  },
  { key: 'consigneePhone', label: 'Phone', type: 'tel' },
  { key: 'consigneeEmail', label: 'Email', type: 'email', transform: v => v.toLowerCase() },
];

const COLUMNS = [
  { label: 'Consignee', key: 'consigneeName' },
  { label: 'City', key: 'consigneeCity' },
  { label: 'Country', key: 'consigneeCountryCode' },
  { label: 'Phone', key: 'consigneePhone' },
  { label: 'Email', key: 'consigneeEmail' },
];

export default function ConsigneesPage() {
  return (
    <Layout>
      <CrudPage
        title="Consignee Management"
        collectionName="consigneeProfiles"
        initialFormData={{ consigneeName: '', consigneeAddress: '', consigneeCity: '', consigneeZipCode: '', consigneeCountryCode: '', consigneePhone: '', consigneeEmail: '' }}
        fields={FIELDS}
        listColumns={COLUMNS}
        searchKeys={['consigneeName', 'consigneeCity', 'consigneeEmail']}
        sortFn={(a, b) => (a.consigneeName || '').localeCompare(b.consigneeName || '')}
      />
    </Layout>
  );
}
