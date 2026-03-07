import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════════════
 *  ProtoHelix Landing Page
 *  Inspired by ProtocolFlow's clean, light SaaS aesthetic
 * ═══════════════════════════════════════════════════════════════════════ */

/* ─── Product feature data for interactive showcase ─────────────────── */
const PRODUCTS = [
  {
    id: 'designer',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    title: 'Study Designer',
    desc: 'Architect complex clinical trials with intuitive visual workflows.',
    demo: {
      heading: 'Trial Architecture: Phase III Oncology',
      cohorts: [
        { name: 'Arm A: Standard of Care', status: 'ACTIVE', enrollment: 70 },
        { name: 'Arm B: Investigational', status: 'ACTIVE', enrollment: 55 },
        { name: 'Arm C: Combination', status: 'ACTIVE', enrollment: 40 },
      ],
    },
  },
  {
    id: 'soa',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: 'SOA Builder',
    desc: 'Build Schedule of Activities with real-time burden analytics and CDISC mapping.',
    demo: {
      heading: 'Schedule of Activities: Visits & Procedures',
      visits: ['Screening', 'Baseline', 'Week 4', 'Week 8', 'Week 12', 'EoT'],
      procedures: [
        { name: 'Informed Consent', checks: [true, false, false, false, false, false] },
        { name: 'Vital Signs', checks: [true, true, true, true, true, true] },
        { name: 'Blood Draw (PK)', checks: [false, true, true, true, true, false] },
        { name: 'ECG', checks: [true, true, false, true, false, true] },
        { name: 'Tumor Assessment', checks: [true, false, false, true, false, true] },
      ],
    },
  },
  {
    id: 'eligibility',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
      </svg>
    ),
    title: 'Eligibility Optimizer',
    desc: 'Craft precise inclusion/exclusion criteria with AI-powered suggestions from comparable trials.',
    demo: {
      heading: 'Eligibility Criteria Builder',
      criteria: [
        { type: 'inclusion', text: 'Age >= 18 years at time of informed consent', source: 'Standard' },
        { type: 'inclusion', text: 'Histologically confirmed advanced solid tumor', source: 'NCCN' },
        { type: 'inclusion', text: 'ECOG performance status 0-1', source: 'Referenced' },
        { type: 'exclusion', text: 'Prior treatment with anti-PD-1/PD-L1 therapy', source: 'Protocol' },
        { type: 'exclusion', text: 'Active autoimmune disease requiring systemic treatment', source: 'Standard' },
      ],
    },
  },
  {
    id: 'analytics',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Complexity & Burden Analyst',
    desc: 'Quantify patient burden with CMS RVU, LOINC, and time-motion analysis per visit.',
    demo: {
      heading: 'Burden Analysis Dashboard',
      metrics: [
        { label: 'Total Blood Volume', value: '285 mL', trend: '-12%', good: true },
        { label: 'Avg Visit Duration', value: '3.2 hrs', trend: '-8%', good: true },
        { label: 'RVU Complexity', value: '47.3', trend: '+2%', good: false },
        { label: 'Patient Burden Score', value: '6.8/10', trend: '-15%', good: true },
      ],
    },
  },
];

const STATS = [
  { value: '40%', label: 'Faster Protocol Design' },
  { value: '26K+', label: 'CDISC Terms Mapped' },
  { value: '1,100+', label: 'Biomedical Concepts' },
  { value: 'v3.0', label: 'USDM Compliant' },
];


/* ═══════════════════════════════════════════════════════════════════════
 *  SUB-COMPONENTS
 * ═══════════════════════════════════════════════════════════════════════ */

/* ─── Helix Icon (reusable DNA double-helix SVG) ─────────────────── */
function HelixIcon({ size = 20, className = 'text-white' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      {/* Left strand */}
      <path d="M7 2 C7 6.5, 17 8.5, 17 12 C17 15.5, 7 17.5, 7 22" />
      {/* Right strand */}
      <path d="M17 2 C17 6.5, 7 8.5, 7 12 C7 15.5, 17 17.5, 17 22" />
      {/* Rungs */}
      <line x1="9" y1="5.5" x2="15" y2="5.5" strokeOpacity="0.5" />
      <line x1="7.8" y1="9" x2="16.2" y2="9" strokeOpacity="0.5" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" strokeOpacity="0.5" />
      <line x1="7.8" y1="15" x2="16.2" y2="15" strokeOpacity="0.5" />
      <line x1="9" y1="18.5" x2="15" y2="18.5" strokeOpacity="0.5" />
    </svg>
  );
}

/* ─── ProtoHelix Logo ────────────────────────────────────────────── */
function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="w-9 h-9 rounded-xl bg-brand-950 flex items-center justify-center">
        <HelixIcon size={20} />
      </div>
      <span className="text-xl font-bold tracking-tight text-gray-900">ProtoHelix</span>
    </div>
  );
}

/* ─── Solutions dropdown items — all navigate to /workspace ────────── */
import { SOLUTIONS } from '../config/productRegistry';

const SOLUTIONS_MENU = SOLUTIONS.map((p, idx) => ({
  idx,
  key: p.key,
  title: p.title,
  desc: p.desc,
  icon: p.icon,
}));

/* ─── Navigation ──────────────────────────────────────────────────── */
function Navbar({ onGetStarted, onSelectProduct }) {
  const [scrolled, setScrolled] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    if (!solutionsOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSolutionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [solutionsOpen]);

  /* Hover intent: open on enter, delayed close on leave */
  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setSolutionsOpen(true);
  };
  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setSolutionsOpen(false), 300);
  };

  const handleProductClick = (item) => {
    setSolutionsOpen(false);
    onSelectProduct(item);
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-8">
          <a href="#platform" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Platform</a>

          {/* ── Solutions dropdown ── */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
              onClick={() => setSolutionsOpen((v) => !v)}
            >
              Solutions
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${solutionsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Dropdown panel */}
            <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 transition-all duration-200 ${
              solutionsOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
            }`}>
              <div className="w-[340px] bg-white rounded-2xl shadow-xl border border-gray-200/80 ring-1 ring-black/5 p-2 backdrop-blur-xl">
                {SOLUTIONS_MENU.map((item) => (
                  <button
                    key={item.idx}
                    onClick={() => handleProductClick(item)}
                    className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50/60 transition-colors text-left group"
                  >
                    <div className="p-2 rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 transition-colors flex-shrink-0 mt-0.5">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</div>
                    </div>
                  </button>
                ))}

                {/* View all link */}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <a
                    href="#platform"
                    onClick={() => setSolutionsOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-brand-600 hover:bg-brand-50/60 transition-colors"
                  >
                    View all solutions
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <a href="#stats" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Standards</a>
          <a href="#trust" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Resources</a>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
          <button
            onClick={onGetStarted}
            className="px-5 py-2 bg-brand-950 text-white text-sm font-semibold rounded-full hover:bg-brand-900 transition-all duration-200 shadow-lg shadow-brand-950/20"
          >
            Book a Demo
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero Section ────────────────────────────────────────────────── */
function HeroSection({ onGetStarted, onWatchTour }) {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden landing-hero-bg">
      {/* Soft gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-200/40 to-purple-200/30 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-pink-100/30 to-blue-100/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-indigo-100/20 to-cyan-100/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24">
        {/* Pill badge */}
        <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 backdrop-blur-sm border border-gray-200/60 mb-8">
          <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">The Future of Clinical Authoring</span>
        </div>

        {/* Main heading */}
        <h1 className="animate-fade-in-up text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.08] mb-6">
          Author Protocols with{' '}
          <span className="landing-gradient-text">Clinical Intelligence.</span>
        </h1>

        {/* Subtitle */}
        <p className="animate-fade-in-up-delay text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10">
          ProtoHelix integrates design, feasibility, and authoring into a single
          intelligent ecosystem. Reduce cycle times by 40% and eliminate protocol amendments.
        </p>

        {/* CTA buttons */}
        <div className="animate-fade-in-up-delay-2 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onGetStarted}
            className="px-8 py-3.5 bg-brand-950 text-white font-semibold rounded-2xl hover:bg-brand-900 transition-all duration-200 shadow-xl shadow-brand-950/25 text-base"
          >
            Get Started Free
          </button>
          <button
            onClick={onWatchTour}
            className="group px-8 py-3.5 bg-white text-gray-800 font-semibold rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200 text-base flex items-center gap-2"
          >
            Watch Platform Tour
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}

/* ─── Stats Bar ──────────────────────────────────────────────────── */
function StatsBar() {
  return (
    <section id="stats" className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {STATS.map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-3xl sm:text-4xl font-extrabold text-brand-600 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Interactive Product Showcase ─────────────────────────────────── */
function ProductShowcase({ activeProduct, setActiveProduct }) {
  return (
    <section id="platform" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">The Intelligent Suite</h2>
        <p className="text-gray-500 text-lg mb-12">
          Select a product to explore its core capabilities and interactive features.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Product list */}
          <div className="lg:col-span-4 space-y-2">
            {PRODUCTS.map((product, i) => (
              <button
                key={product.id}
                onClick={() => setActiveProduct(i)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                  activeProduct === i
                    ? 'bg-white border-gray-200 shadow-md ring-1 ring-brand-100'
                    : 'bg-transparent border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                    activeProduct === i
                      ? 'bg-brand-50 text-brand-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {product.icon}
                  </div>
                  <div>
                    <div className={`font-semibold ${
                      activeProduct === i ? 'text-gray-900' : 'text-gray-600'
                    }`}>{product.title}</div>
                    {activeProduct === i && (
                      <p className="text-sm text-gray-500 mt-1 animate-fade-in">{product.desc}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right: Interactive demo card */}
          <div className="lg:col-span-8">
            <ProductDemoCard product={PRODUCTS[activeProduct]} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Product Demo Card ──────────────────────────────────────────── */
function ProductDemoCard({ product }) {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden animate-fade-in">
      {/* Browser chrome */}
      <div className="bg-white px-5 py-3 border-b border-gray-100 flex items-center gap-4">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {/* Demo badge + title */}
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs font-bold text-white bg-brand-500 px-3 py-1 rounded-md uppercase tracking-wider">Interactive Demo</span>
          <h3 className="text-xl font-bold text-gray-900">{product.title}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6">{product.desc}</p>

        {/* Demo content per product type */}
        {product.id === 'designer' && <DesignerDemo demo={product.demo} />}
        {product.id === 'soa' && <SOADemo demo={product.demo} />}
        {product.id === 'eligibility' && <EligibilityDemo demo={product.demo} />}
        {product.id === 'analytics' && <AnalyticsDemo demo={product.demo} />}
      </div>
    </div>
  );
}

/* ─── Designer Demo ──────────────────────────────────────────────── */
function DesignerDemo({ demo }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-800">{demo.heading}</h4>
        <button className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Cohort
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {demo.cohorts.map((cohort, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase">Cohort {i + 1}</span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{cohort.status}</span>
            </div>
            <div className="font-semibold text-gray-900 text-sm mb-4">{cohort.name}</div>
            <div className="relative">
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${cohort.enrollment}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-400">Enrollment</span>
                <span className="text-xs font-semibold text-gray-600">{cohort.enrollment}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Drag area */}
      <div className="mt-4 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
        <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
        </svg>
        <p className="text-sm text-brand-400">Drag and drop procedures to build your workflow</p>
      </div>
    </div>
  );
}

/* ─── SOA Demo ───────────────────────────────────────────────────── */
function SOADemo({ demo }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-800 mb-4">{demo.heading}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-semibold text-gray-600 w-48">Procedure</th>
              {demo.visits.map((v, i) => (
                <th key={i} className="text-center py-2 px-2 font-semibold text-gray-600 text-xs">{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demo.procedures.map((proc, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="py-2.5 px-3 text-gray-700 font-medium">{proc.name}</td>
                {proc.checks.map((checked, j) => (
                  <td key={j} className="text-center py-2.5">
                    {checked ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-50 text-brand-600">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-gray-300">
                        &mdash;
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Eligibility Demo ───────────────────────────────────────────── */
function EligibilityDemo({ demo }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-800 mb-4">{demo.heading}</h4>
      <div className="space-y-2">
        {demo.criteria.map((c, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
            c.type === 'inclusion'
              ? 'bg-green-50/50 border-green-100'
              : 'bg-red-50/50 border-red-100'
          }`}>
            <span className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
              c.type === 'inclusion' ? 'bg-green-500' : 'bg-red-400'
            }`}>
              {c.type === 'inclusion' ? '+' : '-'}
            </span>
            <div className="flex-1">
              <p className="text-sm text-gray-700">{c.text}</p>
            </div>
            <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200 flex-shrink-0">{c.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Analytics Demo ─────────────────────────────────────────────── */
function AnalyticsDemo({ demo }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-800 mb-4">{demo.heading}</h4>
      <div className="grid grid-cols-2 gap-4">
        {demo.metrics.map((m, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-400 font-medium mb-2">{m.label}</div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{m.value}</div>
            <div className={`text-sm font-semibold ${m.good ? 'text-green-500' : 'text-amber-500'}`}>
              {m.trend} vs benchmark
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Features Grid ──────────────────────────────────────────────── */
function FeaturesSection() {
  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
      title: 'USDM v3.0 Native',
      desc: 'Every entity maps to the Unified Study Definitions Model. Export a fully compliant JSON package in one click.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      ),
      title: 'Neo4j Knowledge Graph',
      desc: 'Your protocol lives as a fully connected graph — 22 node types, 32 relationships. Query any path, any direction.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      title: 'Reference Intelligence',
      desc: 'Import any NCT trial from ClinicalTrials.gov. Compare arms, endpoints, and eligibility side-by-side.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
        </svg>
      ),
      title: 'Version Control',
      desc: 'Root-Value versioning on every entity. Finalize, branch, rollback — full audit trail on every change.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      ),
      title: 'AI-Powered Authoring',
      desc: 'Indication-aware protocol generation. ProtoHelix knows oncology from cardiology and adapts the SOA accordingly.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      ),
      title: 'CDISC Terminology',
      desc: '26,000+ controlled terms, 1,100+ biomedical concepts, 63 SDTM domains — all loaded and queryable.',
    },
  ];

  return (
    <section id="features" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-widest text-brand-600 uppercase">Why ProtoHelix</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3 mb-4">
            Everything you need. Nothing you don't.
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Purpose-built for clinical development teams who demand standards compliance, speed, and transparency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:border-brand-100 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ─── CTA Section ────────────────────────────────────────────────── */
function CTASection({ onGetStarted }) {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          Ready to transform protocol authoring?
        </h2>
        <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto">
          Join the next generation of clinical teams designing better trials, faster.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onGetStarted}
            className="px-8 py-3.5 bg-brand-950 text-white font-semibold rounded-2xl hover:bg-brand-900 transition-all duration-200 shadow-xl shadow-brand-950/25 text-base"
          >
            Start Building Today
          </button>
          <button className="px-8 py-3.5 text-gray-600 font-semibold rounded-2xl hover:text-gray-900 transition-colors text-base flex items-center gap-2">
            View Documentation
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-brand-950 text-white py-16">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <HelixIcon size={16} />
            </div>
            <span className="text-lg font-bold">ProtoHelix</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Empowering clinical teams to design better trials, faster. Built for the next generation of life sciences.
          </p>
        </div>

        {/* Product links */}
        <div>
          <h4 className="font-semibold text-white mb-4">Product</h4>
          <ul className="space-y-3 text-sm text-gray-400">
            <li><a href="#platform" className="hover:text-white transition-colors">Platform Overview</a></li>
            <li><a href="#platform" className="hover:text-white transition-colors">Study Designer</a></li>
            <li><a href="#platform" className="hover:text-white transition-colors">SOA Builder</a></li>
            <li><a href="#platform" className="hover:text-white transition-colors">AI Authoring</a></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="font-semibold text-white mb-4">Company</h4>
          <ul className="space-y-3 text-sm text-gray-400">
            <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h4 className="font-semibold text-white mb-4">Stay Updated</h4>
          <p className="text-sm text-gray-400 mb-4">
            Join our newsletter for the latest in clinical trial innovation.
          </p>
          <div className="flex">
            <input
              type="email"
              placeholder="Email address"
              className="flex-1 px-4 py-2.5 bg-white/10 border border-white/10 rounded-l-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-400"
            />
            <button className="px-5 py-2.5 bg-white text-brand-950 font-semibold text-sm rounded-r-xl hover:bg-gray-100 transition-colors">
              Join
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-gray-500">&copy; 2026 ProtoHelix. All rights reserved.</p>
        <div className="flex gap-6 text-xs text-gray-500">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 *  MAIN LANDING PAGE
 * ═══════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const [activeProduct, setActiveProduct] = useState(0);

  const handleGetStarted = () => {
    navigate('/workspace');
  };

  const handleWatchTour = () => {
    const el = document.getElementById('platform');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  /* Called from Navbar Solutions dropdown — go to workspace */
  const handleSelectProduct = () => {
    navigate('/workspace');
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar onGetStarted={handleGetStarted} onSelectProduct={handleSelectProduct} />
      <HeroSection onGetStarted={handleGetStarted} onWatchTour={handleWatchTour} />
      <StatsBar />
      <ProductShowcase activeProduct={activeProduct} setActiveProduct={setActiveProduct} />
      <FeaturesSection />
      <CTASection onGetStarted={handleGetStarted} />
      <Footer />
    </div>
  );
}
