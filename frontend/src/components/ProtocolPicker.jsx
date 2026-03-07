import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useProtocolStore from '../store/useProtocolStore';
import useReferenceStore from '../store/useReferenceStore';
import { parseCtGovResponse } from '../utils/parseCtGovTrial';
import * as referencesApi from '../api/references';

/* ─── Workflow definitions — what each Solution leads to ─────────── */
const WORKFLOW_CONFIG = {
  design: {
    route: 'design',
    title: 'Study Designer',
    subtitle: 'Design your trial architecture',
    color: 'brand',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    steps: [
      'Create or select your study below',
      'Define study arms, epochs & elements visually',
      'Import reference designs from ClinicalTrials.gov',
      'Export your USDM v3.0 compliant design',
    ],
  },
  soa: {
    route: 'soa',
    title: 'SOA Builder',
    subtitle: 'Build your Schedule of Activities',
    color: 'purple',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    steps: [
      'Create a new study or select an existing one',
      'Import reference trial procedures from ClinicalTrials.gov',
      'Build activity × visit matrix with CDISC procedures',
      'Review burden analytics & export USDM package',
    ],
  },
  eligibility: {
    route: 'eligibility',
    title: 'Eligibility Optimizer',
    subtitle: 'Craft inclusion & exclusion criteria',
    color: 'emerald',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
      </svg>
    ),
    steps: [
      'Create or select your study below',
      'Import reference trials for I/E criteria suggestions',
      'Craft inclusion & exclusion criteria with AI recommendations',
      'Adopt criteria from comparable trials with one click',
    ],
  },
  burden: {
    route: 'soa',
    title: 'Burden & Complexity Analyst',
    subtitle: 'Analyze patient burden & trial complexity',
    color: 'amber',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    steps: [
      'Create or select your study below',
      'Build your Schedule of Activities first',
      'View real-time burden metrics per visit: time, blood volume, RVU',
      'Compare against benchmarks & optimize',
    ],
  },
};

const BRAND = {
  name: 'ProtoHelix',
  tagline: 'AI-Powered Clinical Protocol Authoring',
  mission: 'Design smarter protocols. Accelerate clinical development.',
  description:
    'ProtoHelix streamlines clinical trial protocol authoring with CDISC standards integration, real-time reference intelligence from ClinicalTrials.gov, and systematic burden analytics — all in one unified platform.',
};

const FEATURES = [
  {
    icon: 'standards',
    title: 'Standards-First Design',
    desc: 'Built on USDM v3.0, ICH M11, and CDISC controlled terminology. Every element maps to industry standards.',
  },
  {
    icon: 'reference',
    title: 'Reference Intelligence',
    desc: 'Import any trial from ClinicalTrials.gov. See how others designed arms, endpoints, and eligibility — then adopt what works.',
  },
  {
    icon: 'burden',
    title: 'Burden Analytics',
    desc: 'Real-time participant burden metrics: time, blood volume, cost, and RVU complexity per visit — powered by CMS & LOINC data.',
  },
  {
    icon: 'export',
    title: 'Export & Interop',
    desc: 'Export to USDM v3.0 JSON or ICH M11 documents. Seamless integration with TransCelerate SDR.',
  },
];

const STANDARDS_LOGOS = [
  'USDM v3.0', 'ICH M11', 'CDISC CT', 'SDTM', 'CDASH', 'COSMoS', 'LOINC', 'CMS RVU',
];

/* ─── Icons ────────────────────────────────────────────────────────── */
function FeatureIcon({ type, className = 'w-6 h-6' }) {
  const map = {
    standards: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    reference: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    burden: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    export: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m0-3l-3-3m0 0l-3 3m3-3v11.25" />
      </svg>
    ),
  };
  return map[type] || null;
}

/* ─── Spinner ──────────────────────────────────────────────────────── */
const Spinner = ({ className = 'h-4 w-4 text-white' }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════ */
export default function ProtocolPicker() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const protocols = useProtocolStore((s) => s.protocols);
  const loadProtocols = useProtocolStore((s) => s.loadProtocols);
  const createProtocol = useProtocolStore((s) => s.createProtocol);

  /* ── Active workflow from Solutions dropdown ─────────────────────── */
  const workflowKey = searchParams.get('workflow');
  const activeWorkflow = workflowKey ? WORKFLOW_CONFIG[workflowKey] : null;

  const clearWorkflow = () => {
    searchParams.delete('workflow');
    setSearchParams(searchParams, { replace: true });
  };

  /* ── Workspace section ref for scrolling ─────────────────────────── */
  const workspaceRef = useRef(null);

  /* ── Form state ──────────────────────────────────────────────────── */
  const [mode, setMode] = useState('new');
  const [studyName, setStudyName] = useState('');
  const [phase, setPhase] = useState('');
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  /* ── NCT Import ──────────────────────────────────────────────────── */
  const [nctId, setNctId] = useState('');
  const [nctLoading, setNctLoading] = useState(false);
  const [nctPreviews, setNctPreviews] = useState([]);
  const [nctError, setNctError] = useState('');

  useEffect(() => { useReferenceStore.getState().reset(); }, []);
  useEffect(() => { loadProtocols(); }, [loadProtocols]);

  /* ── Auto-scroll to workspace when arriving with a workflow ─────── */
  useEffect(() => {
    if (activeWorkflow && workspaceRef.current) {
      const timer = setTimeout(() => {
        workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [activeWorkflow]);

  /* ── Handlers (unchanged logic) ──────────────────────────────────── */
  async function handleQuickCreate(e) {
    e.preventDefault();
    if (!studyName.trim()) { setError('Please enter a study name.'); return; }
    setError('');
    setCreating(true);
    try {
      const newProtocol = await createProtocol({
        protocolNumber: studyName.trim(),
        shortTitle: studyName.trim(),
        fullTitle: '',
        phase,
        therapeuticArea,
        sponsorName: '',
        template: 'blank',
      });
      const pid = newProtocol._id || newProtocol.id;
      navigate(activeWorkflow ? `/protocol/${pid}/${activeWorkflow.route}` : `/protocol/${pid}`);
    } catch (err) {
      setError(err.message || 'Failed to create study.');
    } finally { setCreating(false); }
  }

  async function handleNctFetch() {
    const cleaned = nctId.trim().toUpperCase();
    if (!cleaned) { setNctError('Please enter an NCT ID (e.g., NCT02998528).'); return; }
    if (nctPreviews.some((p) => p.nctId === cleaned)) {
      setNctError(`${cleaned} is already in your reference list.`);
      return;
    }
    setNctError('');
    setNctLoading(true);
    try {
      const json = await referencesApi.fetchStudyFromCtGov(cleaned);
      const parsed = parseCtGovResponse(json, cleaned);
      setNctPreviews((prev) => [...prev, parsed]);
      setNctId('');
    } catch (err) {
      setNctError(err.response?.data?.detail || err.message || 'Failed to fetch trial data.');
    } finally { setNctLoading(false); }
  }

  function handleRemovePreview(nctIdToRemove) {
    setNctPreviews((prev) => prev.filter((p) => p.nctId !== nctIdToRemove));
  }

  async function handleCreateWithReferences() {
    if (nctPreviews.length === 0) return;
    setCreating(true);
    setError('');
    try {
      const first = nctPreviews[0];
      const newProtocol = await createProtocol({
        protocolNumber: studyName.trim() || first.nctId,
        shortTitle: studyName.trim() || first.briefTitle,
        fullTitle: first.officialTitle || '',
        phase: first.phase || '',
        therapeuticArea: first.conditions?.join(', ') || '',
        sponsorName: first.sponsorName || '',
        template: 'blank',
      });
      const protocolId = newProtocol._id || newProtocol.id;
      const refErrors = [];
      for (const trial of nctPreviews) {
        try {
          await referencesApi.addReference(protocolId, trial);
        } catch (refErr) {
          // 409 = duplicate, which is fine
          if (refErr.response?.status !== 409) {
            refErrors.push(trial.nctId || 'unknown');
          }
        }
      }
      if (refErrors.length > 0) {
        console.warn('Failed to save references:', refErrors);
      }
      navigate(activeWorkflow ? `/protocol/${protocolId}/${activeWorkflow.route}` : `/protocol/${protocolId}`);
    } catch (err) {
      setError(err.message || 'Failed to create study.');
    } finally { setCreating(false); }
  }

  function handleOpenProtocol(id) {
    navigate(activeWorkflow ? `/protocol/${id}/${activeWorkflow.route}` : `/protocol/${id}`);
  }

  function scrollToWorkspace() {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function phaseColor(p) {
    if (!p) return 'bg-gray-100 text-gray-600';
    const lc = p.toLowerCase();
    if (lc.includes('1')) return 'bg-blue-100 text-blue-700';
    if (lc.includes('2')) return 'bg-purple-100 text-purple-700';
    if (lc.includes('3')) return 'bg-brand-100 text-brand-700';
    if (lc.includes('4')) return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-600';
  }

  const studyCount = protocols?.length || 0;

  /* ═══════════════════════════════════════════════════════════════════
   *  RENDER
   * ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ╔═══════════════════════════════════════════════════════════════╗
       *  ║  NAVIGATION BAR                                              ║
       *  ╚═══════════════════════════════════════════════════════════════╝ */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-gray-200/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">{BRAND.name}</span>
              <span className="hidden sm:inline text-xs text-gray-400 ml-2 font-medium">Protocol Authoring</span>
            </div>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-3">
            {studyCount > 0 && (
              <button
                onClick={scrollToWorkspace}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                My Studies
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
                  {studyCount}
                </span>
              </button>
            )}
            <button
              onClick={scrollToWorkspace}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition-all shadow-sm shadow-brand-500/20 hover:shadow-md hover:shadow-brand-500/30"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ╔═══════════════════════════════════════════════════════════════╗
       *  ║  WORKFLOW CONTEXT BANNER (when arriving from Solutions)       ║
       *  ╚═══════════════════════════════════════════════════════════════╝ */}
      {activeWorkflow && (
        <section className="pt-20 pb-0 px-6 bg-gradient-to-b from-brand-50/80 to-white">
          <div className="max-w-5xl mx-auto">
            <div className="relative bg-white rounded-2xl border border-brand-200/60 shadow-lg shadow-brand-100/30 overflow-hidden">
              {/* Close / dismiss */}
              <button
                onClick={clearWorkflow}
                className="absolute top-4 right-4 p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-colors z-10"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="p-6 sm:p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-brand-50 text-brand-600">
                    {activeWorkflow.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{activeWorkflow.title}</h2>
                    <p className="text-sm text-gray-500">{activeWorkflow.subtitle}</p>
                  </div>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {activeWorkflow.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0
                          ? 'bg-brand-600 text-white ring-2 ring-brand-200'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {i + 1}
                      </div>
                      <p className={`text-sm leading-snug pt-1 ${i === 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Accent stripe */}
              <div className="h-1 bg-gradient-to-r from-brand-500 via-purple-500 to-brand-400" />
            </div>
          </div>
        </section>
      )}

      {/* ╔═══════════════════════════════════════════════════════════════╗
       *  ║  HERO SECTION                                                ║
       *  ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className={`relative ${activeWorkflow ? 'pt-10 pb-12' : 'pt-32 pb-20'} px-6 overflow-hidden hero-mesh`}>
        {/* Decorative background */}
        <div className="absolute inset-0 hero-gradient-subtle" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-brand-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-10 w-72 h-72 bg-brand-300/15 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="animate-fade-in inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-brand-200/60 shadow-sm mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-gray-600">Open-source · CDISC-native · Standards-compliant</span>
            </div>

            {/* Headline */}
            <h1 className="animate-fade-in-up text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1] text-balance">
              {BRAND.mission.split('.')[0]}.
              <span className="block mt-2 bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                {BRAND.mission.split('.')[1]?.trim() || 'Accelerate clinical development.'}
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="animate-fade-in-up-delay mt-6 text-lg sm:text-xl text-gray-500 leading-relaxed max-w-2xl">
              {BRAND.description}
            </p>

            {/* CTAs */}
            <div className="animate-fade-in-up-delay-2 mt-10 flex flex-wrap items-center gap-4">
              <button
                onClick={scrollToWorkspace}
                className="group px-6 py-3.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 flex items-center gap-2"
              >
                Start Authoring
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Create your first protocol in under 2 minutes
              </div>
            </div>
          </div>

          {/* ── Stats strip ──────────────────────────────────────────── */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl animate-fade-in-up-delay-2">
            {[
              { value: '1,819', label: 'CDISC Activities' },
              { value: '185', label: 'Curated Procedures' },
              { value: '10', label: 'Therapeutic Areas' },
              { value: '42', label: 'LOINC Mappings' },
            ].map((s) => (
              <div key={s.label} className="text-center sm:text-left">
                <div className="text-2xl font-extrabold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ╔═══════════════════════════════════════════════════════════════╗
       *  ║  FEATURES                                                    ║
       *  ╚═══════════════════════════════════════════════════════════════╝ */}
      <section className="py-20 px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Everything you need to author world-class protocols
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              From study design to export — one integrated platform backed by real clinical data standards.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-brand-200 hover:shadow-lg hover:shadow-brand-50 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 group-hover:bg-brand-600 group-hover:text-white transition-all duration-300">
                  <FeatureIcon type={f.icon} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Standards ribbon */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Powered by</span>
            {STANDARDS_LOGOS.map((s) => (
              <span key={s} className="px-3 py-1.5 rounded-full text-xs font-semibold text-gray-500 bg-gray-100/80 border border-gray-100">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ╔═══════════════════════════════════════════════════════════════╗
       *  ║  WORKSPACE — Create / Your Studies                           ║
       *  ╚═══════════════════════════════════════════════════════════════╝ */}
      <section ref={workspaceRef} className="py-20 px-6 bg-gray-50/80 border-t border-gray-100 scroll-mt-16">
        <div className="max-w-5xl mx-auto space-y-12">

          {/* ── Section Header ────────────────────────────────────────── */}
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Your Protocol Workspace
            </h2>
            <p className="mt-2 text-gray-500">
              Create a new study from scratch or import reference trials from ClinicalTrials.gov.
            </p>
          </div>

          {/* ── Create Card ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
            {/* Mode tabs */}
            <div className="flex border-b border-gray-100">
              {[
                { key: 'new', label: 'New Study', icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                )},
                { key: 'nct', label: 'Import from ClinicalTrials.gov', icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                )},
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setMode(tab.key); setNctError(''); setError(''); }}
                  className={`flex-1 px-6 py-4 text-sm font-semibold transition-all relative flex items-center justify-center gap-2 ${
                    mode === tab.key
                      ? 'text-brand-700 bg-brand-50/40'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {mode === tab.key && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-6 sm:p-8">
              {/* ── NEW STUDY ─────────────────────────────────────── */}
              {mode === 'new' && (
                <form onSubmit={handleQuickCreate} className="space-y-5">
                  {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Study Name / Protocol Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={studyName}
                      onChange={(e) => setStudyName(e.target.value)}
                      placeholder="e.g., BEACON-3 or ONCO-2025-001"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow placeholder:text-gray-300 bg-gray-50/50 focus:bg-white"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Phase</label>
                      <select
                        value={phase}
                        onChange={(e) => setPhase(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-gray-50/50 focus:bg-white"
                      >
                        <option value="">Select phase...</option>
                        <option value="Phase 1">Phase 1</option>
                        <option value="Phase 1/Phase 2">Phase 1/2</option>
                        <option value="Phase 2">Phase 2</option>
                        <option value="Phase 2/Phase 3">Phase 2/3</option>
                        <option value="Phase 3">Phase 3</option>
                        <option value="Phase 4">Phase 4</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Therapeutic Area</label>
                      <input
                        type="text"
                        value={therapeuticArea}
                        onChange={(e) => setTherapeuticArea(e.target.value)}
                        placeholder="e.g., Oncology"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow placeholder:text-gray-300 bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full sm:w-auto px-8 py-3 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-brand-500/20 hover:shadow-md flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <><Spinner className="h-4 w-4 text-white" /> Creating…</>
                    ) : (
                      <>
                        Create & Open
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ── NCT IMPORT ────────────────────────────────────── */}
              {mode === 'nct' && (
                <div className="space-y-5">
                  {(nctError || error) && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      {nctError || error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fetch Reference Trials
                    </label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={nctId}
                          onChange={(e) => setNctId(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleNctFetch()}
                          placeholder="Enter NCT ID, e.g. NCT02998528"
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow placeholder:text-gray-300 bg-gray-50/50 focus:bg-white"
                        />
                        <svg className="w-4 h-4 text-gray-300 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                      </div>
                      <button
                        type="button"
                        onClick={handleNctFetch}
                        disabled={nctLoading}
                        className="px-6 py-3 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-all shadow-sm shadow-brand-500/20 min-w-[100px] flex items-center justify-center"
                      >
                        {nctLoading ? <Spinner /> : 'Fetch'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="text-xs text-gray-400">Try examples:</span>
                      {['NCT02998528', 'NCT03521154', 'NCT05060016'].map((id) => (
                        <button
                          key={id}
                          onClick={() => setNctId(id)}
                          className="text-xs text-brand-500 hover:text-brand-700 font-medium hover:underline transition-colors px-2 py-0.5 rounded-md hover:bg-brand-50"
                        >
                          {id}
                        </button>
                      ))}
                      {nctPreviews.length > 0 && (
                        <span className="ml-auto text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          {nctPreviews.length} trial{nctPreviews.length > 1 ? 's' : ''} loaded
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Protocol name override */}
                  {nctPreviews.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Your Protocol Name <span className="text-gray-300 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={studyName}
                        onChange={(e) => setStudyName(e.target.value)}
                        placeholder={nctPreviews[0]?.nctId || 'Leave blank to use NCT ID'}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow placeholder:text-gray-300 bg-gray-50/50 focus:bg-white"
                      />
                    </div>
                  )}

                  {/* Preview cards */}
                  {nctPreviews.length > 0 && (
                    <div className="space-y-3">
                      {nctPreviews.map((trial) => (
                        <div key={trial.nctId} className="rounded-xl border border-gray-200 bg-gray-50/60 overflow-hidden hover:border-brand-200 transition-colors">
                          <div className="px-5 py-4 flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-mono font-bold text-brand-600">{trial.nctId}</span>
                                {trial.sponsorName && (
                                  <span className="text-xs text-gray-400">· {trial.sponsorName}</span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
                                {trial.briefTitle}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {trial.phase && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[11px] font-semibold">{trial.phase}</span>
                                )}
                                {trial.designInfo?.interventionModel && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-medium">{trial.designInfo.interventionModel}</span>
                                )}
                                {trial.designInfo?.masking && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium">{trial.designInfo.masking}</span>
                                )}
                                {trial.enrollment && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">n={trial.enrollment}</span>
                                )}
                                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-medium">
                                  {trial.arms?.length || 0} arms
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[11px] font-medium">
                                  {(trial.outcomes?.primary?.length || 0) + (trial.outcomes?.secondary?.length || 0)} endpoints
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemovePreview(trial.nctId)}
                              className="shrink-0 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* 3-column preview */}
                          <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-white/60">
                            {[
                              { label: 'Arms', items: trial.arms?.map(a => a.label) },
                              { label: 'Interventions', items: trial.interventions?.map(i => i.name) },
                              { label: 'Primary Endpoints', items: trial.outcomes?.primary?.map(o => o.measure) },
                            ].map((col) => (
                              <div key={col.label} className="px-4 py-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{col.label}</p>
                                {col.items?.slice(0, 3).map((item, i) => (
                                  <p key={i} className="text-xs text-gray-600 truncate">{item}</p>
                                ))}
                                {(col.items?.length || 0) > 3 && (
                                  <p className="text-[10px] text-gray-400">+{col.items.length - 3} more</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={handleCreateWithReferences}
                        disabled={creating}
                        className="w-full px-6 py-3.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-brand-500/20 hover:shadow-md flex items-center justify-center gap-2"
                      >
                        {creating ? (
                          <><Spinner className="h-4 w-4 text-white" /> Creating…</>
                        ) : (
                          <>
                            Create Protocol with {nctPreviews.length} Reference{nctPreviews.length > 1 ? 's' : ''}
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Empty state */}
                  {nctPreviews.length === 0 && !nctLoading && (
                    <div className="text-center py-10">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 font-medium">
                        Import trials from ClinicalTrials.gov as references
                      </p>
                      <p className="text-xs text-gray-400 mt-1.5 max-w-md mx-auto">
                        See how other sponsors designed their arms, endpoints, eligibility criteria, and more. Use them as a starting point for your own protocol.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
           *  YOUR STUDIES
           * ══════════════════════════════════════════════════════════ */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">
                  {activeWorkflow ? `Select a Study → ${activeWorkflow.title}` : 'Your Studies'}
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  {activeWorkflow && studyCount > 0
                    ? `Click any study to open it in ${activeWorkflow.title}`
                    : studyCount > 0
                    ? `${studyCount} ${studyCount === 1 ? 'study' : 'studies'} saved`
                    : 'No studies yet — create your first one above'}
                </p>
              </div>
            </div>

            {studyCount > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {protocols.map((p) => {
                  const id = p._id || p.id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleOpenProtocol(id)}
                      className="group text-left bg-white rounded-2xl border border-gray-200/80 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-50 transition-all duration-300 overflow-hidden"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all duration-300">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          </div>
                          <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                          </svg>
                        </div>

                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-brand-700 transition-colors truncate">
                          {p.protocolNumber || 'Untitled Study'}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 min-h-[32px] leading-relaxed">
                          {p.shortTitle || p.fullTitle || 'No title provided'}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {p.phase && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${phaseColor(p.phase)}`}>
                              {p.phase}
                            </span>
                          )}
                          {p.therapeuticArea && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                              {p.therapeuticArea}
                            </span>
                          )}
                        </div>

                        {p.sponsorName && (
                          <p className="text-[11px] text-gray-400 mt-3 truncate">{p.sponsorName}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200/80 border-dashed p-16 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-500">No studies yet</p>
                <p className="text-xs text-gray-400 mt-1.5">Create your first study above to get started.</p>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ╔═══════════════════════════════════════════════════════════════╗
       *  ║  FOOTER                                                      ║
       *  ╚═══════════════════════════════════════════════════════════════╝ */}
      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold text-gray-900">{BRAND.name}</span>
                <p className="text-[11px] text-gray-400">USDM v3.0 · ICH M11 · CDISC Standards Compliant</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-400">
              <span>CDISC COSMoS</span>
              <span>·</span>
              <span>CMS PFS 2025</span>
              <span>·</span>
              <span>LOINC v2.77</span>
              <span>·</span>
              <span>NCI Thesaurus</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
