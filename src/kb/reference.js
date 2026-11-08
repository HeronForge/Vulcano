// Reference data of the knowledge base: the instrument classes a resource category maps to,
// the contact types a point can have and what each adds to the measurement, the switching
// topologies. Typical figures from catalogues and practice — every one is shown when used and
// none is applied silently. Dates and sources on each entry, as the scope requires.
const ADDED = '2026-09-19';
const CATALOGUE = { kind: 'experience', ref: 'typical catalogue figures, 2026', added: ADDED };

/**
 * Instrument classes per resource category. `accuracy` is the typical best specification as
 * (percent of reading, plus offset in the base unit); `costBand` is an order of magnitude in
 * EUR for one instrument; `channels` the usual count of one unit. A4 picks the class whose
 * accuracy meets the required uncertainty; C1 uses the same list as the candidate classes.
 * `byFamily` overrides the accuracy for a measurand family (a scope is ppm on frequency and
 * percent on volts).
 */
export const INSTRUMENT_CLASSES = [
  // Electrical measurement
  { id: 'dmm-6.5', category: 'Electrical measurement', family: 'DMM', label: '6½-digit bench multimeter', accuracy: { percent: 0.0035, offset: 0 }, byFamily: { current: { percent: 0.05, offset: 0 }, frequency: { percent: 0.01, offset: 0 } }, resolutionDigits: 6.5, channels: 1, speed: 'slow (≥ 20 ms per reading at full accuracy)', costBand: 1500, interfaces: ['USB', 'LAN', 'GPIB'], notes: 'Reference-class for DC volts and ohms; AC and current ranges are an order of magnitude worse.', source: CATALOGUE },
  { id: 'dmm-5.5', category: 'Electrical measurement', family: 'DMM', label: '5½-digit multimeter or DAQ multimeter', accuracy: { percent: 0.015, offset: 0 }, byFamily: { current: { percent: 0.1, offset: 0 }, frequency: { percent: 0.01, offset: 0 } }, resolutionDigits: 5.5, channels: 1, speed: 'medium', costBand: 800, interfaces: ['USB', 'LAN'], notes: 'The workhorse of a functional bench; with a multiplexer card it reads dozens of points.', source: CATALOGUE },
  { id: 'daq-mux', category: 'Electrical measurement', family: 'DAQ', label: 'DAQ / multiplexed measurement unit (per channel)', accuracy: { percent: 0.05, offset: 0 }, resolutionDigits: 4.5, channels: 20, speed: 'fast', costBand: 2500, interfaces: ['USB', 'LAN', 'PXI'], notes: 'One instrument, many channels: the accuracy is that of the internal meter plus the relay path.', source: CATALOGUE },
  { id: 'pxi-dmm', category: 'Electrical measurement', family: 'DMM', label: 'PXI/PXIe digital multimeter', accuracy: { percent: 0.005, offset: 0 }, resolutionDigits: 6.5, channels: 1, speed: 'fast', costBand: 2500, interfaces: ['PXI'], notes: 'Modular; pairs with switch modules in the same chassis.', source: CATALOGUE },
  { id: 'scope-4ch', category: 'Electrical measurement', family: 'Oscilloscope', label: 'Oscilloscope, 4 channels, 100–500 MHz', accuracy: { percent: 1.5, offset: 0 }, byFamily: { frequency: { percent: 0.01, offset: 0 }, time: { percent: 0.01, offset: 0 }, ratio: { percent: 0.5, offset: 0 } }, channels: 4, speed: 'fast', costBand: 4000, interfaces: ['USB', 'LAN'], notes: 'Timing and shape, not accuracy: ±1.5 % of full scale on vertical, ppm on time base.', source: CATALOGUE },
  { id: 'digitizer', category: 'Electrical measurement', family: 'Digitizer', label: 'PXI digitizer / fast DAQ', accuracy: { percent: 0.5, offset: 0 }, byFamily: { frequency: { percent: 0.01, offset: 0 }, time: { percent: 0.01, offset: 0 }, ratio: { percent: 0.2, offset: 0 } }, channels: 8, speed: 'fast', costBand: 3000, interfaces: ['PXI'], notes: 'Waveforms on many channels; less than a scope on bandwidth, more on channel count.', source: CATALOGUE },
  { id: 'power-analyser-0.1', category: 'Electrical measurement', family: 'Power analyser', label: 'Power analyser, class 0.1', accuracy: { percent: 0.1, offset: 0 }, byFamily: { frequency: { percent: 0.05, offset: 0 } }, channels: 3, speed: 'medium', costBand: 8000, interfaces: ['LAN', 'USB'], notes: 'Three voltage and three current channels, wattmeter-grade; the reference for an energy meter test.', source: CATALOGUE },
  { id: 'power-analyser-0.5', category: 'Electrical measurement', family: 'Power analyser', label: 'Power meter, class 0.5', accuracy: { percent: 0.5, offset: 0 }, channels: 1, speed: 'medium', costBand: 2500, interfaces: ['LAN', 'USB'], notes: 'Single-phase power and standby measurement.', source: CATALOGUE },
  { id: 'lcr', category: 'Electrical measurement', family: 'LCR meter', label: 'LCR meter', accuracy: { percent: 0.1, offset: 0 }, channels: 1, speed: 'medium', costBand: 2500, interfaces: ['USB', 'LAN'], notes: 'Capacitance, inductance and impedance at a set frequency.', source: CATALOGUE },
  { id: 'counter', category: 'Electrical measurement', family: 'Counter', label: 'Frequency counter / timer', accuracy: { percent: 0.0001, offset: 0 }, byFamily: { voltage: { percent: 5, offset: 0 } }, channels: 2, speed: 'fast', costBand: 1500, interfaces: ['USB', 'LAN'], notes: 'ppm-class on frequency and interval; the right instrument for trip times and PWM.', source: CATALOGUE },
  // Power
  { id: 'psu-lab', category: 'Power', family: 'DC supply', label: 'Programmable DC supply, lab grade', accuracy: { percent: 0.05, offset: 0.01 }, channels: 1, speed: 'medium', costBand: 1200, interfaces: ['USB', 'LAN'], notes: 'Sets and reads back voltage and current; the read-back is 0.05–0.1 %, good enough for a supply-current test but not for a meter test.', source: CATALOGUE },
  { id: 'psu-system', category: 'Power', family: 'DC supply', label: 'System DC supply, multi-output', accuracy: { percent: 0.1, offset: 0.02 }, channels: 2, speed: 'medium', costBand: 2500, interfaces: ['LAN', 'PXI'], notes: 'Two to four outputs in one box, sequencing and current read-back.', source: CATALOGUE },
  { id: 'psu-smu', category: 'Power', family: 'SMU', label: 'Source-measure unit', accuracy: { percent: 0.02, offset: 0 }, channels: 1, speed: 'fast', costBand: 4000, interfaces: ['USB', 'LAN', 'PXI'], notes: 'Source and measure in one, four quadrants, µA resolution: for quiescent current and leakage.', source: CATALOGUE },
  { id: 'ac-source-1ph', category: 'Power', family: 'AC source', label: 'Programmable AC source, single phase', accuracy: { percent: 0.2, offset: 0 }, channels: 1, speed: 'slow', costBand: 6000, interfaces: ['LAN', 'USB'], notes: 'Voltage and frequency programmable; power read-back is coarse.', source: CATALOGUE },
  { id: 'ac-source-3ph', category: 'Power', family: 'AC source', label: 'Programmable AC source, three phase', accuracy: { percent: 0.2, offset: 0 }, channels: 3, speed: 'slow', costBand: 25000, interfaces: ['LAN'], notes: 'Sized by the power the unit draws under load — usually the most expensive instrument on a mains-powered bench.', source: CATALOGUE },
  { id: 'mains-switched', category: 'Power', family: 'Mains', label: 'Switched mains with variac and isolation', accuracy: { percent: 2, offset: 0 }, channels: 1, speed: 'slow', costBand: 1500, interfaces: [], notes: 'When the specification tolerates the mains as it is: no programmability, but a tenth of the price.', source: CATALOGUE },
  // Load
  { id: 'eload-dc', category: 'Load', family: 'Electronic load', label: 'Electronic DC load', accuracy: { percent: 0.1, offset: 0 }, channels: 1, speed: 'medium', costBand: 1500, interfaces: ['USB', 'LAN'], notes: 'Constant current, resistance, power; sized by watts.', source: CATALOGUE },
  { id: 'eload-ac', category: 'Load', family: 'Electronic load', label: 'Electronic AC load', accuracy: { percent: 0.5, offset: 0 }, channels: 1, speed: 'medium', costBand: 8000, interfaces: ['LAN'], notes: 'Per phase; a resistive load bank is the cheap alternative when the current need not be programmable.', source: CATALOGUE },
  { id: 'load-resistive', category: 'Load', family: 'Load bank', label: 'Resistive load bank with contactors', accuracy: { percent: 5, offset: 0 }, channels: 1, speed: 'slow', costBand: 1200, interfaces: [], notes: 'Fixed steps; the current is whatever the resistors and the mains give.', source: CATALOGUE },
  // Safety
  { id: 'hipot', category: 'Safety', family: 'Hipot', label: 'Dielectric strength (hipot) tester', accuracy: { percent: 2, offset: 0 }, channels: 1, speed: 'slow', costBand: 3500, interfaces: ['USB', 'RS-232'], notes: 'AC/DC withstand, insulation resistance; needs an interlocked guard.', source: CATALOGUE },
  { id: 'safety-analyser', category: 'Safety', family: 'Safety analyser', label: 'Electrical safety analyser (hipot + ground bond + leakage)', accuracy: { percent: 1, offset: 0 }, channels: 1, speed: 'slow', costBand: 7000, interfaces: ['USB', 'LAN'], notes: 'One instrument for the whole safety stage, including the 25 A ground bond.', source: CATALOGUE },
  { id: 'rcd-tester', category: 'Safety', family: 'RCD tester', label: 'Residual current test set (AC/DC injection with timer)', accuracy: { percent: 1, offset: 0 }, channels: 1, speed: 'slow', costBand: 4000, interfaces: ['USB'], notes: 'Injects a set residual current and times the trip.', source: CATALOGUE },
  // Communication
  { id: 'comm-controller', category: 'Communication', family: 'Controller', label: 'Bench PC with serial, LAN, USB ports', accuracy: { percent: 0, offset: 0 }, channels: 4, speed: 'fast', costBand: 1500, interfaces: ['UART', 'RS-232', 'RS-485', 'Ethernet', 'USB'], notes: 'Industrial PC; add adapters per bus.', source: CATALOGUE },
  { id: 'can-interface', category: 'Communication', family: 'Bus adapter', label: 'CAN / CAN-FD / LIN interface, 2 channels', accuracy: { percent: 0, offset: 0 }, channels: 2, speed: 'fast', costBand: 800, interfaces: ['CAN', 'LIN'], notes: 'USB or PCIe; plus the transceivers the bus levels need.', source: CATALOGUE },
  { id: 'serial-adapter', category: 'Communication', family: 'Bus adapter', label: 'UART / RS-485 / RS-232 adapter, isolated', accuracy: { percent: 0, offset: 0 }, channels: 1, speed: 'fast', costBand: 150, interfaces: ['UART', 'RS-485', 'RS-232'], notes: 'Isolated, per port.', source: CATALOGUE },
  { id: 'wifi-ap', category: 'Communication', family: 'Radio', label: 'Bench access point / radio test set', accuracy: { percent: 0, offset: 0 }, channels: 1, speed: 'medium', costBand: 400, interfaces: ['Wi-Fi', 'Bluetooth'], notes: 'A controlled access point is enough for connectivity; RF performance needs a test set and a shielded box.', source: CATALOGUE },
  // Simulation / actuation / fixturing / optical / acoustic
  { id: 'simulator-custom', category: 'Vehicle simulation', family: 'Simulator', label: 'Application simulator (EV, sensor, load) — bought or built', accuracy: { percent: 1, offset: 0 }, channels: 1, speed: 'medium', costBand: 5000, interfaces: ['USB'], notes: 'Off-the-shelf when it exists for the application; otherwise an interface board with relays and references.', source: CATALOGUE },
  { id: 'decade-box', category: 'Sensor simulation', family: 'Simulator', label: 'Programmable resistance / decade box', accuracy: { percent: 0.1, offset: 0 }, channels: 1, speed: 'fast', costBand: 700, interfaces: ['USB'], notes: 'Stands in for an NTC or a potentiometer.', source: CATALOGUE },
  { id: 'relay-matrix', category: 'Fixturing', family: 'Switching', label: 'Relay matrix / multiplexer module (per 16 channels)', accuracy: { percent: 0, offset: 0 }, channels: 16, speed: 'fast', costBand: 900, interfaces: ['PXI', 'USB'], notes: 'Reed or armature; each contact adds resistance and a settling time.', source: CATALOGUE },
  { id: 'fixture-pneumatic', category: 'Fixturing', family: 'Fixture', label: 'Pneumatic bed-of-nails fixture, interlocked', accuracy: { percent: 0, offset: 0 }, channels: 1, speed: 'slow', costBand: 9000, interfaces: [], notes: 'Sized by the probe count and the board; the guard and its interlock are part of it.', source: CATALOGUE },
  { id: 'fixture-manual', category: 'Fixturing', family: 'Fixture', label: 'Manual clamp fixture', accuracy: { percent: 0, offset: 0 }, channels: 1, speed: 'slow', costBand: 3500, interfaces: [], notes: 'Lever or cam actuated; no pneumatics, no interlock needed for SELV.', source: CATALOGUE },
  { id: 'actuator-pneumatic', category: 'Mechanical actuation', family: 'Actuator', label: 'Pneumatic actuator with valve and sensors', accuracy: { percent: 0, offset: 0 }, channels: 1, speed: 'medium', costBand: 600, interfaces: ['digital I/O'], notes: 'Press a button, present a tag, mate a connector: one per action.', source: CATALOGUE },
  { id: 'actuator-servo', category: 'Mechanical actuation', family: 'Actuator', label: 'Electric linear axis / servo', accuracy: { percent: 0, offset: 0 }, channels: 1, speed: 'medium', costBand: 2500, interfaces: ['digital I/O', 'Ethernet'], notes: 'When the position or the force must be programmed.', source: CATALOGUE },
  { id: 'colorimeter', category: 'Optical', family: 'Optical', label: 'Colorimeter / luminance probe', accuracy: { percent: 2, offset: 0 }, channels: 1, speed: 'medium', costBand: 3000, interfaces: ['USB'], notes: 'With a light-tight hood.', source: CATALOGUE },
  { id: 'camera', category: 'Optical', family: 'Optical', label: 'Machine vision camera with lighting', accuracy: { percent: 5, offset: 0 }, channels: 1, speed: 'fast', costBand: 2500, interfaces: ['USB', 'Ethernet'], notes: 'Display content, LED states, presence.', source: CATALOGUE },
  { id: 'microphone', category: 'Acoustic', family: 'Acoustic', label: 'Measurement microphone with sound level meter', accuracy: { percent: 3, offset: 0 }, channels: 1, speed: 'medium', costBand: 2000, interfaces: ['USB'], notes: 'Buzzer and speaker tests; a quiet enclosure or a reference distance.', source: CATALOGUE },
  { id: 'dio', category: 'Digital I/O', family: 'DIO', label: 'Digital I/O module (per 32 lines)', accuracy: { percent: 0, offset: 0 }, channels: 32, speed: 'fast', costBand: 500, interfaces: ['USB', 'PXI'], notes: 'Relays, valves, presence sensors, interlock states.', source: CATALOGUE },
];

/** Which classes fit a resource, by category keyword and by what the resource is called. */
export function classesForResource(resource) {
  const t = `${resource.name} ${resource.category}`.toLowerCase();
  const by = (...ids) => ids.map((id) => INSTRUMENT_CLASSES.find((c) => c.id === id)).filter(Boolean);
  if (/hipot|dielectric|withstand/.test(t)) return by('hipot', 'safety-analyser');
  if (/residual|rcd|rcm/.test(t)) return by('rcd-tester', 'safety-analyser');
  if (/safety/.test(t)) return by('safety-analyser', 'hipot');
  if (/multimeter|dmm|voltmeter/.test(t)) return by('dmm-6.5', 'dmm-5.5', 'pxi-dmm', 'daq-mux');
  if (/oscillo|scope/.test(t)) return by('scope-4ch', 'digitizer');
  if (/power analy|wattmeter|energy/.test(t)) return by('power-analyser-0.1', 'power-analyser-0.5');
  if (/counter|timer/.test(t)) return by('counter', 'scope-4ch');
  if (/lcr|impedance/.test(t)) return by('lcr');
  if (/ac source|ac supply|mains|three phase/.test(t) && /source|supply|power/.test(t)) return by('ac-source-3ph', 'ac-source-1ph', 'mains-switched');
  if (/smu|source.?measure/.test(t)) return by('psu-smu', 'psu-lab');
  if (/supply|psu|source/.test(t) && !/load/.test(t)) return by('psu-lab', 'psu-system', 'psu-smu');
  if (/load/.test(t)) return /ac/.test(t) ? by('eload-ac', 'load-resistive') : by('eload-dc', 'load-resistive');
  if (/colorimet|lumin|optic|light/.test(t)) return by('colorimeter', 'camera');
  if (/camera|vision|display/.test(t)) return by('camera');
  if (/microph|acoust|sound/.test(t)) return by('microphone');
  if (/decade|resistance box|potentiometer|ntc/.test(t)) return by('decade-box', 'daq-mux');
  if (/simulat/.test(t)) return by('simulator-custom');
  if (/relay|matrix|multiplex|switch/.test(t)) return by('relay-matrix');
  if (/bed of nails|fixture|press/.test(t)) return by('fixture-pneumatic', 'fixture-manual');
  if (/actuat|tag|press|button|mechan/.test(t)) return by('actuator-pneumatic', 'actuator-servo');
  if (/can|lin\b/.test(t)) return by('can-interface', 'comm-controller');
  if (/communication|controller|uart|rs-?485|ethernet|serial/.test(t)) return by('comm-controller', 'serial-adapter', 'wifi-ap');
  if (/wi-?fi|bluetooth|radio|rf/.test(t)) return by('wifi-ap');
  if (/digital|i\/o|dio/.test(t)) return by('dio');
  if (/measurement/.test(t)) return by('dmm-5.5', 'daq-mux', 'dmm-6.5');
  if (/power/.test(t)) return by('psu-lab', 'psu-system');
  return by('daq-mux', 'dmm-5.5');
}

/**
 * Contact types: what a probe or a clip typically carries and adds. `resistance` in Ω,
 * `current` in A continuous, `force` in N, `life` in cycles; `sense` says the type gives a
 * four-wire connection by itself.
 */
export const CONTACT_TYPES = [
  { id: 'kelvin-probe', match: /kelvin probe|4-wire probe|four-wire probe/i, label: 'Kelvin (four-wire) probe', resistance: 0.02, current: 3, force: 2, life: 500000, sense: true, notes: 'Two contacts in one: force and sense.', source: CATALOGUE },
  { id: 'probe-0.9', match: /ø\s*0[.,]9|0[.,]9\s*mm|075/i, label: 'Spring probe Ø 0.9 mm', resistance: 0.05, current: 2, force: 1, life: 500000, sense: false, notes: 'Fine pitch; low current.', source: CATALOGUE },
  { id: 'probe-1.3', match: /ø\s*1[.,]3|1[.,]3\s*mm|100\s*mil/i, label: 'Spring probe Ø 1.3 mm', resistance: 0.03, current: 3, force: 1.5, life: 1000000, sense: false, notes: 'The standard test pad probe.', source: CATALOGUE },
  { id: 'probe-2', match: /ø\s*2\b|\b2\s*mm|\b2[.,]0\s*mm|156\s*mil/i, label: 'Spring probe Ø 2 mm', resistance: 0.02, current: 6, force: 3, life: 1000000, sense: false, notes: 'Power pads and connector pins.', source: CATALOGUE },
  { id: 'probe-generic', match: /probe|pogo|nail|\bpad/i, label: 'Spring probe (size not stated)', resistance: 0.03, current: 3, force: 1.5, life: 1000000, sense: false, notes: 'Size to be decided; Ø 1.3 mm assumed.', source: CATALOGUE },
  { id: 'kelvin-clip', match: /kelvin/i, label: 'Kelvin clip', resistance: 0.005, current: 25, force: 0, life: 20000, sense: true, notes: 'Manual; for ground bond and low-ohm measurements.', source: CATALOGUE },
  { id: 'clip-4mm', match: /4\s*mm|banana|clip|croc/i, label: 'Insulated 4 mm clip / banana', resistance: 0.005, current: 20, force: 0, life: 10000, sense: false, notes: 'Manual connection by the operator; rated 1000 V CAT II when insulated.', source: CATALOGUE },
  { id: 'connector-mated', match: /mated|mating|counterpart|receptacle|plug|socket|connector|pluggable/i, label: 'Mated connector', resistance: 0.01, current: 10, force: 20, life: 5000, sense: false, notes: 'The mating connector wears: its cycle life is the fixture’s maintenance interval.', source: CATALOGUE },
  { id: 'terminal-screw', match: /terminal|screw|ring lug|cable lug/i, label: 'Screw terminal / lug', resistance: 0.001, current: 32, force: 0, life: 1000, sense: false, notes: 'Manual, slow; a bench uses a clip or a quick-connect instead.', source: CATALOGUE },
  { id: 'cable', match: /cable|lead|harness|patch|wire|cord/i, label: 'Bench cable or lead', resistance: 0.01, current: 10, force: 0, life: 5000, sense: false, notes: 'A cable of the bench mated to the unit or to its own harness; its connector is the wear part.', source: CATALOGUE },
  { id: 'as-fitted', match: /as fitted|fitted|on-board|on board|built-in|internal/i, label: 'As fitted on the unit (no bench contact)', resistance: 0, current: 0, force: 0, life: 0, sense: false, notes: 'The unit’s own part; the bench touches nothing here.', source: CATALOGUE },
  { id: 'wireless', match: /\bair\b|wireless|radio|over the air|antenna|coupl|\btag\b|rfid|nfc|card/i, label: 'Over the air / coupled', resistance: 0, current: 0, force: 0, life: 0, sense: false, notes: 'No contact; the fixture fixes the distance.', source: CATALOGUE },
  { id: 'optical-acoustic', match: /optical|window|hood|microphone|sight|visual|camera|colorimet|lumin/i, label: 'Optical / acoustic, no contact', resistance: 0, current: 0, force: 0, life: 0, sense: false, notes: 'A window, a hood, a fixed distance.', source: CATALOGUE },
  { id: 'manual', match: /hand|finger|operator|manual|touch/i, label: 'By the operator', resistance: 0, current: 0, force: 0, life: 0, sense: false, notes: 'Operator action; no probe.', source: CATALOGUE },
  { id: 'unknown', match: /.*/, label: 'Contact type not stated', resistance: 0.03, current: 3, force: 1.5, life: 0, sense: false, notes: 'Assumed a spring probe until stated.', source: CATALOGUE },
];

export function contactTypeOf(text) {
  const t = String(text || '').trim();
  if (!t) return CONTACT_TYPES.find((c) => c.id === 'unknown');
  return CONTACT_TYPES.find((c) => c.id !== 'unknown' && c.match.test(t)) || CONTACT_TYPES.find((c) => c.id === 'unknown');
}

/** Switching topologies and what each adds to a path. */
export const SWITCHING = [
  { id: 'dedicated', label: 'Dedicated channel per point', addsResistance: 0, settling: 0, costPerChannel: 1, notes: 'One instrument channel wired to one point: fastest and cleanest, most channels.', source: CATALOGUE },
  { id: 'relay-mux', label: 'Relay multiplexer (1 instrument : N points)', addsResistance: 0.1, settling: 0.005, costPerChannel: 0.15, notes: 'Armature relays: ~100 mΩ contact, 5 ms settling, 10⁷ cycles; carries amps.', source: CATALOGUE },
  { id: 'reed-mux', label: 'Reed relay multiplexer', addsResistance: 0.15, settling: 0.001, costPerChannel: 0.12, notes: 'Faster and longer-lived than armature relays, but 1–2 A at most and a thermal EMF of a few µV.', source: CATALOGUE },
  { id: 'matrix', label: 'Relay matrix (M instruments × N points)', addsResistance: 0.2, settling: 0.005, costPerChannel: 0.4, notes: 'Any instrument to any point: two contacts in every path, and a matrix to keep in the driver.', source: CATALOGUE },
  { id: 'ssr', label: 'Solid-state switching', addsResistance: 0.5, settling: 0.0001, costPerChannel: 0.2, notes: 'No wear, no bounce; ohms of on-resistance and leakage, unfit for low-ohm or µA paths.', source: CATALOGUE },
];
