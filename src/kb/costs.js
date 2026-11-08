// Cost patterns: the lines a discipline always carries, and the quantity each one takes from
// the job — hours per channel, hours per stage, a share of the build. They seed the services
// and software sections of the realisation model and give the rate card its default
// structure. The factors are a starting point from practice; a rate card overrides them.
const ADDED = '2026-09-19';
const EXP = { kind: 'experience', ref: 'bench-building practice, 2026', added: ADDED };

/**
 * `driver` is what the quantity follows; `factor` multiplies the driver's count:
 *   fixed · perChannel (instrument channels of the bench) · perPoint · perResource
 *   perStage · perStep · perCriterion · perInterface · perCommand · perDriver (software drivers)
 *   perProbe · perActuator · perVariant · shareOfBuild (× the build hours of the same discipline)
 */
export const COST_PATTERNS = [
  // Hardware
  { id: 'CP-HW-DESIGN', discipline: 'signalPath', kind: 'design', label: 'Hardware design: interface board and wiring', unit: 'h', driver: 'perChannel', factor: 0.75, rateId: 'rate-hardware', source: EXP },
  { id: 'CP-HW-BUILD', discipline: 'signalPath', kind: 'build', label: 'Hardware build: board assembly, wiring, cabinet', unit: 'h', driver: 'perChannel', factor: 1.0, rateId: 'rate-hardware', source: EXP },
  { id: 'CP-HW-DEBUG', discipline: 'signalPath', kind: 'debug', label: 'Hardware debug', unit: 'h', driver: 'shareOfBuild', factor: 0.25, rateId: 'rate-hardware', source: EXP },
  { id: 'CP-HW-HARNESS', discipline: 'signalPath', kind: 'harness', label: 'Harness between fixture and interface board', unit: 'h', driver: 'perPoint', factor: 0.4, rateId: 'rate-hardware', source: EXP },
  // Software
  { id: 'CP-SW-FRAMEWORK', discipline: 'software', kind: 'framework', label: 'Sequencer set-up, project structure, report and logging', unit: 'h', driver: 'fixed', factor: 24, rateId: 'rate-software', source: EXP },
  { id: 'CP-SW-STEPS', discipline: 'software', kind: 'sequence', label: 'Test steps implementation', unit: 'h', driver: 'perStep', factor: 0.5, rateId: 'rate-software', source: EXP },
  { id: 'CP-SW-LIMITS', discipline: 'software', kind: 'limits', label: 'Limits file and per-variant limits', unit: 'h', driver: 'perCriterion', factor: 0.1, rateId: 'rate-software', source: EXP },
  { id: 'CP-SW-DRIVERS', discipline: 'software', kind: 'driver', label: 'Instrument and DUT drivers', unit: 'h', driver: 'perDriver', factor: 12, rateId: 'rate-software', source: EXP },
  { id: 'CP-SW-VARIANTS', discipline: 'software', kind: 'feature', label: 'Variant handling', unit: 'h', driver: 'perVariant', factor: 4, rateId: 'rate-software', source: EXP },
  { id: 'CP-SW-DEBUG', discipline: 'software', kind: 'debug', label: 'Software debug on the bench', unit: 'h', driver: 'shareOfBuild', factor: 0.35, rateId: 'rate-software', source: EXP },
  // Mechanics
  { id: 'CP-MX-DESIGN', discipline: 'fixture', kind: 'design', label: 'Fixture mechanical design', unit: 'h', driver: 'perProbe', factor: 0.5, base: 24, rateId: 'rate-mechanical', source: EXP },
  { id: 'CP-MX-BUILD', discipline: 'fixture', kind: 'build', label: 'Fixture build and probe wiring', unit: 'h', driver: 'perProbe', factor: 0.4, base: 16, rateId: 'rate-mechanical', source: EXP },
  { id: 'CP-MX-ACTUATOR', discipline: 'fixture', kind: 'actuator', label: 'Actuator design, build and tuning', unit: 'h', driver: 'perActuator', factor: 10, rateId: 'rate-mechanical', source: EXP },
  // Bench
  { id: 'CP-BN-CABINET', discipline: 'bench', kind: 'enclosure', label: 'Bench frame, cabinet, operator station', unit: 'set', driver: 'fixed', factor: 1, rateId: 'rate-bench-cabinet', source: EXP },
  { id: 'CP-BN-ELECTRICAL', discipline: 'bench', kind: 'power', label: 'Bench electrical: distribution, safety circuit, wiring', unit: 'h', driver: 'fixed', factor: 32, rateId: 'rate-hardware', source: EXP },
  // Services
  { id: 'CP-SV-PM', discipline: 'services', kind: 'management', label: 'Project management and customer meetings', unit: 'h', driver: 'shareOfBuild', factor: 0.1, rateId: 'rate-management', source: EXP },
  { id: 'CP-SV-DOCS', discipline: 'services', kind: 'documentation', label: 'Documentation', unit: 'h', driver: 'perStage', factor: 2, base: 16, rateId: 'rate-test', source: EXP },
  { id: 'CP-SV-FAT', discipline: 'services', kind: 'acceptance', label: 'FAT and SAT', unit: 'day', driver: 'fixed', factor: 3, rateId: 'rate-test-day', source: EXP },
  { id: 'CP-SV-TRAINING', discipline: 'services', kind: 'training', label: 'Training', unit: 'day', driver: 'fixed', factor: 1, rateId: 'rate-test-day', source: EXP },
  { id: 'CP-SV-COMMISSIONING', discipline: 'services', kind: 'commissioning', label: 'Commissioning on site', unit: 'day', driver: 'fixed', factor: 2, rateId: 'rate-test-day', source: EXP },
];

/** The rate card structure a builder starts from: hourly rates, day rates, and the usual bought items. */
export const DEFAULT_RATE_CARD = {
  format: 'vulcano-ratecard/1',
  name: 'Rate card template',
  currency: 'EUR',
  notes: 'A template generated by VULCANO from its cost patterns. Replace every price with your own; add items with the ids your realisation model elements use.',
  rates: [
    { id: 'rate-hardware', label: 'Hardware engineering', unit: 'h', price: 0 },
    { id: 'rate-software', label: 'Software engineering', unit: 'h', price: 0 },
    { id: 'rate-mechanical', label: 'Mechanical engineering', unit: 'h', price: 0 },
    { id: 'rate-test', label: 'Test engineering', unit: 'h', price: 0 },
    { id: 'rate-management', label: 'Project management', unit: 'h', price: 0 },
    { id: 'rate-test-day', label: 'Test engineer on site', unit: 'day', price: 0 },
    { id: 'rate-bench-cabinet', label: 'Bench frame and cabinet, standard', unit: 'set', price: 0 },
    { id: 'rate-probe', label: 'Spring probe with receptacle, wired', unit: 'pc', price: 0 },
    { id: 'rate-relay-channel', label: 'Relay channel on the interface board', unit: 'channel', price: 0 },
    { id: 'rate-cable-hv', label: 'HV-rated cable and connector set', unit: 'set', price: 0 },
    { id: 'rate-safety-set', label: 'Safety circuit set (relay, guard switch, e-stop)', unit: 'set', price: 0 },
    { id: 'rate-licence-seat', label: 'Sequencer deployment licence', unit: 'seat', price: 0 },
  ],
  instrumentClasses: {},
  parameters: { spareChannelShare: 0.1, contingencyShare: 0.05 },
};
