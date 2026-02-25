import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import ProtocolPicker from './components/ProtocolPicker';
import ProtocolModule from './components/modules/ProtocolModule';
import StudyDesignModule from './components/modules/StudyDesignModule';
import SOAModule from './components/modules/SOAModule';
import EligibilityModule from './components/modules/EligibilityModule';
import EndpointsModule from './components/modules/EndpointsModule';
import ExportModule from './components/modules/ExportModule';

/**
 * Root application component with routing configuration.
 * Uses React Router v6 for client-side navigation.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page - create or select protocol */}
        <Route path="/" element={<ProtocolPicker />} />

        {/* Protocol workspace with nested module routes */}
        <Route path="/protocol/:id" element={<AppShell />}>
          <Route index element={<ProtocolModule />} />
          <Route path="design" element={<StudyDesignModule />} />
          <Route path="soa" element={<SOAModule />} />
          <Route path="eligibility" element={<EligibilityModule />} />
          <Route path="endpoints" element={<EndpointsModule />} />
          <Route path="export" element={<ExportModule />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
