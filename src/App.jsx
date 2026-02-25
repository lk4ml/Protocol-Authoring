import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCDISCData } from './hooks/useCDISCData';
import { transformToUSDM } from './utils/usdmTransformer';
import { generateODMXML } from './utils/odmGenerator';
import { generateUUID } from './utils/uuid';
import sdrService from './services/sdrService';
import { ACTIVITY_CATEGORIES, EPOCH_TYPES, TIMING_TYPES } from './constants/activityCategories';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProtocolModule from './components/modules/ProtocolModule';
import DesignModule from './components/modules/DesignModule';
import SOAModule from './components/modules/SOAModule';
import ActivitiesModule from './components/modules/ActivitiesModule';
import ConceptsModule from './components/modules/ConceptsModule';
import EligibilityModule from './components/modules/EligibilityModule';
import EndpointsModule from './components/modules/EndpointsModule';
import USDMPreviewModule from './components/modules/USDMPreviewModule';
import ExportModule from './components/modules/ExportModule';
import AddVisitModal from './components/modals/AddVisitModal';
import AddActivityModal from './components/modals/AddActivityModal';
import BCBrowserModal from './components/modals/BCBrowserModal';
import VeevaModal from './components/modals/VeevaModal';
import ExportModal from './components/modals/ExportModal';
import ExportStatusToast from './components/ExportStatusToast';

export default function ProtocolIntelligencePlatform() {
  const [activeModule, setActiveModule] = useState('protocol');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [showBCBrowser, setShowBCBrowser] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showVeevaModal, setShowVeevaModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [usdmPreview, setUsdmPreview] = useState(null);
  const [odmPreview, setOdmPreview] = useState(null);
  
  // Fetch CDISC data from API instead of hardcoded
  const cdiscData = useCDISCData();
  
  const [protocol, setProtocol] = useState({
    id: generateUUID(),
    usdmId: null,
    protocolNumber: 'AMG-2025-001',
    fullTitle: 'A Phase III, Randomized, Double-Blind, Placebo-Controlled Study of AMG-XXX in Adult Patients with Metastatic Castration-Resistant Prostate Cancer',
    shortTitle: 'AMG-XXX in mCRPC',
    version: '1.0',
    status: 'Draft',
    phase: 'Phase III',
    studyType: 'Interventional Study',
    interventionModel: 'Parallel',
    blinding: 'Double Blind',
    therapeuticArea: 'Oncology',
    indication: 'Metastatic Castration-Resistant Prostate Cancer',
    sponsorName: 'Amgen Inc.',
    sampleSize: '500',
    arms: [
      { id: 'arm1', name: 'AMG-XXX', description: 'AMG-XXX 400mg Q2W', type: 'Experimental Arm', typeCode: 'C174267' },
      { id: 'arm2', name: 'Placebo', description: 'Matching placebo Q2W', type: 'Placebo Comparator', typeCode: 'C174266' }
    ],
    epochs: [
      { id: 'epoch1', name: 'Screening', type: 'Screening', typeCode: 'SCREENING' },
      { id: 'epoch2', name: 'Treatment', type: 'Treatment', typeCode: 'TREATMENT' },
      { id: 'epoch3', name: 'Follow-up', type: 'Follow-up', typeCode: 'FOLLOW_UP' }
    ],
    visits: [
      { id: 'v1', name: 'Screening', label: 'V1', epochId: 'epoch1', timingType: 'WINDOW', plannedStudyDay: -14, windowLabel: 'Day -28 to -1', windowLower: -28, windowUpper: -1 },
      { id: 'v2', name: 'Baseline/Day 1', label: 'V2', epochId: 'epoch2', timingType: 'FIXED', plannedStudyDay: 1, windowLabel: 'Day 1' },
      { id: 'v3', name: 'Week 2', label: 'V3', epochId: 'epoch2', timingType: 'WINDOW', plannedStudyDay: 15, windowLabel: 'Day 15 ±3', windowLower: 12, windowUpper: 18 },
      { id: 'v4', name: 'Week 4', label: 'V4', epochId: 'epoch2', timingType: 'WINDOW', plannedStudyDay: 29, windowLabel: 'Day 29 ±3', windowLower: 26, windowUpper: 32 },
      { id: 'v5', name: 'Week 8', label: 'V5', epochId: 'epoch2', timingType: 'WINDOW', plannedStudyDay: 57, windowLabel: 'Day 57 ±7', windowLower: 50, windowUpper: 64 },
      { id: 'v6', name: 'End of Treatment', label: 'EOT', epochId: 'epoch3', timingType: 'RELATIVE', plannedStudyDay: null, windowLabel: '≤7 days after last dose' },
      { id: 'v7', name: 'Safety Follow-up', label: 'FU', epochId: 'epoch3', timingType: 'RELATIVE', plannedStudyDay: null, windowLabel: '30 ±7 days after EOT', windowLower: 23, windowUpper: 37 },
    ],
    activities: [
      { id: 'a1', name: 'Informed Consent', category: 'ADMIN', domain: 'DS', formType: 'IC', bcIds: [], visits: ['v1'], visitAssignments: { v1: { mandatory: true } } },
      { id: 'a2', name: 'Eligibility Assessment', category: 'ADMIN', domain: 'IE', formType: 'IE', bcIds: [], visits: ['v1'], visitAssignments: { v1: { mandatory: true } } },
      { id: 'a3', name: 'Demographics', category: 'ADMIN', domain: 'DM', formType: 'DM', bcIds: [], visits: ['v1'], visitAssignments: { v1: { mandatory: true } } },
      { id: 'a4', name: 'Medical History', category: 'ADMIN', domain: 'MH', formType: 'MH', bcIds: [], visits: ['v1'], visitAssignments: { v1: { mandatory: true } } },
      { id: 'a5', name: 'Physical Examination', category: 'CLINICAL', domain: 'PE', formType: 'PE', bcIds: [], visits: ['v1', 'v2', 'v5', 'v6'], visitAssignments: {} },
      { id: 'a6', name: 'Vital Signs', category: 'CLINICAL', domain: 'VS', formType: 'VS', bcIds: [], visits: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'], visitAssignments: {} },
      { id: 'a7', name: 'Height', category: 'CLINICAL', domain: 'VS', formType: 'VS', bcIds: [], visits: ['v1'], visitAssignments: { v1: { mandatory: true } } },
      { id: 'a8', name: 'Weight', category: 'CLINICAL', domain: 'VS', formType: 'VS', bcIds: [], visits: ['v1', 'v2', 'v5', 'v6'], visitAssignments: {} },
      { id: 'a9', name: '12-Lead ECG', category: 'CLINICAL', domain: 'EG', formType: 'EG', bcIds: [], visits: ['v1', 'v2', 'v5', 'v6'], visitAssignments: {} },
      { id: 'a10', name: 'ECOG Performance Status', category: 'CLINICAL', domain: 'QS', formType: 'ECOG', bcIds: [], visits: ['v1', 'v2', 'v4', 'v5', 'v6'], visitAssignments: {} },
      { id: 'a11', name: 'Hematology', category: 'LABORATORY', domain: 'LB', formType: 'LB', bcIds: [], visits: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'], visitAssignments: {} },
      { id: 'a12', name: 'Serum Chemistry', category: 'LABORATORY', domain: 'LB', formType: 'LB', bcIds: [], visits: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'], visitAssignments: {} },
      { id: 'a13', name: 'Tumor Assessment', category: 'EFFICACY', domain: 'TU', formType: 'TU', bcIds: [], visits: ['v1', 'v5', 'v6'], visitAssignments: {} },
      { id: 'a14', name: 'Disease Response', category: 'EFFICACY', domain: 'RS', formType: 'RS', bcIds: [], visits: ['v5', 'v6'], visitAssignments: {} },
      { id: 'a15', name: 'Study Drug Administration', category: 'TREATMENT', domain: 'EX', formType: 'EX', bcIds: [], visits: ['v2', 'v3', 'v4', 'v5'], visitAssignments: {} },
      { id: 'a16', name: 'Adverse Events', category: 'SAFETY', domain: 'AE', formType: 'AE', bcIds: [], visits: ['v2', 'v3', 'v4', 'v5', 'v6', 'v7'], visitAssignments: {} },
      { id: 'a17', name: 'Concomitant Medications', category: 'SAFETY', domain: 'CM', formType: 'CM', bcIds: [], visits: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'], visitAssignments: {} },
    ],
    inclusionCriteria: [
      { id: 'i1', text: 'Male ≥18 years of age at the time of signing the informed consent', category: 'Demographics' },
      { id: 'i2', text: 'Histologically or cytologically confirmed adenocarcinoma of the prostate', category: 'Disease' },
      { id: 'i3', text: 'Documented metastatic disease (M1) based on imaging', category: 'Disease' },
      { id: 'i4', text: 'ECOG performance status of 0 or 1', category: 'Performance' },
      { id: 'i5', text: 'Adequate organ function as defined in protocol', category: 'Laboratory' },
    ],
    exclusionCriteria: [
      { id: 'e1', text: 'Prior treatment with [specific therapy class]', category: 'Prior Treatment' },
      { id: 'e2', text: 'Known brain metastases or active CNS involvement', category: 'Disease' },
      { id: 'e3', text: 'History of another malignancy within 5 years', category: 'Medical History' },
      { id: 'e4', text: 'Significant cardiovascular disease within 6 months', category: 'Medical History' },
    ],
    objectives: [
      { id: 'obj1', text: 'To compare overall survival (OS) between AMG-XXX and placebo', level: 'Primary', levelCode: 'C98772', endpoints: [{ id: 'ep1', text: 'Overall Survival (OS) defined as time from randomization to death', purpose: 'Efficacy' }] },
      { id: 'obj2', text: 'To compare radiographic progression-free survival (rPFS)', level: 'Secondary', levelCode: 'C98773', endpoints: [{ id: 'ep2', text: 'Radiographic progression-free survival per PCWG3', purpose: 'Efficacy' }] }
    ],
  });

  // Update USDM and ODM previews when protocol changes
  useEffect(() => {
    if (!cdiscData.loading) {
      const usdm = transformToUSDM(protocol, cdiscData);
      setUsdmPreview(usdm);
      setOdmPreview(generateODMXML(usdm, protocol));
    }
  }, [protocol, cdiscData]);

  const updateProtocol = useCallback((key, value) => {
    setProtocol(prev => ({ ...prev, [key]: value }));
  }, []);

  const addVisit = useCallback((visit) => {
    setProtocol(prev => ({
      ...prev,
      visits: [...prev.visits, { ...visit, id: generateUUID() }]
    }));
  }, []);

  const addActivity = useCallback((activity) => {
    setProtocol(prev => ({
      ...prev,
      activities: [...prev.activities, {
        ...activity,
        id: generateUUID(),
        visits: [],
        visitAssignments: {}
      }]
    }));
  }, []);

  const toggleActivityVisit = useCallback((activityId, visitId) => {
    setProtocol(prev => {
      const activity = prev.activities.find(a => a.id === activityId);
      if (!activity) return prev;
      let newVisits, newAssignments = { ...activity.visitAssignments };
      if (activity.visits?.includes(visitId)) {
        if (newAssignments[visitId]?.mandatory !== false) {
          newVisits = activity.visits;
          newAssignments[visitId] = { mandatory: false, conditional: true };
        } else {
          newVisits = activity.visits.filter(v => v !== visitId);
          delete newAssignments[visitId];
        }
      } else {
        newVisits = [...(activity.visits || []), visitId];
        newAssignments[visitId] = { mandatory: true };
      }
      return {
        ...prev,
        activities: prev.activities.map(a =>
          a.id === activityId
            ? { ...a, visits: newVisits, visitAssignments: newAssignments }
            : a
        )
      };
    });
  }, []);

  const addBCToActivity = useCallback((activityId, bcId) => {
    setProtocol(prev => ({
      ...prev,
      activities: prev.activities.map(a =>
        a.id === activityId
          ? { ...a, bcIds: [...new Set([...(a.bcIds || []), bcId])] }
          : a
      )
    }));
  }, []);

  const removeBCFromActivity = useCallback((activityId, bcId) => {
    setProtocol(prev => ({
      ...prev,
      activities: prev.activities.map(a =>
        a.id === activityId
          ? { ...a, bcIds: (a.bcIds || []).filter(id => id !== bcId) }
          : a
      )
    }));
  }, []);

  const handleValidate = useCallback(async () => {
    const usdm = transformToUSDM(protocol, cdiscData);
    const results = await sdrService.validateUSDM(usdm);
    setValidationResults(results);
    return results;
  }, [protocol, cdiscData]);

  const handleExport = useCallback(async (format) => {
    setExportStatus('exporting');
    try {
      const usdm = transformToUSDM(protocol, cdiscData);
      if (format === 'usdm') {
        const blob = new Blob([JSON.stringify(usdm, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${protocol.protocolNumber}_USDM_v4.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'odm') {
        const odm = generateODMXML(usdm, protocol);
        const blob = new Blob([odm], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${protocol.protocolNumber}_ODM.xml`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'sdr') {
        const result = await sdrService.createStudy(usdm);
        if (result.id) {
          updateProtocol('usdmId', result.id);
        }
      }
      setExportStatus('success');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus(null), 3000);
    }
  }, [protocol, cdiscData, updateProtocol]);

  const activityCategories = useMemo(() => {
    const cats = {};
    protocol.activities.forEach(a => {
      const cat = a.category || 'OTHER';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(a);
    });
    return cats;
  }, [protocol.activities]);

  const navItems = [
    { id: 'protocol', icon: '📋', label: 'Protocol', badge: null },
    { id: 'design', icon: '🔬', label: 'Study Design', badge: null },
    { id: 'soa', icon: '📅', label: 'Schedule of Activities', badge: protocol.visits.length },
    { id: 'activities', icon: '📝', label: 'Activities & Forms', badge: protocol.activities.length },
    { id: 'concepts', icon: '🧬', label: 'Biomedical Concepts', badge: null },
    { id: 'eligibility', icon: '✅', label: 'Eligibility Criteria', badge: protocol.inclusionCriteria.length + protocol.exclusionCriteria.length },
    { id: 'endpoints', icon: '🎯', label: 'Objectives & Endpoints', badge: protocol.objectives.length },
    { id: 'usdm', icon: '🔄', label: 'USDM Preview', badge: null },
    { id: 'export', icon: '📤', label: 'Export & Publish', badge: null },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        navItems={navItems}
        protocol={protocol}
      />

      <main className="flex-1 flex flex-col min-h-screen">
        <Header
          protocol={protocol}
          onValidate={handleValidate}
          onExport={() => setShowExportModal(true)}
        />

        <div className="flex-1 overflow-y-auto p-6">
          {activeModule === 'protocol' && (
            <ProtocolModule
              protocol={protocol}
              onUpdate={updateProtocol}
              cdiscData={cdiscData}
            />
          )}
          {activeModule === 'design' && (
            <DesignModule
              protocol={protocol}
              onUpdate={updateProtocol}
              cdiscData={cdiscData}
              epochTypes={EPOCH_TYPES}
            />
          )}
          {activeModule === 'soa' && (
            <SOAModule
              protocol={protocol}
              activityCategories={activityCategories}
              activityCategoryConfig={ACTIVITY_CATEGORIES}
              epochTypes={EPOCH_TYPES}
              onToggleActivityVisit={toggleActivityVisit}
              onAddVisit={() => setShowAddVisitModal(true)}
              onSelectActivity={(activity) => {
                setSelectedActivity(activity);
                setShowBCBrowser(true);
              }}
            />
          )}
          {activeModule === 'activities' && (
            <ActivitiesModule
              protocol={protocol}
              activityCategories={activityCategories}
              activityCategoryConfig={ACTIVITY_CATEGORIES}
              cdiscData={cdiscData}
              onAddActivity={() => setShowAddActivityModal(true)}
              onSelectActivity={(activity) => {
                setSelectedActivity(activity);
                setShowBCBrowser(true);
              }}
              onRemoveBC={removeBCFromActivity}
            />
          )}
          {activeModule === 'concepts' && (
            <ConceptsModule cdiscData={cdiscData} />
          )}
          {activeModule === 'eligibility' && (
            <EligibilityModule
              protocol={protocol}
              onUpdate={updateProtocol}
            />
          )}
          {activeModule === 'endpoints' && (
            <EndpointsModule
              protocol={protocol}
              onUpdate={updateProtocol}
            />
          )}
          {activeModule === 'usdm' && (
            <USDMPreviewModule
              usdmPreview={usdmPreview}
              odmPreview={odmPreview}
              validationResults={validationResults}
              onExport={handleExport}
            />
          )}
          {activeModule === 'export' && (
            <ExportModule
              protocol={protocol}
              usdmPreview={usdmPreview}
              onExport={handleExport}
              onVeevaExport={() => setShowVeevaModal(true)}
            />
          )}
        </div>
      </main>

      {showAddVisitModal && (
        <AddVisitModal
          epochs={protocol.epochs}
          timingTypes={TIMING_TYPES}
          onAdd={(visit) => {
            addVisit(visit);
            setShowAddVisitModal(false);
          }}
          onCancel={() => setShowAddVisitModal(false)}
        />
      )}

      {showAddActivityModal && (
        <AddActivityModal
          cdiscData={cdiscData}
          activityCategories={ACTIVITY_CATEGORIES}
          onAdd={(activity) => {
            addActivity(activity);
            setShowAddActivityModal(false);
          }}
          onCancel={() => setShowAddActivityModal(false)}
        />
      )}

      {showBCBrowser && selectedActivity && (
        <BCBrowserModal
          activity={selectedActivity}
          cdiscData={cdiscData}
          onSelectBC={(bcId) => addBCToActivity(selectedActivity.id, bcId)}
          onDeselectBC={(bcId) => removeBCFromActivity(selectedActivity.id, bcId)}
          onClose={() => {
            setShowBCBrowser(false);
            setSelectedActivity(null);
          }}
        />
      )}

      {showVeevaModal && (
        <VeevaModal
          protocol={protocol}
          usdm={usdmPreview}
          onExport={(result) => {
            if (result.success) setExportStatus('success');
            setShowVeevaModal(false);
          }}
          onCancel={() => setShowVeevaModal(false)}
        />
      )}

      {showExportModal && (
        <ExportModal
          onExport={(format) => {
            handleExport(format);
            setShowExportModal(false);
          }}
          onCancel={() => setShowExportModal(false)}
        />
      )}

      {exportStatus && (
        <ExportStatusToast
          status={exportStatus}
          onClose={() => setExportStatus(null)}
        />
      )}
    </div>
  );
}

