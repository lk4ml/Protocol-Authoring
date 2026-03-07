import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import AppShell from './components/layout/AppShell';
import ProductWorkspace from './components/products/ProductWorkspace';
import ProtocolModule from './components/modules/ProtocolModule';
import StudyDesignModule from './components/modules/StudyDesignModule';
import SOAModule from './components/modules/SOAModule';
import EligibilityModule from './components/modules/EligibilityModule';
import EndpointsModule from './components/modules/EndpointsModule';
import ExportModule from './components/modules/ExportModule';

/**
 * Root application — simplified routing.
 *
 *   /                → Landing page
 *   /workspace       → Study registration / selection
 *   /study/:id/*     → Unified workspace with sequential sidebar
 *
 * Backward compat:
 *   /protocol/:id/*  → redirects to /study/:id/*
 *   /products/*      → redirects to /workspace
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Study picker — register or select a study */}
        <Route path="/workspace" element={<ProductWorkspace />} />

        {/* Unified study workspace — sequential sidebar */}
        <Route path="/study/:id" element={<AppShell />}>
          <Route index element={<ProtocolModule />} />
          <Route path="design" element={<StudyDesignModule />} />
          <Route path="soa" element={<SOAModule />} />
          <Route path="eligibility" element={<EligibilityModule />} />
          <Route path="endpoints" element={<EndpointsModule />} />
          <Route path="export" element={<ExportModule />} />
        </Route>

        {/* Backward compat redirects */}
        <Route path="/protocol/:id/*" element={<RedirectToStudy />} />
        <Route path="/products/*" element={<Navigate to="/workspace" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/** Redirect old /protocol/:id/xxx → /study/:id/xxx */
function RedirectToStudy() {
  const path = window.location.pathname;
  const newPath = path.replace(/^\/protocol\//, '/study/');
  return <Navigate to={newPath} replace />;
}
