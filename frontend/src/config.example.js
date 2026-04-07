// Copy this file to config.js and fill in your values
// NEVER commit config.js to git

export const API_BASE_URL = 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod';

export const STAGES = [
  { id: 'label_validation', name: 'Label Validation', images: 1 },
  { id: 'oocyte_collection', name: 'Oocyte Collection', images: 1 },
  { id: 'denudation', name: 'Denudation', images: 1 },
  { id: 'male_sample_collection', name: 'Male Sample Collection', images: 2 },
  { id: 'icsi', name: 'ICSI', images: 1 },
  { id: 'icsi_documentation', name: 'ICSI Documentation', images: 0 },
  { id: 'culture', name: 'Culture', images: 1 }
];
