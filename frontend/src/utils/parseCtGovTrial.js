/**
 * parseCtGovTrial.js — Rich parser for ClinicalTrials.gov API v2 responses.
 *
 * Extracts ALL useful structured data from a trial's protocolSection,
 * including sponsor info, parsed eligibility criteria, full outcome lists,
 * detailed design info, and descriptions.
 */

/**
 * Parse raw eligibility criteria text into inclusion/exclusion arrays.
 * CT.gov uses a common format with "Inclusion Criteria:" and "Exclusion Criteria:" headings.
 */
export function parseEligibilityText(text) {
  if (!text) return { inclusion: [], exclusion: [] };

  const inclusionMatch = text.match(
    /Inclusion\s+Criteria:?\s*([\s\S]*?)(?=Exclusion\s+Criteria:|$)/i
  );
  const exclusionMatch = text.match(
    /Exclusion\s+Criteria:?\s*([\s\S]*?)$/i
  );

  const parseBullets = (block) => {
    if (!block) return [];
    return block
      .split(/\n/)
      .map((line) => line.replace(/^[\s*\-•–]+/, '').trim())
      .filter((line) => line.length > 2); // skip empty lines / very short fragments
  };

  return {
    inclusion: parseBullets(inclusionMatch?.[1]),
    exclusion: parseBullets(exclusionMatch?.[1]),
  };
}

/**
 * Parse the full CT.gov API v2 response into a rich reference object.
 *
 * @param {Object} json — Raw JSON from /api/v2/studies/{NCT_ID}
 * @param {string} nctId — Cleaned NCT ID
 * @returns {Object} Parsed reference trial object
 */
export function parseCtGovResponse(json, nctId) {
  const proto = json.protocolSection || {};
  const ident = proto.identificationModule || {};
  const design = proto.designModule || {};
  const armsModule = proto.armsInterventionsModule || {};
  const outcomes = proto.outcomesModule || {};
  const elig = proto.eligibilityModule || {};
  const desc = proto.descriptionModule || {};
  const status = proto.statusModule || {};
  const sponsor = proto.sponsorCollaboratorsModule || {};
  const conditions = proto.conditionsModule || {};

  // Parse eligibility text into structured arrays
  const eligText = elig.eligibilityCriteria || '';
  const { inclusion, exclusion } = parseEligibilityText(eligText);

  return {
    nctId,
    fetchedAt: new Date().toISOString(),

    // Identification
    briefTitle: ident.briefTitle || '',
    officialTitle: ident.officialTitle || '',

    // Sponsor
    sponsorName: sponsor.leadSponsor?.name || '',
    sponsorClass: sponsor.leadSponsor?.class || '',
    collaborators: (sponsor.collaborators || []).map((c) => c.name),

    // Status
    overallStatus: status.overallStatus || '',
    startDate: status.startDateStruct?.date || '',
    completionDate: status.completionDateStruct?.date || '',
    lastUpdateDate: status.lastUpdatePostDateStruct?.date || '',

    // Design
    phase: (design.phases || []).join(' / '),
    studyType: design.studyType || '',
    enrollment: design.enrollmentInfo?.count || null,
    enrollmentType: design.enrollmentInfo?.type || '',
    designInfo: {
      interventionModel: design.designInfo?.interventionModel || '',
      interventionModelDescription:
        design.designInfo?.interventionModelDescription || '',
      allocation: design.designInfo?.allocation || '',
      masking: design.designInfo?.maskingInfo?.masking || '',
      maskingDescription:
        design.designInfo?.maskingInfo?.maskingDescription || '',
      whoMasked: design.designInfo?.maskingInfo?.whoMasked || [],
      primaryPurpose: design.designInfo?.primaryPurpose || '',
      observationalModel: design.designInfo?.observationalModel || '',
      timePerspective: design.designInfo?.timePerspective || '',
    },
    numberOfArms: design.designInfo?.numberOfArms || null,

    // Conditions
    conditions: conditions.conditions || [],
    keywords: conditions.keywords || [],

    // Arms
    arms: (armsModule.armGroups || []).map((a) => ({
      label: a.label || '',
      type: a.type || '',
      description: a.description || '',
      interventionNames: a.interventionNames || [],
    })),

    // Interventions
    interventions: (armsModule.interventions || []).map((i) => ({
      name: i.name || '',
      type: i.type || '',
      description: i.description || '',
      armLabels: i.armGroupLabels || [],
      otherNames: i.otherNames || [],
    })),

    // Eligibility — both raw and parsed
    eligibility: {
      rawText: eligText,
      inclusion,
      exclusion,
      sex: elig.sex || 'All',
      minimumAge: elig.minimumAge || '',
      maximumAge: elig.maximumAge || '',
      healthyVolunteers: elig.healthyVolunteers === 'Yes',
      stdAges: elig.stdAges || [],
    },

    // Outcomes / Endpoints — NO cap, extract everything
    outcomes: {
      primary: (outcomes.primaryOutcomes || []).map((o) => ({
        measure: o.measure || '',
        description: o.description || '',
        timeFrame: o.timeFrame || '',
      })),
      secondary: (outcomes.secondaryOutcomes || []).map((o) => ({
        measure: o.measure || '',
        description: o.description || '',
        timeFrame: o.timeFrame || '',
      })),
      other: (outcomes.otherOutcomes || []).map((o) => ({
        measure: o.measure || '',
        description: o.description || '',
        timeFrame: o.timeFrame || '',
      })),
    },

    // Descriptions
    description: {
      briefSummary: desc.briefSummary || '',
      detailedDescription: desc.detailedDescription || '',
    },
  };
}
