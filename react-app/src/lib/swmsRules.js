// SWMS rules read from the Creator export (SWMS form and the "PPE - ..." workflows).
export const HIGH_RISK = [
  'Falls', 'Mobile Plant', 'Electrical', 'Hot Works', 'Roadways', 'Dust', 'Telecom Towers', 'Excavation', 'Trench or Shaft', 'Water',
  'Asbestos', 'Hazardous Substances', 'Temperature', 'Gas Mains', 'Contaminated Atmosphere', 'Demolition', 'Tunnel', 'Confined Space',
  'Structural Alterations', 'Chemical Lines', 'Tilt-up or Precast',
];
export const HAZARD_LABEL = {
  Falls: 'Risk of a person falling more than 2 m', 'Mobile Plant': 'Movement of powered mobile plant',
  Electrical: 'On or near energised electrical installations', 'Hot Works': 'Hot works',
  Roadways: 'On or adjacent to roads or railways', Dust: 'Dust producing activities', 'Telecom Towers': 'Work near telecommunication towers',
  Excavation: 'Excavation using mechanical plant', 'Trench or Shaft': 'Trench or shaft deeper than 1.5 m', Water: 'In, over or near water',
  Asbestos: 'Asbestos removal or disturbance', 'Hazardous Substances': 'Hazardous substances and dangerous goods',
  Temperature: 'Artificial extremes of temperature', 'Gas Mains': 'On or near pressurised gas mains', 'Contaminated Atmosphere': 'Contaminated or flammable atmosphere',
  Demolition: 'Demolition', Tunnel: 'Tunnel', 'Confined Space': 'Confined space', 'Structural Alterations': 'Structural alterations needing temporary support',
  'Chemical Lines': 'On or near chemical, fuel or refrigerant lines', 'Tilt-up or Precast': 'Tilt-up or precast concrete',
};
export const PPE_LIST = [
  'Hi Visibility Clothing', 'Safety Boots', 'Hand Protection', 'Hearing Protection', 'Safety Glasses', 'Full Face Shield',
  'Face Mask', 'Breathing Apparatus', 'Hard Hat', 'Sun Protection', 'Fall Arrest Harness',
];
// Ticking one of these hazards ticks this PPE (exactly the six "PPE - ..." workflows in Creator).
export const PPE_RULES = {
  Falls: ['Fall Arrest Harness'],
  'Hot Works': ['Safety Boots', 'Safety Glasses', 'Hand Protection'],
  'Mobile Plant': ['Hi Visibility Clothing', 'Safety Boots'],
  Roadways: ['Hi Visibility Clothing', 'Safety Boots'],
  Dust: ['Safety Glasses', 'Face Mask', 'Hand Protection'],
  Demolition: ['Safety Boots', 'Safety Glasses', 'Hard Hat', 'Face Mask', 'Hand Protection', 'Hearing Protection'],
};
export const ppeFor = (hazards) => PPE_LIST.filter((p) => hazards.some((h) => (PPE_RULES[h] || []).includes(p)));

// SAMPLE wording only. Replace with the client's own Task Template records before real use.
export const TASK_TEMPLATES = [
  { task: 'Working at heights', risk: 'Fall from height', control: 'Use an EWP or scaffold run by a licensed operator, harness clipped on, exclusion zone below.' },
  { task: 'Crane or hiab lift', risk: 'Dropped load, contact with people or services', control: 'Licensed operator and dogman, lift plan, exclusion zone, check slings before each lift.' },
  { task: 'Sign removal', risk: 'Manual handling, sharp edges, dust', control: 'Two-person lift, gloves, dust controls, bag and tag fixings.' },
  { task: 'Electrical connection', risk: 'Electric shock', control: 'Licensed electrician isolates and tests. Lock-out tags in place.' },
];
