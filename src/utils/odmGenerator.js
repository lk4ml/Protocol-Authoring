import { js2xml } from 'xml-js';

/**
 * Generate ODM-XML 1.3.2 from USDM
 * @param {Object} usdm - USDM study definition
 * @param {Object} protocol - Original protocol data
 * @returns {string} ODM-XML string
 */
export function generateODMXML(usdm, protocol) {
  const study = usdm.study;
  const design = study.studyDesigns?.[0];
  const timeline = design?.scheduledTimelines?.[0];

  const forms = new Map();
  timeline?.scheduledInstances?.forEach(visit => {
    visit.scheduledActivities?.forEach(activity => {
      const formId = activity.cdashFormType || activity.activityId;
      if (!forms.has(formId)) {
        forms.set(formId, {
          id: formId,
          name: activity.name,
          domain: activity.sdtmDomain,
          bcIds: activity.biomedicalConceptIds || []
        });
      }
    });
  });

  const odm = {
    _declaration: {
      _attributes: {
        version: '1.0',
        encoding: 'UTF-8'
      }
    },
    ODM: {
      _attributes: {
        xmlns: 'http://www.cdisc.org/ns/odm/v1.3',
        FileOID: `${study.id}_ODM`,
        FileType: 'Snapshot',
        CreationDateTime: new Date().toISOString(),
        ODMVersion: '1.3.2',
        Originator: 'Protocol Intelligence Platform'
      },
      Study: [{
        _attributes: {
          OID: protocol.protocolNumber
        },
        GlobalVariables: [{
          StudyName: [study.studyTitle?.text || ''],
          StudyDescription: [protocol.shortTitle || ''],
          ProtocolName: [protocol.protocolNumber || '']
        }],
        MetaDataVersion: [{
          _attributes: {
            OID: 'MDV.001',
            Name: 'Study Metadata'
          },
          Protocol: [{
            StudyEventRef: timeline?.scheduledInstances?.map((v, i) => ({
              _attributes: {
                StudyEventOID: `SE.${v.scheduledInstanceTimelineEntryId}`,
                OrderNumber: String(i + 1),
                Mandatory: 'Yes'
              }
            })) || []
          }],
          StudyEventDef: timeline?.scheduledInstances?.map(visit => ({
            _attributes: {
              OID: `SE.${visit.scheduledInstanceTimelineEntryId}`,
              Name: visit.name,
              Repeating: 'No',
              Type: 'Scheduled'
            },
            FormRef: visit.scheduledActivities?.map((a, idx) => ({
              _attributes: {
                FormOID: `F.${a.cdashFormType || a.activityId}`,
                Mandatory: a.mandatory ? 'Yes' : 'No',
                OrderNumber: String(idx + 1)
              }
            })) || []
          })) || [],
          FormDef: Array.from(forms.values()).map(form => ({
            _attributes: {
              OID: `F.${form.id}`,
              Name: form.name,
              Repeating: 'No'
            },
            ItemGroupRef: [{
              _attributes: {
                ItemGroupOID: `IG.${form.id}`,
                Mandatory: 'Yes'
              }
            }]
          })),
          ItemGroupDef: Array.from(forms.values()).map(form => ({
            _attributes: {
              OID: `IG.${form.id}`,
              Name: form.name,
              Repeating: 'No',
              Domain: form.domain
            },
            ItemRef: [{
              _attributes: {
                ItemOID: `IT.${form.id}.DAT`,
                Mandatory: 'Yes',
                OrderNumber: '1'
              }
            }]
          })),
          ItemDef: Array.from(forms.values()).map(form => ({
            _attributes: {
              OID: `IT.${form.id}.DAT`,
              Name: 'Assessment Date',
              DataType: 'date'
            },
            Question: [{
              TranslatedText: [{
                _attributes: { 'xml:lang': 'en' },
                _text: `Date of ${form.name}`
              }]
            }],
            Alias: [
              {
                _attributes: {
                  Context: 'CDASH',
                  Name: `${form.domain}DAT`
                }
              },
              {
                _attributes: {
                  Context: 'SDTM',
                  Name: `${form.domain}DTC`
                }
              }
            ]
          }))
        }]
      }]
    }
  };

  return js2xml(odm, { compact: true, spaces: 2 });
}

