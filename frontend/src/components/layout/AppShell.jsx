import React, { useEffect, useRef } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import useProtocolStore from '../../store/useProtocolStore';
import useDesignStore from '../../store/useDesignStore';
import useScheduleStore from '../../store/useScheduleStore';
import useTerminologyStore from '../../store/useTerminologyStore';
import useReferenceStore from '../../store/useReferenceStore';
import useAutoSave from '../../hooks/useAutoSave';
import ReferencePanel from '../reference/ReferencePanel';

/**
 * AppShell - Main layout wrapper for the study workspace.
 * Provides sequential sidebar navigation, header bar, and content area.
 * Loads protocol data and terminology on mount.
 */
export default function AppShell() {
  const { id: protocolId } = useParams();
  const loadedRef = useRef(null);
  const panelOpen = useReferenceStore((s) => s.panelOpen);

  const basePath = `/study/${protocolId}`;

  // Auto-save hook watches dirty flags
  useAutoSave(protocolId);

  // Load all data once when protocolId changes.
  useEffect(() => {
    if (!protocolId || loadedRef.current === protocolId) return;
    loadedRef.current = protocolId;

    useProtocolStore.getState().loadProtocol(protocolId);
    useDesignStore.getState().loadDesign(protocolId);
    useScheduleStore.getState().loadSchedule(protocolId);
    useTerminologyStore.getState().loadAll();
    useReferenceStore.getState().loadReferences(protocolId);
  }, [protocolId]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar basePath={basePath} homeUrl="/workspace" />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top header bar */}
        <Header />

        {/* Content + Reference Panel side by side */}
        <div className="flex flex-1 overflow-hidden">
          {/* Scrollable content region */}
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>

          {/* Slide-out reference panel */}
          {panelOpen && <ReferencePanel />}
        </div>
      </div>
    </div>
  );
}
