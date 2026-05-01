import React from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import Layout from '../../components/Layout.jsx';

const FIELDS = [
  { key: 'airlineCode', label: 'Airline', transform: v => v.toUpperCase(), maxLength: 3, placeholder: 'IB, TP, AV…' },
  { key: 'origin', label: 'Origin', required: true, transform: v => v.toUpperCase(), maxLength: 3 },
  { key: 'dest', label: 'Destination', required: true, transform: v => v.toUpperCase(), maxLength: 3 },
  { key: 'currency', label: 'Currency', required: true, transform: v => v.toUpperCase(), maxLength: 3, placeholder: 'EUR' },
  { key: 'minCharge', label: 'Minimum Charge', type: 'number', step: '0.01', required: true },
  { key: 'srN', label: 'Normal Rate (<100kg)', type: 'number', step: '0.01', required: true },
  { key: 'srQ100', label: 'Rate >100kg', type: 'number', step: '0.01' },
  { key: 'srQ300', label: 'Rate >300kg', type: 'number', step: '0.01' },
  { key: 'srQ500', label: 'Rate >500kg', type: 'number', step: '0.01' },
  { key: 'srQ1000', label: 'Rate >1000kg', type: 'number', step: '0.01' },
  { key: 'srQ3000', label: 'Rate >3000kg', type: 'number', step: '0.01' },
  { key: 'remarks', label: 'Remarks' },
];

const COLUMNS = [
  { label: 'Airline', render: item => item.airlineCode || '—' },
  { label: 'Route', render: item => `${item.origin || ''}→${item.dest || ''}` },
  { label: 'Currency', key: 'currency' },
  { label: 'Min', key: 'minCharge' },
  { label: 'Normal', key: 'srN' },
  { label: '+100', key: 'srQ100' },
  { label: '+300', key: 'srQ300' },
  { label: '+500', key: 'srQ500' },
  { label: 'Remarks', key: 'remarks' },
];

export default function RatesPage() {
  return (
    <Layout>
      <CrudPage
        title="Rate Table"
        collectionName="rateTableEntries"
        initialFormData={{ airlineCode: '', origin: '', dest: '', currency: 'EUR', minCharge: '', srN: '', srQ100: '', srQ300: '', srQ500: '', srQ1000: '', srQ3000: '', remarks: '' }}
        fields={FIELDS}
        listColumns={COLUMNS}
        searchKeys={['airlineCode', 'origin', 'dest', 'remarks']}
        sortFn={(a, b) => {
          const ra = `${a.airlineCode || ''}${a.origin}${a.dest}`;
          const rb = `${b.airlineCode || ''}${b.origin}${b.dest}`;
          return ra.localeCompare(rb);
        }}
      />
    </Layout>
  );
}
