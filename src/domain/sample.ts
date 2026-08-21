import { SCHEMA_VERSION, type OntologyDocument } from './types'

const now = new Date().toISOString()

export const SAMPLE_MAP: OntologyDocument = {
  schemaVersion: SCHEMA_VERSION,
  id: 'signal-garden',
  name: 'Signal Garden',
  version: 'v1.0',
  description: 'How a field observation becomes a trusted ecological alert.',
  createdAt: now,
  updatedAt: now,
  groups: [
    { id: 'field', name: 'Field signals', description: 'Where raw observations enter the system.' },
    { id: 'sense', name: 'Sense making', description: 'Where evidence is cleaned and interpreted.' },
    { id: 'decision', name: 'Decision room', description: 'Where confidence becomes coordinated action.' },
    { id: 'outside', name: 'Living world', description: 'People and places beyond the platform.' },
  ],
  nodes: [
    { id: 'observer', code: 'OB', name: 'Observer', role: 'the field witness', groupId: 'field', kind: 'actor', size: 's', position: { gx: 0, gy: 0 }, faceTexture: 'plain', properties: [{ id: 'p-ob-1', key: 'channel', value: 'mobile capture' }], whatItDoes: 'Records a change in the field while its location and context are still known.', howItsBuilt: 'Observations stay attributable to a person so later decisions can return to the original witness.' },
    { id: 'sensor', code: 'SN', name: 'Sensor mesh', role: 'the ambient witness', groupId: 'field', kind: 'source', size: 'l', position: { gx: 4, gy: 0 }, faceTexture: 'hatched', properties: [{ id: 'p-sn-1', key: 'cadence', value: '15 minutes' }, { id: 'p-sn-2', key: 'coverage', value: '12 zones' }], whatItDoes: 'Supplies continuous measurements where a person cannot remain present.', howItsBuilt: 'Readings are kept as a separate evidence stream because machine confidence and human confidence mean different things.' },
    { id: 'intake', code: 'IN', name: 'Evidence intake', role: 'the receiving desk', groupId: 'sense', kind: 'process', size: 'm', position: { gx: 0, gy: 7 }, faceTexture: 'plain', properties: [{ id: 'p-in-1', key: 'required', value: 'time, place, source' }], whatItDoes: 'Turns incoming reports into comparable evidence without erasing where they came from.', howItsBuilt: 'Normalization adds a common envelope and preserves the original payload beside it.' },
    { id: 'correlation', code: 'CR', name: 'Correlation', role: 'the pattern finder', groupId: 'sense', kind: 'process', size: 'l', position: { gx: 4, gy: 7 }, faceTexture: 'hatched', properties: [{ id: 'p-cr-1', key: 'window', value: '72 hours' }, { id: 'p-cr-2', key: 'threshold', value: '3 sources' }], whatItDoes: 'Finds observations that describe the same change across time, place and source.', howItsBuilt: 'A claim only advances when independent evidence agrees; volume alone is not treated as confidence.' },
    { id: 'review', code: 'RV', name: 'Expert review', role: 'the confidence gate', groupId: 'decision', kind: 'decision', size: 'm', position: { gx: 10, gy: 4 }, faceTexture: 'plain', properties: [{ id: 'p-rv-1', key: 'outcomes', value: 'watch, alert, reject' }], whatItDoes: 'Decides whether a pattern deserves action and records the reason for that decision.', howItsBuilt: 'The decision is explicit rather than inferred from a score, keeping accountability with the reviewer.' },
    { id: 'dispatch', code: 'DP', name: 'Response dispatch', role: 'the action coordinator', groupId: 'decision', kind: 'process', size: 'm', position: { gx: 14, gy: 4 }, faceTexture: 'plain', properties: [{ id: 'p-dp-1', key: 'priority', value: 'confidence × urgency' }], whatItDoes: 'Routes a verified alert to the people who can act in the affected place.', howItsBuilt: 'Recipients are selected from geography and responsibility instead of a single broadcast list.' },
    { id: 'steward', code: 'ST', name: 'Local steward', role: 'the responder', groupId: 'outside', kind: 'actor', size: 's', position: { gx: 12, gy: 11 }, faceTexture: 'plain', properties: [{ id: 'p-st-1', key: 'response', value: 'inspect and report' }], whatItDoes: 'Checks the place, acts when needed and reports what changed after the intervention.', howItsBuilt: 'The response closes the evidence loop instead of ending at notification delivery.' },
    { id: 'habitat', code: 'HB', name: 'Habitat', role: 'the affected place', groupId: 'outside', kind: 'place', size: 'xl', position: { gx: 17, gy: 11 }, faceTexture: 'hatched', properties: [{ id: 'p-hb-1', key: 'state', value: 'observed over time' }], whatItDoes: 'The living place the whole system is trying to understand and protect.', howItsBuilt: 'It is modelled as a first-class concept so every alert and response remains tied to a real place.' },
  ],
  relations: [
    { id: 'ob-intake', from: 'observer', to: 'intake', kind: 'data', label: 'field report' },
    { id: 'sn-intake', from: 'sensor', to: 'intake', kind: 'data', label: 'telemetry' },
    { id: 'intake-correlation', from: 'intake', to: 'correlation', kind: 'flow', label: 'normalized evidence' },
    { id: 'correlation-review', from: 'correlation', to: 'review', kind: 'flow', label: 'candidate pattern', via: [{ gx: 8, gy: 9 }] },
    { id: 'review-dispatch', from: 'review', to: 'dispatch', kind: 'flow', label: 'verified alert' },
    { id: 'dispatch-steward', from: 'dispatch', to: 'steward', kind: 'flow', label: 'response brief' },
    { id: 'steward-habitat', from: 'steward', to: 'habitat', kind: 'flow', label: 'field action' },
    { id: 'habitat-observer', from: 'habitat', to: 'observer', kind: 'retry', label: 'new observation', via: [{ gx: 22, gy: 2 }, { gx: 7, gy: -2 }] },
  ],
  flows: [
    { id: 'raise-alert', name: 'Raise an alert', payload: 'evidence', summary: 'Carries a field report from observation to a local response.', stages: ['ob-intake', 'intake-correlation', 'correlation-review', 'review-dispatch', 'dispatch-steward'].map((relationId, index) => ({ id: `raise-${index}`, traversals: [{ id: `raise-${index}-a`, relationId, direction: 'forward' as const }] })) },
    { id: 'sense-change', name: 'Sense a change', payload: 'telemetry', summary: 'Turns ambient readings into a pattern ready for expert review.', stages: ['sn-intake', 'intake-correlation', 'correlation-review'].map((relationId, index) => ({ id: `sense-${index}`, traversals: [{ id: `sense-${index}-a`, relationId, direction: 'forward' as const }] })) },
    { id: 'close-loop', name: 'Close the loop', payload: 'field outcome', summary: 'Follows a verified alert through action and back into observation.', stages: ['review-dispatch', 'dispatch-steward', 'steward-habitat', 'habitat-observer', 'ob-intake'].map((relationId, index) => ({ id: `close-${index}`, traversals: [{ id: `close-${index}-a`, relationId, direction: 'forward' as const }] })) },
  ],
}

export function cloneSample(id = 'signal-garden'): OntologyDocument {
  const copy = structuredClone(SAMPLE_MAP)
  copy.id = id
  return copy
}
