// Copy this file to config.js and fill in your values
// config.js is gitignored — never commit real endpoints

export const API_BASE_URL = 'https://<your-api-id>.execute-api.ap-south-1.amazonaws.com/prod';

// Format date/time in IST for display
export const formatIST = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const STAGES = [
  { id: 'label_validation', name: 'Patient Verification', images: 1, subtitle: 'Dish validation' },
  { id: 'oocyte_collection', name: 'Oocyte Collection', images: 1, subtitle: 'Dish validation · COC/OCC image annotated with patient name and MPID' },
  { id: 'iui', name: 'IUI', images: 2, optional: true, subtitle: 'Male sperm sample image · Female sample image' },
  { id: 'denudation', name: 'Oocyte Morphology', images: 1, subtitle: 'Dish validation · Denuded oocyte image annotated with patient name and MPID' },
  { id: 'male_sample_collection', name: 'Sperm Preparation', images: 2, subtitle: 'Semen container image · Sperm processing tube image' },
  { id: 'icsi', name: 'ICSI/IVF', images: 1, subtitle: 'Dish validation · ICSI images annotated with patient name and MPID' },
  { id: 'fertilization_check', name: 'Fertilization Check (Day 1)', images: 1, subtitle: 'Dish validation · Fertilized oocyte annotated with patient name and MPID' },
  { id: 'icsi_documentation', name: 'Cleavage (Day 3)', images: 0, subtitle: 'Dish validation · Day 3 embryo images annotated with patient name and MPID' },
  { id: 'blastocyst', name: 'Blastocyst (Day 5)', images: 0, subtitle: 'Dish validation · Blastocyst images annotated with patient name and MPID' },
  { id: 'day6', name: 'Blastocyst (Day 6)', images: 0, subtitle: 'Dish validation · Blastocyst images annotated with patient name and MPID' },
  { id: 'day7', name: 'Blastocyst (Day 7)', images: 0, subtitle: 'Dish validation · Blastocyst images annotated with patient name and MPID' },
  { id: 'culture', name: 'Frozen Embryo Transfer (FET)', images: 1, subtitle: 'Cryostraw validation · Thawed embryo images annotated with patient name and MPID' }
];
