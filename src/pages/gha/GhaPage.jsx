import React from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import Layout from '../../components/Layout.jsx';

const FIELDS = [
  { key: 'name', label: 'GHA Name', required: true, transform: v => v.toUpperCase() },
  { key: 'shortName', label: 'Short Name (e.g. PTW)', required: true, transform: v => v.toUpperCase(), maxLength: 3 },
  { key: 'location', label: 'Location (e.g. LIS, OPO)', required: true, transform: v => v.toUpperCase() },
];

const COLUMNS = [
  { label: 'Name', key: 'name' },
  { label: 'Short', key: 'shortName' },
  { label: 'Location', key: 'location' },
];

export default function GhaPage() {
  return (
    <Layout>
      <CrudPage
        title="Ground Handling Agents (GHA)"
        collectionName="ghaProfiles"
        initialFormData={{ name: '', shortName: '', location: '' }}
        fields={FIELDS}
        listColumns={COLUMNS}
        searchKeys={['name', 'shortName', 'location']}
        sortFn={(a, b) => (a.name || '').localeCompare(b.name || '')}
      />
    </Layout>
  );
}
