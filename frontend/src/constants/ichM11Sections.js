/**
 * ICH M11 Protocol Template Section Structure
 * Based on ICH M11 Technical Specification for Clinical Trial Protocol Template
 */
export const ICH_M11_SECTIONS = [
  { id: 'title_page', number: '', label: 'Title Page' },
  { id: 'synopsis', number: '', label: 'Protocol Synopsis' },
  { id: 'soa', number: '', label: 'Schedule of Activities' },
  { id: 'section_1', number: '1', label: 'Introduction', children: [
    { id: 'section_1_1', number: '1.1', label: 'Background and Rationale' },
    { id: 'section_1_2', number: '1.2', label: 'Benefit-Risk Assessment' },
  ]},
  { id: 'section_2', number: '2', label: 'Objectives and Estimands' },
  { id: 'section_3', number: '3', label: 'Trial Design' },
  { id: 'section_4', number: '4', label: 'Trial Population' },
  { id: 'section_5', number: '5', label: 'Trial Interventions' },
  { id: 'section_6', number: '6', label: 'Endpoints' },
  { id: 'section_7', number: '7', label: 'Discontinuation / Withdrawal' },
  { id: 'section_8', number: '8', label: 'Trial Procedures' },
  { id: 'section_9', number: '9', label: 'Statistical Considerations' },
  { id: 'section_10', number: '10', label: 'Safety Reporting' },
  { id: 'section_11', number: '11', label: 'Trial Management' },
];
