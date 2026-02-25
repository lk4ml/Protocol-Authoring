/**
 * USDM (Unified Study Definitions Model) Type Definitions
 * Based on USDM v4.0 specification
 * Reference: https://github.com/transcelerate/ddf-sdr-api
 */

/**
 * @typedef {Object} StandardCode
 * @property {string} code - NCI code
 * @property {string} codeSystem - Code system URI
 * @property {string} decode - Decoded value
 */

/**
 * @typedef {Object} StudyIdentifier
 * @property {string} studyIdentifier - Protocol number or identifier
 * @property {Object} studyIdentifierScope - Organization scope
 */

/**
 * @typedef {Object} StudyVersion
 * @property {string} versionNumber - Version number
 * @property {string} versionDate - ISO date string
 */

/**
 * @typedef {Object} StudyTitle
 * @property {string} text - Title text
 * @property {boolean} isPublicTitle - Whether it's a public title
 */

/**
 * @typedef {Object} StudyPhase
 * @property {StandardCode} standardCode - Phase code
 */

/**
 * @typedef {Object} StudyArm
 * @property {string} id - Unique identifier
 * @property {string} name - Arm name
 * @property {string} description - Arm description
 */

/**
 * @typedef {Object} StudyEpoch
 * @property {string} id - Unique identifier
 * @property {string} name - Epoch name
 * @property {Object} type - Epoch type with code and decode
 * @property {number} order - Epoch order
 */

/**
 * @typedef {Object} Timing
 * @property {string} type - FIXED, RELATIVE, or WINDOW
 * @property {number|null} plannedStudyDay - Planned study day
 * @property {number|null} windowLower - Lower window bound
 * @property {number|null} windowUpper - Upper window bound
 * @property {string} label - Window label
 */

/**
 * @typedef {Object} ScheduledActivity
 * @property {string} id - Unique identifier
 * @property {string} name - Activity name
 * @property {string} activityId - Reference to activity
 * @property {string} sdtmDomain - SDTM domain code
 * @property {string} cdashFormType - CDASH form type
 * @property {string[]} biomedicalConceptIds - Array of BC IDs
 * @property {boolean} mandatory - Whether activity is mandatory
 */

/**
 * @typedef {Object} ScheduledInstance
 * @property {string} id - Unique identifier
 * @property {string} name - Visit/instance name
 * @property {string} scheduledInstanceTimelineEntryId - Timeline entry ID
 * @property {string} scheduledInstanceType - Type (e.g., 'VISIT')
 * @property {string} epochId - Reference to epoch
 * @property {Timing} timing - Timing information
 * @property {ScheduledActivity[]} scheduledActivities - Activities for this instance
 */

/**
 * @typedef {Object} ScheduledTimeline
 * @property {string} id - Unique identifier
 * @property {string} name - Timeline name
 * @property {boolean} mainTimeline - Whether this is the main timeline
 * @property {ScheduledInstance[]} scheduledInstances - Visit instances
 */

/**
 * @typedef {Object} Criterion
 * @property {string} id - Unique identifier
 * @property {string} name - Criterion name (e.g., 'I01', 'E01')
 * @property {string} text - Criterion text
 * @property {string} type - 'INCLUSION' or 'EXCLUSION'
 */

/**
 * @typedef {Object} StudyPopulation
 * @property {string} id - Unique identifier
 * @property {string} name - Population name
 * @property {number} plannedEnrollmentNumber - Planned enrollment
 * @property {Criterion[]} inclusionCriteria - Inclusion criteria
 * @property {Criterion[]} exclusionCriteria - Exclusion criteria
 */

/**
 * @typedef {Object} Endpoint
 * @property {string} id - Unique identifier
 * @property {string} text - Endpoint description
 * @property {string} purpose - Purpose (Efficacy, Safety, PK)
 */

/**
 * @typedef {Object} Objective
 * @property {string} id - Unique identifier
 * @property {string} text - Objective text
 * @property {Object} level - Objective level with code and decode
 * @property {Endpoint[]} endpoints - Associated endpoints
 */

/**
 * @typedef {Object} DataElement
 * @property {string} name - Element name (e.g., 'VSTESTCD')
 * @property {string} value - Element value
 * @property {string} cdash - CDASH mapping
 */

/**
 * @typedef {Object} BiomedicalConcept
 * @property {string} id - Unique identifier
 * @property {string} name - BC name
 * @property {Object} code - Standard code
 * @property {string} category - Category
 * @property {string} sdtmDomain - SDTM domain
 * @property {string} dataType - Data type
 * @property {string|null} unit - Unit of measure
 * @property {DataElement[]} dataElements - Data elements
 */

/**
 * @typedef {Object} StudyDesign
 * @property {string} id - Unique identifier
 * @property {string} name - Design name
 * @property {Object} interventionModel - Intervention model with code and decode
 * @property {StudyArm[]} studyArms - Study arms
 * @property {StudyEpoch[]} studyEpochs - Study epochs
 * @property {ScheduledTimeline[]} scheduledTimelines - Timelines
 * @property {StudyPopulation[]} studyPopulations - Study populations
 * @property {Objective[]} objectives - Objectives
 * @property {BiomedicalConcept[]} biomedicalConcepts - Biomedical concepts
 */

/**
 * @typedef {Object} Study
 * @property {string} id - Unique identifier (USDM ID)
 * @property {string} instanceType - Always 'Study'
 * @property {StudyTitle} studyTitle - Study title
 * @property {StudyVersion} studyVersion - Study version
 * @property {StudyPhase} studyPhase - Study phase
 * @property {StudyIdentifier[]} studyIdentifiers - Study identifiers
 * @property {StudyDesign[]} studyDesigns - Study designs
 */

/**
 * @typedef {Object} AuditTrail
 * @property {string} entryDateTime - ISO datetime string
 * @property {string} systemName - System name
 */

/**
 * @typedef {Object} USDM
 * @property {Study} study - Study definition
 * @property {AuditTrail} auditTrail - Audit trail information
 */

export default {
  // Type definitions are exported as JSDoc comments above
  // These can be used with TypeScript or JSDoc type checking
};

