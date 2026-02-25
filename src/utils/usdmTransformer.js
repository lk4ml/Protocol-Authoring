import { generateUUID } from './uuid';

/**
 * Transform protocol data to USDM v4.0 format
 * @param {Object} protocol - Protocol data from UI
 * @param {Object} cdiscData - CDISC terminology data
 * @returns {Object} USDM v4.0 compliant study definition
 */
export function transformToUSDM(protocol, cdiscData = {}) {
  const phases = cdiscData.phases || [];
  const interventionModels = cdiscData.interventionModels || [];
  
  const phase = phases.find(p => p.label === protocol.phase || p.decode === protocol.phase) || phases[5] || phases[0];
  const interventionModel = interventionModels.find(m => m.decode === protocol.interventionModel) || interventionModels[0];
  
  return {
    study: {
      id: protocol.usdmId || generateUUID(),
      instanceType: 'Study',
      studyTitle: {
        text: protocol.fullTitle,
        isPublicTitle: false
      },
      studyVersion: {
        versionNumber: protocol.version || '1.0',
        versionDate: new Date().toISOString().split('T')[0]
      },
      studyPhase: {
        standardCode: {
          code: phase?.code || 'C15602',
          codeSystem: 'http://www.cdisc.org/ns/cdisc-ct',
          decode: phase?.decode || 'Phase III Trial'
        }
      },
      studyIdentifiers: [{
        studyIdentifier: protocol.protocolNumber,
        studyIdentifierScope: {
          organisationType: {
            code: 'C70793',
            decode: 'Sponsor'
          },
          name: protocol.sponsorName
        }
      }],
      studyDesigns: [{
        id: generateUUID(),
        name: 'Main Study Design',
        interventionModel: {
          code: interventionModel?.code || 'C82639',
          decode: interventionModel?.decode || 'Parallel'
        },
        studyArms: protocol.arms.map(arm => ({
          id: arm.id,
          name: arm.name,
          description: arm.description
        })),
        studyEpochs: protocol.epochs.map((epoch, idx) => ({
          id: epoch.id,
          name: epoch.name,
          type: {
            code: epoch.typeCode,
            decode: epoch.type
          },
          order: idx + 1
        })),
        scheduledTimelines: [{
          id: generateUUID(),
          name: 'Main Timeline',
          mainTimeline: true,
          scheduledInstances: protocol.visits.map(visit => ({
            id: visit.id,
            name: visit.name,
            scheduledInstanceTimelineEntryId: visit.label || visit.id.toUpperCase(),
            scheduledInstanceType: 'VISIT',
            epochId: visit.epochId,
            timing: {
              type: visit.timingType,
              plannedStudyDay: visit.plannedStudyDay,
              windowLower: visit.windowLower,
              windowUpper: visit.windowUpper,
              label: visit.windowLabel
            },
            scheduledActivities: protocol.activities
              .filter(a => a.visits?.includes(visit.id))
              .map(activity => ({
                id: generateUUID(),
                name: activity.name,
                activityId: activity.id,
                sdtmDomain: activity.domain,
                cdashFormType: activity.formType,
                biomedicalConceptIds: activity.bcIds || [],
                mandatory: activity.visitAssignments?.[visit.id]?.mandatory !== false
              }))
          }))
        }],
        studyPopulations: [{
          id: generateUUID(),
          name: 'Study Population',
          plannedEnrollmentNumber: parseInt(protocol.sampleSize) || 0,
          inclusionCriteria: protocol.inclusionCriteria.map((c, idx) => ({
            id: c.id,
            name: 'I' + String(idx + 1).padStart(2, '0'),
            text: c.text,
            type: 'INCLUSION'
          })),
          exclusionCriteria: protocol.exclusionCriteria.map((c, idx) => ({
            id: c.id,
            name: 'E' + String(idx + 1).padStart(2, '0'),
            text: c.text,
            type: 'EXCLUSION'
          }))
        }],
        objectives: protocol.objectives.map(obj => ({
          id: obj.id,
          text: obj.text,
          level: {
            code: obj.levelCode,
            decode: obj.level
          },
          endpoints: obj.endpoints.map(ep => ({
            id: ep.id,
            text: ep.text,
            purpose: ep.purpose
          }))
        })),
        biomedicalConcepts: extractBiomedicalConcepts(protocol, cdiscData)
      }]
    },
    auditTrail: {
      entryDateTime: new Date().toISOString(),
      systemName: 'Protocol Intelligence Platform'
    }
  };
}

/**
 * Extract biomedical concepts from protocol activities
 */
function extractBiomedicalConcepts(protocol, cdiscData = {}) {
  const bcSet = new Set();
  protocol.activities.forEach(a => {
    (a.bcIds || []).forEach(id => bcSet.add(id));
  });
  
  const biomedicalConcepts = cdiscData.biomedicalConcepts || [];
  
  return Array.from(bcSet).map(bcId => {
    const bc = biomedicalConcepts.find(b => b.id === bcId);
    if (!bc) return null;
    
    return {
      id: bc.id,
      name: bc.name,
      code: {
        code: bc.code,
        decode: bc.name
      },
      category: bc.category,
      sdtmDomain: bc.domain,
      dataType: bc.dataType,
      unit: bc.unit,
      dataElements: bc.dataElements
    };
  }).filter(Boolean);
}

