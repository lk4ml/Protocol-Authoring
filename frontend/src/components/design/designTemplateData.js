/**
 * designTemplateData.js
 *
 * Pre-built trial design configurations for common clinical trial types.
 * Each template provides arms, epochs, elements, and cell assignments that
 * can be loaded into useDesignStore via loadTemplate().
 *
 * Templates use placeholder IDs (t-arm-1, t-epoch-1, etc.) which are replaced
 * with real UUIDs when loaded into the store.
 *
 * CDISC C-codes:
 *   Epoch types: C98779=Screening, C101527=Run-in, C101526=Treatment, C99158=Follow-up, C99156=Washout
 *   Arm types:  C174267=Experimental, C174266=Placebo Comparator, C174265=Active Comparator,
 *               C174268=No Intervention, C174269=Sham Comparator
 */

// ---------------------------------------------------------------------------
// Template 1: Parallel 2-Arm
// ---------------------------------------------------------------------------
const PARALLEL_2ARM = {
  meta: {
    id: 'parallel-2arm',
    name: 'Parallel (2-Arm)',
    description: 'Standard 2-arm randomized controlled trial. One experimental arm and one placebo/control arm running through the same epochs.',
    icon: '⚖️',
    tags: ['parallel', 'rct', 'phase-2', 'phase-3'],
  },
  interventionModel: 'Parallel',
  blindingSchema: 'Double Blind',
  arms: [
    { id: 't-arm-1', name: 'Treatment', type: 'Experimental Arm', order: 1 },
    { id: 't-arm-2', name: 'Placebo', type: 'Placebo Comparator Arm', order: 2 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'Treatment', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'Follow-up', type: 'Follow-up', order: 3 },
  ],
  elements: [
    { id: 't-el-1', name: 'Drug A', color: '#4f46e5', description: 'Investigational product' },
    { id: 't-el-2', name: 'Placebo', color: '#9ca3af', description: 'Matching placebo' },
    { id: 't-el-3', name: 'Screening', color: '#7c3aed', description: 'Screening assessments' },
    { id: 't-el-4', name: 'Follow-up', color: '#16a34a', description: 'Follow-up assessments' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-3'] },
    { armId: 't-arm-2', epochId: 't-epoch-1', elementIds: ['t-el-3'] },
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-2', elementIds: ['t-el-2'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-4'] },
    { armId: 't-arm-2', epochId: 't-epoch-3', elementIds: ['t-el-4'] },
  ],
  markers: [
    { id: 't-m-1', type: 'randomization', afterEpochId: 't-epoch-1', label: 'R', ratio: '1:1', description: '' },
  ],
};

// ---------------------------------------------------------------------------
// Template 2: Parallel 3-Arm
// ---------------------------------------------------------------------------
const PARALLEL_3ARM = {
  meta: {
    id: 'parallel-3arm',
    name: 'Parallel (3-Arm)',
    description: 'Dose-finding trial with high-dose, low-dose, and placebo arms. Common in Phase 2b studies.',
    icon: '📊',
    tags: ['parallel', 'dose-finding', 'phase-2'],
  },
  interventionModel: 'Parallel',
  blindingSchema: 'Double Blind',
  arms: [
    { id: 't-arm-1', name: 'High Dose', type: 'Experimental Arm', order: 1 },
    { id: 't-arm-2', name: 'Low Dose', type: 'Experimental Arm', order: 2 },
    { id: 't-arm-3', name: 'Placebo', type: 'Placebo Comparator Arm', order: 3 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'Treatment', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'Follow-up', type: 'Follow-up', order: 3 },
  ],
  elements: [
    { id: 't-el-1', name: 'Drug High', color: '#dc2626', description: 'High dose treatment' },
    { id: 't-el-2', name: 'Drug Low', color: '#d97706', description: 'Low dose treatment' },
    { id: 't-el-3', name: 'Placebo', color: '#9ca3af', description: 'Matching placebo' },
    { id: 't-el-4', name: 'Screening', color: '#7c3aed', description: 'Screening assessments' },
    { id: 't-el-5', name: 'Follow-up', color: '#16a34a', description: 'Follow-up assessments' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-4'] },
    { armId: 't-arm-2', epochId: 't-epoch-1', elementIds: ['t-el-4'] },
    { armId: 't-arm-3', epochId: 't-epoch-1', elementIds: ['t-el-4'] },
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-2', elementIds: ['t-el-2'] },
    { armId: 't-arm-3', epochId: 't-epoch-2', elementIds: ['t-el-3'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-3', elementIds: ['t-el-5'] },
    { armId: 't-arm-3', epochId: 't-epoch-3', elementIds: ['t-el-5'] },
  ],
  markers: [
    { id: 't-m-1', type: 'randomization', afterEpochId: 't-epoch-1', label: 'R', ratio: '1:1:1', description: '' },
  ],
};

// ---------------------------------------------------------------------------
// Template 3: Crossover 2×2
// ---------------------------------------------------------------------------
const CROSSOVER_2X2 = {
  meta: {
    id: 'crossover-2x2',
    name: 'Crossover (2×2)',
    description: 'Two-period, two-treatment crossover design. Subjects receive both treatments in randomized sequence with a washout period.',
    icon: '🔄',
    tags: ['crossover', 'bioequivalence', 'phase-1'],
  },
  interventionModel: 'Crossover',
  blindingSchema: 'Double Blind',
  arms: [
    { id: 't-arm-1', name: 'Sequence AB', type: 'Experimental Arm', order: 1 },
    { id: 't-arm-2', name: 'Sequence BA', type: 'Experimental Arm', order: 2 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'Period 1', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'Washout', type: 'Washout', order: 3 },
    { id: 't-epoch-4', name: 'Period 2', type: 'Treatment', order: 4 },
    { id: 't-epoch-5', name: 'Follow-up', type: 'Follow-up', order: 5 },
  ],
  elements: [
    { id: 't-el-1', name: 'Drug A', color: '#4f46e5', description: 'Treatment A' },
    { id: 't-el-2', name: 'Drug B', color: '#dc2626', description: 'Treatment B' },
    { id: 't-el-3', name: 'Washout', color: '#d97706', description: 'Washout period' },
    { id: 't-el-4', name: 'Screening', color: '#7c3aed', description: 'Screening assessments' },
    { id: 't-el-5', name: 'Follow-up', color: '#16a34a', description: 'Follow-up assessments' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-4'] },
    { armId: 't-arm-2', epochId: 't-epoch-1', elementIds: ['t-el-4'] },
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-2', elementIds: ['t-el-2'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-3'] },
    { armId: 't-arm-2', epochId: 't-epoch-3', elementIds: ['t-el-3'] },
    { armId: 't-arm-1', epochId: 't-epoch-4', elementIds: ['t-el-2'] },
    { armId: 't-arm-2', epochId: 't-epoch-4', elementIds: ['t-el-1'] },
    { armId: 't-arm-1', epochId: 't-epoch-5', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-5', elementIds: ['t-el-5'] },
  ],
  markers: [
    { id: 't-m-1', type: 'randomization', afterEpochId: 't-epoch-1', label: 'R', ratio: '1:1', description: '' },
  ],
  // Crossover arrows: after Period 1, Sequence AB → arm 2 (Drug B), Sequence BA → arm 1 (Drug A)
  flowOverrides: [
    { id: 't-fo-1', key: 't-arm-1__t-epoch-3', fromArmId: 't-arm-1', fromEpochId: 't-epoch-3', toArmId: 't-arm-2' },
    { id: 't-fo-2', key: 't-arm-2__t-epoch-3', fromArmId: 't-arm-2', fromEpochId: 't-epoch-3', toArmId: 't-arm-1' },
  ],
};

// ---------------------------------------------------------------------------
// Template 4: Adaptive Dose-Escalation
// ---------------------------------------------------------------------------
const ADAPTIVE_DOSE_ESCALATION = {
  meta: {
    id: 'adaptive-dose-escalation',
    name: 'Adaptive Dose-Escalation',
    description: 'Sequential cohort dose-escalation with interim safety reviews. Common in oncology Phase 1 studies (3+3 or modified designs).',
    icon: '📈',
    tags: ['adaptive', 'dose-escalation', 'oncology', 'phase-1'],
  },
  interventionModel: 'Sequential',
  blindingSchema: 'Open Label',
  arms: [
    { id: 't-arm-1', name: 'Cohort 1 (Low)', type: 'Experimental Arm', order: 1 },
    { id: 't-arm-2', name: 'Cohort 2 (Mid)', type: 'Experimental Arm', order: 2 },
    { id: 't-arm-3', name: 'Cohort 3 (High)', type: 'Experimental Arm', order: 3 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'DL1', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'IA-1', type: 'Treatment', order: 3, isInterimAnalysis: true },
    { id: 't-epoch-4', name: 'DL2', type: 'Treatment', order: 4 },
    { id: 't-epoch-5', name: 'IA-2', type: 'Treatment', order: 5, isInterimAnalysis: true },
    { id: 't-epoch-6', name: 'DL3', type: 'Treatment', order: 6 },
    { id: 't-epoch-7', name: 'Follow-up', type: 'Follow-up', order: 7 },
  ],
  elements: [
    { id: 't-el-1', name: 'Dose Level 1', color: '#16a34a', description: 'Starting dose' },
    { id: 't-el-2', name: 'Dose Level 2', color: '#d97706', description: 'Intermediate dose' },
    { id: 't-el-3', name: 'Dose Level 3', color: '#dc2626', description: 'Highest dose' },
    { id: 't-el-4', name: 'Safety Review', color: '#7c3aed', description: 'DLT evaluation' },
    { id: 't-el-5', name: 'Screening', color: '#6b7280', description: 'Screening assessments' },
    { id: 't-el-6', name: 'Follow-up', color: '#0891b2', description: 'Follow-up assessments' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-4'] },
    { armId: 't-arm-2', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-4', elementIds: ['t-el-2'] },
    { armId: 't-arm-2', epochId: 't-epoch-5', elementIds: ['t-el-4'] },
    { armId: 't-arm-3', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-3', epochId: 't-epoch-6', elementIds: ['t-el-3'] },
    { armId: 't-arm-1', epochId: 't-epoch-7', elementIds: ['t-el-6'] },
    { armId: 't-arm-2', epochId: 't-epoch-7', elementIds: ['t-el-6'] },
    { armId: 't-arm-3', epochId: 't-epoch-7', elementIds: ['t-el-6'] },
  ],
  markers: [
    { id: 't-m-1', type: 'decision_point', afterEpochId: 't-epoch-2', label: 'D', ratio: '', description: 'Safety review before dose escalation' },
    { id: 't-m-2', type: 'decision_point', afterEpochId: 't-epoch-4', label: 'D', ratio: '', description: 'Safety review before dose escalation' },
  ],
};

// ---------------------------------------------------------------------------
// Template 5: Multi-Arm Multi-Stage (MAMS)
// ---------------------------------------------------------------------------
const MAMS = {
  meta: {
    id: 'mams',
    name: 'Multi-Arm Multi-Stage',
    description: 'Platform trial design with multiple experimental arms and interim analyses. Under-performing arms can be dropped at each stage.',
    icon: '🌐',
    tags: ['mams', 'platform', 'adaptive', 'oncology', 'phase-2', 'phase-3'],
  },
  interventionModel: 'Parallel',
  blindingSchema: 'Open Label',
  arms: [
    { id: 't-arm-1', name: 'Arm A (Drug X)', type: 'Experimental Arm', order: 1 },
    { id: 't-arm-2', name: 'Arm B (Drug Y)', type: 'Experimental Arm', order: 2 },
    { id: 't-arm-3', name: 'Arm C (Drug Z)', type: 'Experimental Arm', order: 3 },
    { id: 't-arm-4', name: 'Control (SOC)', type: 'Active Comparator Arm', order: 4 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'Stage 1', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'IA-1', type: 'Treatment', order: 3, isInterimAnalysis: true },
    { id: 't-epoch-4', name: 'Stage 2', type: 'Treatment', order: 4 },
    { id: 't-epoch-5', name: 'IA-2', type: 'Treatment', order: 5, isInterimAnalysis: true },
    { id: 't-epoch-6', name: 'Stage 3', type: 'Treatment', order: 6 },
    { id: 't-epoch-7', name: 'Follow-up', type: 'Follow-up', order: 7 },
  ],
  elements: [
    { id: 't-el-1', name: 'Drug X', color: '#4f46e5', description: 'Experimental treatment X' },
    { id: 't-el-2', name: 'Drug Y', color: '#dc2626', description: 'Experimental treatment Y' },
    { id: 't-el-3', name: 'Drug Z', color: '#d97706', description: 'Experimental treatment Z' },
    { id: 't-el-4', name: 'SOC', color: '#16a34a', description: 'Standard of care' },
    { id: 't-el-5', name: 'IA Review', color: '#7c3aed', description: 'Interim analysis review' },
    { id: 't-el-6', name: 'Screening', color: '#6b7280', description: 'Screening assessments' },
    { id: 't-el-7', name: 'Follow-up', color: '#0891b2', description: 'Follow-up assessments' },
  ],
  cells: [
    // Screening — all arms
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-6'] },
    { armId: 't-arm-2', epochId: 't-epoch-1', elementIds: ['t-el-6'] },
    { armId: 't-arm-3', epochId: 't-epoch-1', elementIds: ['t-el-6'] },
    { armId: 't-arm-4', epochId: 't-epoch-1', elementIds: ['t-el-6'] },
    // Stage 1 — all arms active
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-2', elementIds: ['t-el-2'] },
    { armId: 't-arm-3', epochId: 't-epoch-2', elementIds: ['t-el-3'] },
    { armId: 't-arm-4', epochId: 't-epoch-2', elementIds: ['t-el-4'] },
    // IA-1
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-3', elementIds: ['t-el-5'] },
    { armId: 't-arm-3', epochId: 't-epoch-3', elementIds: ['t-el-5'] },
    { armId: 't-arm-4', epochId: 't-epoch-3', elementIds: ['t-el-5'] },
    // Stage 2 — all surviving arms continue
    { armId: 't-arm-1', epochId: 't-epoch-4', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-4', elementIds: ['t-el-2'] },
    { armId: 't-arm-3', epochId: 't-epoch-4', elementIds: ['t-el-3'] },
    { armId: 't-arm-4', epochId: 't-epoch-4', elementIds: ['t-el-4'] },
    // IA-2
    { armId: 't-arm-1', epochId: 't-epoch-5', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-5', elementIds: ['t-el-5'] },
    { armId: 't-arm-4', epochId: 't-epoch-5', elementIds: ['t-el-5'] },
    // Stage 3 — final stage
    { armId: 't-arm-1', epochId: 't-epoch-6', elementIds: ['t-el-1'] },
    { armId: 't-arm-4', epochId: 't-epoch-6', elementIds: ['t-el-4'] },
    // Follow-up
    { armId: 't-arm-1', epochId: 't-epoch-7', elementIds: ['t-el-7'] },
    { armId: 't-arm-2', epochId: 't-epoch-7', elementIds: ['t-el-7'] },
    { armId: 't-arm-3', epochId: 't-epoch-7', elementIds: ['t-el-7'] },
    { armId: 't-arm-4', epochId: 't-epoch-7', elementIds: ['t-el-7'] },
  ],
  markers: [
    { id: 't-m-1', type: 'randomization', afterEpochId: 't-epoch-1', label: 'R', ratio: '1:1:1:1', description: '' },
    { id: 't-m-2', type: 'interim_analysis', afterEpochId: 't-epoch-2', label: 'IA', ratio: 'IA-1', description: 'Interim analysis — arms may be dropped' },
    { id: 't-m-3', type: 'interim_analysis', afterEpochId: 't-epoch-4', label: 'IA', ratio: 'IA-2', description: 'Interim analysis — arms may be dropped' },
  ],
};

// ---------------------------------------------------------------------------
// Template 6: Oncology Cycles
// ---------------------------------------------------------------------------
const ONCOLOGY_CYCLES = {
  meta: {
    id: 'oncology-cycles',
    name: 'Oncology (Cycles)',
    description: 'Oncology trial with induction chemotherapy cycles followed by maintenance therapy. Standard design for solid tumors and hematologic malignancies.',
    icon: '🎯',
    tags: ['oncology', 'cycles', 'chemotherapy', 'phase-2', 'phase-3'],
  },
  interventionModel: 'Parallel',
  blindingSchema: 'Open Label',
  arms: [
    { id: 't-arm-1', name: 'Chemo + Drug A', type: 'Experimental Arm', order: 1 },
    { id: 't-arm-2', name: 'Chemo + Placebo', type: 'Placebo Comparator Arm', order: 2 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'Induction C1-2', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'Induction C3-4', type: 'Treatment', order: 3 },
    { id: 't-epoch-4', name: 'Maintenance', type: 'Treatment', order: 4 },
    { id: 't-epoch-5', name: 'Follow-up', type: 'Follow-up', order: 5 },
  ],
  elements: [
    { id: 't-el-1', name: 'Chemo + Drug A', color: '#dc2626', description: 'Chemotherapy + investigational drug' },
    { id: 't-el-2', name: 'Chemo + Placebo', color: '#9ca3af', description: 'Chemotherapy + placebo' },
    { id: 't-el-3', name: 'Drug A Maint.', color: '#4f46e5', description: 'Maintenance with Drug A' },
    { id: 't-el-4', name: 'Placebo Maint.', color: '#6b7280', description: 'Maintenance with placebo' },
    { id: 't-el-5', name: 'Screening', color: '#7c3aed', description: 'Screening assessments' },
    { id: 't-el-6', name: 'Follow-up', color: '#16a34a', description: 'Survival follow-up' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-2', elementIds: ['t-el-2'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-3', elementIds: ['t-el-2'] },
    { armId: 't-arm-1', epochId: 't-epoch-4', elementIds: ['t-el-3'] },
    { armId: 't-arm-2', epochId: 't-epoch-4', elementIds: ['t-el-4'] },
    { armId: 't-arm-1', epochId: 't-epoch-5', elementIds: ['t-el-6'] },
    { armId: 't-arm-2', epochId: 't-epoch-5', elementIds: ['t-el-6'] },
  ],
  markers: [
    { id: 't-m-1', type: 'randomization', afterEpochId: 't-epoch-1', label: 'R', ratio: '1:1', description: '' },
  ],
};

// ---------------------------------------------------------------------------
// Template 7: Single Group
// ---------------------------------------------------------------------------
const SINGLE_GROUP = {
  meta: {
    id: 'single-group',
    name: 'Single Group',
    description: 'Single-arm, uncontrolled study. Common for rare diseases, orphan drugs, and early oncology studies.',
    icon: '➡️',
    tags: ['single-arm', 'uncontrolled', 'rare-disease', 'phase-2'],
  },
  interventionModel: 'Single Group',
  blindingSchema: 'Open Label',
  arms: [
    { id: 't-arm-1', name: 'Treatment', type: 'Experimental Arm', order: 1 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'Treatment', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'Follow-up', type: 'Follow-up', order: 3 },
  ],
  elements: [
    { id: 't-el-1', name: 'Drug A', color: '#4f46e5', description: 'Investigational product' },
    { id: 't-el-2', name: 'Screening', color: '#7c3aed', description: 'Screening assessments' },
    { id: 't-el-3', name: 'Follow-up', color: '#16a34a', description: 'Follow-up assessments' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-2'] },
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-3'] },
  ],
  markers: [],
};

// ---------------------------------------------------------------------------
// Template 8: Factorial 2×2
// ---------------------------------------------------------------------------
const FACTORIAL_2X2 = {
  meta: {
    id: 'factorial-2x2',
    name: 'Factorial (2×2)',
    description: 'Two-by-two factorial design testing two treatments simultaneously. Evaluates main effects and interaction of two interventions.',
    icon: '🔢',
    tags: ['factorial', 'combination', 'phase-3'],
  },
  interventionModel: 'Factorial',
  blindingSchema: 'Double Blind',
  arms: [
    { id: 't-arm-1', name: 'A + B', type: 'Experimental Arm', order: 1 },
    { id: 't-arm-2', name: 'A + Placebo B', type: 'Experimental Arm', order: 2 },
    { id: 't-arm-3', name: 'Placebo A + B', type: 'Experimental Arm', order: 3 },
    { id: 't-arm-4', name: 'Placebo A + Placebo B', type: 'Placebo Comparator Arm', order: 4 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'Treatment', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'Follow-up', type: 'Follow-up', order: 3 },
  ],
  elements: [
    { id: 't-el-1', name: 'Drug A + Drug B', color: '#4f46e5', description: 'Both active treatments' },
    { id: 't-el-2', name: 'Drug A + Placebo', color: '#0891b2', description: 'Drug A with placebo B' },
    { id: 't-el-3', name: 'Placebo + Drug B', color: '#d97706', description: 'Placebo A with Drug B' },
    { id: 't-el-4', name: 'Double Placebo', color: '#9ca3af', description: 'Both placebos' },
    { id: 't-el-5', name: 'Screening', color: '#7c3aed', description: 'Screening assessments' },
    { id: 't-el-6', name: 'Follow-up', color: '#16a34a', description: 'Follow-up assessments' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-3', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-4', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-2', elementIds: ['t-el-2'] },
    { armId: 't-arm-3', epochId: 't-epoch-2', elementIds: ['t-el-3'] },
    { armId: 't-arm-4', epochId: 't-epoch-2', elementIds: ['t-el-4'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-6'] },
    { armId: 't-arm-2', epochId: 't-epoch-3', elementIds: ['t-el-6'] },
    { armId: 't-arm-3', epochId: 't-epoch-3', elementIds: ['t-el-6'] },
    { armId: 't-arm-4', epochId: 't-epoch-3', elementIds: ['t-el-6'] },
  ],
  markers: [
    { id: 't-m-1', type: 'randomization', afterEpochId: 't-epoch-1', label: 'R', ratio: '1:1:1:1', description: '' },
  ],
};

// ---------------------------------------------------------------------------
// Template 9: CheckMate 816 (NCT02998528)
// Neoadjuvant Nivolumab + Chemo vs Chemo Alone in resectable NSCLC
// Phase 3, Open-label, Randomized, Parallel
// ---------------------------------------------------------------------------
const CHECKMATE_816 = {
  meta: {
    id: 'checkmate-816',
    name: 'CheckMate 816 (Neoadjuvant IO)',
    description: 'Neoadjuvant immunotherapy + chemotherapy vs chemo alone in resectable NSCLC (Stage IB-IIIA). Based on NCT02998528.',
    icon: '🫁',
    tags: ['oncology', 'nsclc', 'neoadjuvant', 'phase-3', 'immunotherapy'],
  },
  interventionModel: 'Parallel',
  blindingSchema: 'Open Label',
  arms: [
    { id: 't-arm-1', name: 'Nivo + Chemo', type: 'Experimental Arm', order: 1 },
    { id: 't-arm-2', name: 'Chemo Alone', type: 'Active Comparator Arm', order: 2 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'Neoadjuvant (3 Cycles)', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'Surgery', type: 'Treatment', order: 3 },
    { id: 't-epoch-4', name: 'Adjuvant (optional)', type: 'Treatment', order: 4 },
    { id: 't-epoch-5', name: 'Follow-up', type: 'Follow-up', order: 5 },
  ],
  elements: [
    { id: 't-el-1', name: 'Nivolumab + Pt-Doublet', color: '#4f46e5', description: 'Nivolumab 360mg Q3W + platinum-doublet chemo' },
    { id: 't-el-2', name: 'Pt-Doublet Chemo', color: '#d97706', description: 'Platinum-doublet chemotherapy alone' },
    { id: 't-el-3', name: 'Surgical Resection', color: '#dc2626', description: 'Surgical resection of tumor' },
    { id: 't-el-4', name: 'Adjuvant Chemo', color: '#0891b2', description: 'Optional adjuvant chemotherapy' },
    { id: 't-el-5', name: 'Screening', color: '#7c3aed', description: 'Eligibility screening' },
    { id: 't-el-6', name: 'Survival Follow-up', color: '#16a34a', description: 'EFS/OS follow-up' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-1', elementIds: ['t-el-5'] },
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-2', elementIds: ['t-el-2'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-3'] },
    { armId: 't-arm-2', epochId: 't-epoch-3', elementIds: ['t-el-3'] },
    { armId: 't-arm-1', epochId: 't-epoch-4', elementIds: ['t-el-4'] },
    { armId: 't-arm-2', epochId: 't-epoch-4', elementIds: ['t-el-4'] },
    { armId: 't-arm-1', epochId: 't-epoch-5', elementIds: ['t-el-6'] },
    { armId: 't-arm-2', epochId: 't-epoch-5', elementIds: ['t-el-6'] },
  ],
  markers: [
    { id: 't-m-1', type: 'randomization', afterEpochId: 't-epoch-1', label: 'R', ratio: '1:1', description: '' },
  ],
};

// ---------------------------------------------------------------------------
// Template 10: LAURA (NCT03521154)
// Osimertinib maintenance after chemoradiation in Stage III EGFR+ NSCLC
// Phase 3, Double-blind, Randomized, Parallel (2:1)
// ---------------------------------------------------------------------------
const LAURA_TRIAL = {
  meta: {
    id: 'laura-trial',
    name: 'LAURA (Maintenance TKI)',
    description: 'Osimertinib vs placebo as maintenance after chemoradiation in Stage III EGFR+ NSCLC. Based on NCT03521154.',
    icon: '💊',
    tags: ['oncology', 'nsclc', 'maintenance', 'phase-3', 'targeted-therapy'],
  },
  interventionModel: 'Parallel',
  blindingSchema: 'Double Blind',
  arms: [
    { id: 't-arm-1', name: 'Osimertinib', type: 'Experimental Arm', order: 1 },
    { id: 't-arm-2', name: 'Placebo', type: 'Placebo Comparator Arm', order: 2 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening / CRT', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'Randomization', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'Maintenance Tx', type: 'Treatment', order: 3 },
    { id: 't-epoch-4', name: 'Post-Progression', type: 'Treatment', order: 4 },
    { id: 't-epoch-5', name: 'Follow-up', type: 'Follow-up', order: 5 },
  ],
  elements: [
    { id: 't-el-1', name: 'Osimertinib 80mg', color: '#4f46e5', description: 'Osimertinib 80mg QD maintenance' },
    { id: 't-el-2', name: 'Placebo', color: '#9ca3af', description: 'Matching placebo QD' },
    { id: 't-el-3', name: 'Post-CRT Screen', color: '#7c3aed', description: 'EGFR mutation testing, staging after chemoradiation' },
    { id: 't-el-4', name: 'Open-label Osi', color: '#0891b2', description: 'Optional crossover to open-label osimertinib after PD' },
    { id: 't-el-5', name: 'Survival FU', color: '#16a34a', description: 'PFS/OS follow-up assessments' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-3'] },
    { armId: 't-arm-2', epochId: 't-epoch-1', elementIds: ['t-el-3'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-1'] },
    { armId: 't-arm-2', epochId: 't-epoch-3', elementIds: ['t-el-2'] },
    { armId: 't-arm-1', epochId: 't-epoch-4', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-4', elementIds: ['t-el-4'] },
    { armId: 't-arm-1', epochId: 't-epoch-5', elementIds: ['t-el-5'] },
    { armId: 't-arm-2', epochId: 't-epoch-5', elementIds: ['t-el-5'] },
  ],
  markers: [
    { id: 't-m-1', type: 'randomization', afterEpochId: 't-epoch-1', label: 'R', ratio: '2:1', description: '' },
  ],
};

// ---------------------------------------------------------------------------
// Template 11: DeLLphi-301 (NCT05060016)
// Single-arm Phase 2 of tarlatamab in relapsed/refractory SCLC
// Phase 2, Open-label, Single Group (with dose-finding Part 1)
// ---------------------------------------------------------------------------
const DELLPHI_301 = {
  meta: {
    id: 'dellphi-301',
    name: 'DeLLphi-301 (Single-Arm Onc)',
    description: 'Single-arm Phase 2 of tarlatamab (BiTE) in relapsed/refractory SCLC with step-up dosing. Based on NCT05060016.',
    icon: '🔬',
    tags: ['oncology', 'sclc', 'single-arm', 'phase-2', 'bispecific'],
  },
  interventionModel: 'Single Group',
  blindingSchema: 'Open Label',
  arms: [
    { id: 't-arm-1', name: 'Tarlatamab 10mg', type: 'Experimental Arm', order: 1 },
  ],
  epochs: [
    { id: 't-epoch-1', name: 'Screening', type: 'Screening', order: 1 },
    { id: 't-epoch-2', name: 'C1 Step-up', type: 'Treatment', order: 2 },
    { id: 't-epoch-3', name: 'C2+ Treatment', type: 'Treatment', order: 3 },
    { id: 't-epoch-4', name: 'Response Eval', type: 'Treatment', order: 4 },
    { id: 't-epoch-5', name: 'Cont. Tx / FU', type: 'Follow-up', order: 5 },
  ],
  elements: [
    { id: 't-el-1', name: 'Tarlatamab 1mg', color: '#d97706', description: 'Step-up dose C1D1 (1mg IV)' },
    { id: 't-el-2', name: 'Tarlatamab 10mg', color: '#4f46e5', description: 'Target dose C1D8+, then Q2W' },
    { id: 't-el-3', name: 'RECIST Eval', color: '#7c3aed', description: 'Tumor assessment per RECIST 1.1' },
    { id: 't-el-4', name: 'Screening', color: '#6b7280', description: 'Eligibility and baseline' },
    { id: 't-el-5', name: 'Continued Tx/FU', color: '#16a34a', description: 'Continue treatment or survival follow-up' },
  ],
  cells: [
    { armId: 't-arm-1', epochId: 't-epoch-1', elementIds: ['t-el-4'] },
    { armId: 't-arm-1', epochId: 't-epoch-2', elementIds: ['t-el-1', 't-el-2'] },
    { armId: 't-arm-1', epochId: 't-epoch-3', elementIds: ['t-el-2'] },
    { armId: 't-arm-1', epochId: 't-epoch-4', elementIds: ['t-el-3'] },
    { armId: 't-arm-1', epochId: 't-epoch-5', elementIds: ['t-el-5'] },
  ],
  markers: [],
};

// ---------------------------------------------------------------------------
// Export all templates
// ---------------------------------------------------------------------------
export const DESIGN_TEMPLATES = [
  CHECKMATE_816,
  LAURA_TRIAL,
  DELLPHI_301,
  PARALLEL_2ARM,
  PARALLEL_3ARM,
  CROSSOVER_2X2,
  ADAPTIVE_DOSE_ESCALATION,
  MAMS,
  ONCOLOGY_CYCLES,
  SINGLE_GROUP,
  FACTORIAL_2X2,
];

export {
  PARALLEL_2ARM,
  PARALLEL_3ARM,
  CROSSOVER_2X2,
  ADAPTIVE_DOSE_ESCALATION,
  MAMS,
  ONCOLOGY_CYCLES,
  SINGLE_GROUP,
  FACTORIAL_2X2,
  CHECKMATE_816,
  LAURA_TRIAL,
  DELLPHI_301,
};
