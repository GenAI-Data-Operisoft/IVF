/**
 * config.example.js
 *
 * Template for the runtime configuration file.
 * Copy this file to config.js and fill in the values from your AWS deployment.
 * config.js is gitignored and should never be committed to version control.
 */

// The base URL of the API Gateway REST API deployed in AWS.
// All frontend API calls are prefixed with this URL.
export const API_BASE_URL = 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod';

// The ordered list of IVF procedure stages.
// Each stage has an id (used as the DynamoDB key), a display name, and the
// number of images required before the AI validation can run.
// male_sample_collection requires 2 images because the tube has labels for
// both the male and female patient on opposite sides.
// icsi_documentation requires 0 because images are added one at a time
// without a fixed count.
export const STAGES = [
  { id: 'label_validation',       name: 'Label Validation',       images: 1 },
  { id: 'oocyte_collection',      name: 'Oocyte Collection',       images: 1 },
  { id: 'denudation',             name: 'Denudation',              images: 1 },
  { id: 'male_sample_collection', name: 'Male Sample Collection',  images: 2 },
  { id: 'icsi',                   name: 'ICSI',                    images: 1 },
  { id: 'icsi_documentation',     name: 'ICSI Documentation',      images: 0 },
  { id: 'culture',                name: 'Culture',                 images: 1 },
];
