export type CanonicalTagId =
  | 'row'
  | 'mcq'
  | 'pic'
  | 'law'
  | 'license'
  | 'registration'
  | 'violations'
  | 'accidents'
  | 'signals'
  | 'expressway'
  | 'safe-driving'
  | 'vehicle-knowledge';

export const TAG_KEYWORDS: Record<CanonicalTagId, string[]> = {
  row: [],
  mcq: [],
  pic: [],

  law: ['laws', 'regulations', 'legal responsibility', 'rights', 'obligations'],
  license: ['driving license', 'probation', 'validity', 'replacement', 'reissue', 'revocation'],
  registration: ['registration', 'license plate', 'vehicle license', 'temporary plate', 'inspection', 'transfer'],
  violations: ['violation', 'punishment', 'fine', 'detain', 'drunk', 'drinking', 'drug', 'overloaded'],
  accidents: ['accident', 'scene', 'police', 'reporting', 'negotiation', 'leave the scene'],
  signals: ['traffic light', 'red light', 'green light', 'yellow light', 'sign', 'marking', 'hand signal'],
  expressway: ['expressway', 'highway', 'breakdown', 'emergency lane'],
  'safe-driving': ['safe driving', 'courteous', 'yield', 'parking', 'warning requirements'],
  'vehicle-knowledge': ['indicator', 'alarm light', 'oil pressure', 'brake', 'fuel', 'abs', 'srs', 'wiper', 'defrost', 'gear'],
};
