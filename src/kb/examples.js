// Example data files, downloadable from the tool and written to docs/examples/ by the build:
// the shape of what each table of the database imports and exports. Every price is a
// placeholder to replace.

export const EXAMPLE_CATALOGUE = {
  format: 'vulcano-catalogue/1',
  name: 'Example instrument catalogue',
  currency: 'EUR',
  notes: 'Fictitious instruments that show the shape of the file: what the Instruments table imports and exports. classId links an instrument to a knowledge-base class; accuracy is the percent of reading on the main quantity; accessories are what can be ticked when the instrument is assigned; image is a file name in the IMG folder beside the HTML file.',
  instruments: [
    { id: 'ins_dmm_a', name: 'Bench DMM 6½ digits', maker: 'Acme Instruments', model: 'DM-6500', category: 'Electrical measurement', classId: 'dmm-6.5', channels: 1, interfaces: 'USB, LAN', accuracy: 0.0035, characteristics: 'DC voltage 0 … 1000 V; AC voltage 0 … 750 V; Resistance 0 … 100 MΩ; Accuracy ±0.0035 %', accessories: 'Test lead set 60; Rack mount kit 110; Multiplexer card, 20 channels 950', image: 'dm-6500.jpg', price: 1650, leadTimeWeeks: 3, notes: 'In the house library: driver available.' },
    { id: 'ins_daq_b', name: 'DAQ multimeter with 20-channel multiplexer', maker: 'Acme Instruments', model: 'DQ-970', category: 'Electrical measurement', classId: 'daq-mux', channels: 20, interfaces: 'USB, LAN', accuracy: 0.004, characteristics: 'DC voltage 0 … 300 V; AC voltage 0 … 300 V; Resistance 0 … 100 MΩ; Accuracy ±0.004 %', accessories: 'Multiplexer module, 20 channels 750', image: '', price: 2900, leadTimeWeeks: 4, notes: '300 V max: not for the mains terminals under hipot.' },
    { id: 'ins_scope_a', name: 'Oscilloscope 4 ch 200 MHz', maker: 'Wavecraft', model: 'WS-2204', category: 'Electrical measurement', classId: 'scope-4ch', channels: 4, interfaces: 'USB, LAN', accuracy: 1.5, characteristics: 'Bandwidth 200 MHz; Sample rate 2 GS/s; Probes 10:1, 500 V', accessories: 'Passive probe 10:1 90; Current probe 30 A 620', image: '', price: 4100, leadTimeWeeks: 2, notes: '' },
    { id: 'ins_acs_a', name: 'Three-phase programmable AC source 9 kVA', maker: 'Voltwerk', model: 'VP-9003', category: 'Power', classId: 'ac-source-3ph', channels: 3, interfaces: 'LAN', accuracy: 0.2, characteristics: 'Voltage 0 … 300 V per phase; Current 0 … 13 A per phase; Frequency 40 … 500 Hz', accessories: '', image: '', price: 24500, leadTimeWeeks: 10, notes: '13 A per phase: check against the 16 A the load stage draws.' },
    { id: 'ins_hipot_a', name: 'Electrical safety analyser 5 kV / 25 A', maker: 'Safetest', model: 'ST-9500', category: 'Safety', classId: 'safety-analyser', channels: 1, interfaces: 'USB, RS-232', accuracy: 1, characteristics: 'Test voltage 0 … 5 kV AC; Trip current 0.01 … 30 mA; Ground bond current 1 … 30 A', accessories: 'HV test lead set 140; Remote start box 260', image: '', price: 7400, leadTimeWeeks: 5, notes: 'One instrument for hipot and ground bond.' },
  ],
};

export const EXAMPLE_PARTS = {
  format: 'vulcano-parts/1',
  name: 'Example parts',
  currency: 'EUR',
  parts: [
    { id: 'prt_probe_13', name: 'Spring probe Ø 1.3 mm, wired, with receptacle', kind: 'probe', matches: 'Ø 1.3, 1.3 mm, spring probe', current: 3, resistance: 0.03, life: 1000000, channels: null, image: 'probe-13.jpg', price: 12, notes: '' },
    { id: 'prt_clip_4', name: 'Insulated 4 mm safety clip, 1000 V CAT II', kind: 'clip', matches: '4 mm, clip, banana', current: 20, resistance: 0.005, life: 10000, channels: null, image: '', price: 18, notes: '' },
    { id: 'prt_type2', name: 'Type 2 test-grade plug with cable', kind: 'connector', matches: 'type 2, socket, simulator cable', current: 32, resistance: 0.01, life: 10000, channels: null, image: '', price: 260, notes: 'Wears: cycle life is the maintenance interval.' },
    { id: 'prt_cyl', name: 'Pneumatic cylinder with valve and end sensors', kind: 'actuator', matches: 'press, push, present, mate', current: 0, resistance: 0, life: 1000000, channels: null, image: '', price: 620, notes: '' },
    { id: 'prt_relay', name: 'Relay channel on the interface board', kind: 'relay', matches: '', current: 2, resistance: 0.1, life: 10000000, channels: 1, image: '', price: 22, notes: 'One per point when an instrument is routed.' },
    { id: 'prt_relay_card', name: 'Relay multiplexer card, 16 channels, 2-wire', kind: 'relay', matches: '', current: 2, resistance: 0.1, life: 10000000, channels: 16, image: '', price: 680, notes: 'One card routes one instrument over up to 16 points.' },
  ],
};

export const EXAMPLE_RATE_CARD = {
  format: 'vulcano-ratecard/1',
  name: 'Example rates',
  currency: 'EUR',
  rates: [
    { id: 'rat_hardware', label: 'Hardware engineering', unit: 'h', price: 75 }, { id: 'rat_software', label: 'Software engineering', unit: 'h', price: 80 }, { id: 'rat_mechanical', label: 'Mechanical engineering', unit: 'h', price: 70 },
    { id: 'rat_test', label: 'Test engineering', unit: 'h', price: 65 }, { id: 'rat_management', label: 'Project management', unit: 'h', price: 90 }, { id: 'rat_onsite', label: 'Engineer on site', unit: 'day', price: 650 },
  ],
};

export const EXAMPLE_ITEMS = {
  format: 'vulcano-items/1',
  name: 'Example standard items and services',
  currency: 'EUR',
  items: [
    { id: 'itm_cabinet', name: 'Bench frame and cabinet, standard', kind: 'bench', unit: 'set', image: 'cabinet.jpg', price: 4500, notes: '' },
    { id: 'itm_safety', name: 'Safety circuit: interlocked guard, safety relay, e-stop', kind: 'safety', unit: 'set', image: '', price: 1400, notes: '' },
    { id: 'itm_fixture_pneumatic', name: 'Pneumatic bed-of-nails fixture, interlocked', kind: 'fixture', unit: 'pc', image: '', price: 9500, notes: '' },
    { id: 'itm_docs', name: 'Documentation set', kind: 'service', unit: 'set', image: '', price: 2600, notes: '' },
    { id: 'itm_fat', name: 'Factory and site acceptance tests', kind: 'service', unit: 'day', image: '', price: 650, notes: '' },
  ],
};

export const EXAMPLE_EXTENSION = {
  format: 'vulcano-kb/1',
  name: 'Example extension',
  notes: 'Declarative rules and checklist items added to the built-in knowledge base. Ids that match a built-in item replace it.',
  rules: [
    { id: 'X-RULE-01', title: 'Stage with no description', category: 'incompleteness', severity: 'info', rationale: 'A stage the reader cannot place is a stage nobody prices right.', blocks: ['statement of work'], when: { entity: 'stage', field: 'description', op: 'missing' }, message: '{{label}} has no description.', question: 'What is the purpose of {{label}}?', added: '2026-09-19' },
  ],
  checklists: [
    { id: 'X-CL-01', discipline: 'bench', situation: 'A temperature-related variable exists', title: 'Temperature chamber or ambient monitoring for {{name}}', why: 'A temperature the limits depend on is either controlled or recorded.', trigger: { entity: 'variable', field: 'unit', op: 'contains', value: ['°C'] }, source: { kind: 'experience', ref: 'our benches', added: '2026-09-19' } },
  ],
};
