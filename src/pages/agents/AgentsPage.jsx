import React from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import { countryCodeData } from '../../data/countries.js';
import Layout from '../../components/Layout.jsx';

const FIELDS = [
  { key: 'agentName', label: 'Agent Name', required: true, transform: v => v.toUpperCase() },
  { key: 'agentId', label: 'Agent ID (unique)', required: true, transform: v => v.toUpperCase(), editDisabled: true },
  { key: 'agentAddress', label: 'Address', type: 'textarea', rows: 2, transform: v => v.toUpperCase() },
  { key: 'agentCity', label: 'City', transform: v => v.toUpperCase() },
  {
    key: 'agentCountryCode', label: 'Country', type: 'select',
    placeholder: 'Select country',
    options: countryCodeData.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` })),
  },
  { key: 'agentPhone', label: 'Phone', type: 'tel' },
  { key: 'agentEmail', label: 'Email', type: 'email', transform: v => v.toLowerCase() },
  { key: 'agentIataCassNumber', label: 'IATA CASS (e.g. 1234567/0000)', transform: v => v.toUpperCase() },
];

const COLUMNS = [
  { label: 'Agent', key: 'agentName' },
  { label: 'Agent ID', key: 'agentId' },
  { label: 'City', key: 'agentCity' },
  { label: 'Country', key: 'agentCountryCode' },
  { label: 'Email', key: 'agentEmail' },
  { label: 'IATA CASS', key: 'agentIataCassNumber' },
];

export default function AgentsPage() {
  return (
    <Layout>
      <CrudPage
        title="Agent Management"
        collectionName="agentProfiles"
        initialFormData={{ agentName: '', agentId: '', agentAddress: '', agentCity: '', agentCountryCode: '', agentPhone: '', agentEmail: '', agentIataCassNumber: '' }}
        fields={FIELDS}
        listColumns={COLUMNS}
        searchKeys={['agentName', 'agentId', 'agentIataCassNumber', 'agentCity']}
        uniqueKey="agentId"
        sortFn={(a, b) => (a.agentName || '').localeCompare(b.agentName || '')}
      />
    </Layout>
  );
}
