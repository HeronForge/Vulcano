// Reference calculations: the simplified formulas behind A3 and A4, each shown with its
// inputs when used, never hidden. A calculation returns its value and the steps that led to
// it, so the reader can argue with every number.
const ADDED = '2026-09-19';

const step = (label, expression, value, unit = '') => ({ label, expression, value, unit });
const fmt = (n, d = 4) => (n == null || !Number.isFinite(n) ? '—' : Number(n.toPrecision(d)).toString());

export const CALCULATIONS = [
  {
    id: 'CALC-TUR', name: 'Test uncertainty ratio', formula: 'TUR = (USL − LSL) / (2 · U₉₅)',
    inputs: [{ key: 'span', label: 'Tolerance span USL − LSL', unit: 'unit of the measurand' }, { key: 'U', label: 'Expanded uncertainty of the measurement (k = 2)', unit: 'same' }],
    source: { kind: 'standard', ref: 'ANSI/NCSL Z540.3, ILAC-G8', added: ADDED },
    notes: 'The rule of thumb is 4:1; below 2:1 the measurement cannot tell a good unit from a bad one near the limit.',
    compute({ span, U }) {
      const tur = span > 0 && U > 0 ? span / (2 * U) : null;
      return { value: tur, unit: ':1', steps: [step('Span', `USL − LSL = ${fmt(span)}`, span), step('Uncertainty', `U₉₅ = ${fmt(U)}`, U), step('TUR', `${fmt(span)} / (2 · ${fmt(U)})`, tur)] };
    },
  },
  {
    id: 'CALC-UREQ', name: 'Required measurement uncertainty', formula: 'U_req = (USL − LSL) / (2 · TUR_target)',
    inputs: [{ key: 'span', label: 'Tolerance span', unit: 'measurand' }, { key: 'target', label: 'Target TUR', unit: ':1' }],
    source: { kind: 'standard', ref: 'ANSI/NCSL Z540.3', added: ADDED },
    compute({ span, target }) {
      const u = span > 0 && target > 0 ? span / (2 * target) : null;
      return { value: u, steps: [step('Required U₉₅', `${fmt(span)} / (2 · ${fmt(target)})`, u)] };
    },
  },
  {
    id: 'CALC-UINST', name: 'Instrument uncertainty from its accuracy specification', formula: 'U_inst = (a % · |reading| + offset) · k / √3 · 2',
    inputs: [{ key: 'percent', label: 'Accuracy, % of reading', unit: '%' }, { key: 'offset', label: 'Accuracy, offset', unit: 'measurand' }, { key: 'reading', label: 'Reading (the nominal)', unit: 'measurand' }],
    source: { kind: 'standard', ref: 'GUM (JCGM 100), rectangular distribution for a specification limit', added: ADDED },
    notes: 'A manufacturer’s accuracy specification is a limit, not a standard deviation: divided by √3 for the standard uncertainty, then × 2 for k = 2.',
    compute({ percent, offset, reading }) {
      const limit = Math.abs(reading || 0) * (percent || 0) / 100 + (offset || 0);
      const u = limit / Math.sqrt(3);
      const U = 2 * u;
      return { value: U, steps: [step('Specification limit', `${fmt(percent)} % · |${fmt(reading)}| + ${fmt(offset)}`, limit), step('Standard uncertainty', `${fmt(limit)} / √3`, u), step('Expanded (k = 2)', `2 · ${fmt(u)}`, U)] };
    },
  },
  {
    id: 'CALC-RSS', name: 'Combined uncertainty', formula: 'U = √(U₁² + U₂² + …)',
    inputs: [{ key: 'terms', label: 'Contributions (expanded, same k)', unit: 'measurand' }],
    source: { kind: 'standard', ref: 'GUM (JCGM 100), uncorrelated contributions', added: ADDED },
    compute({ terms }) {
      const list = (terms || []).filter((t) => Number.isFinite(t.value) && t.value > 0);
      const U = Math.sqrt(list.reduce((n, t) => n + t.value * t.value, 0));
      return { value: U, steps: [...list.map((t) => step(t.label, `${fmt(t.value)}²`, t.value * t.value)), step('Root sum of squares', `√(${list.map((t) => fmt(t.value * t.value)).join(' + ') || '0'})`, U)] };
    },
  },
  {
    id: 'CALC-GUARD', name: 'Guard band', formula: 'LSL_g = LSL + g · U ; USL_g = USL − g · U',
    inputs: [{ key: 'min', label: 'Low limit', unit: 'measurand' }, { key: 'max', label: 'High limit', unit: 'measurand' }, { key: 'U', label: 'Expanded uncertainty', unit: 'measurand' }, { key: 'g', label: 'Guard factor (1 = full uncertainty, 0.83 for 2 % false accept per ILAC-G8)', unit: '' }],
    source: { kind: 'standard', ref: 'ILAC-G8:2019', added: ADDED },
    notes: 'The limits the bench applies are tightened by the uncertainty so that a pass is a pass; what is lost is yield near the limit.',
    compute({ min, max, U, g = 1 }) {
      const lo = min == null ? null : min + g * U;
      const hi = max == null ? null : max - g * U;
      const collapsed = lo != null && hi != null && lo >= hi;
      return { value: { min: lo, max: hi, collapsed }, steps: [step('Guarded low', min == null ? '—' : `${fmt(min)} + ${fmt(g)} · ${fmt(U)}`, lo), step('Guarded high', max == null ? '—' : `${fmt(max)} − ${fmt(g)} · ${fmt(U)}`, hi)] };
    },
  },
  {
    id: 'CALC-PATH-R', name: 'Series resistance of the signal path', formula: 'R_path = Σ R_contact + R_switch + R_cable',
    inputs: [{ key: 'contacts', label: 'Contact resistances', unit: 'Ω' }, { key: 'switches', label: 'Switch contact resistances', unit: 'Ω' }, { key: 'cable', label: 'Cable resistance (length · Ω/m)', unit: 'Ω' }],
    source: { kind: 'experience', ref: 'bench-building practice', added: ADDED },
    notes: 'Its effect on a voltage measurement is I · R_path (two-wire) and nothing (four-wire); on a resistance measurement it adds directly.',
    compute({ contacts = [], switches = [], cable = 0 }) {
      const R = [...contacts, ...switches].reduce((n, r) => n + (r || 0), 0) + (cable || 0);
      return { value: R, unit: 'Ω', steps: [step('Contacts', contacts.map((x) => fmt(x)).join(' + ') || '0', contacts.reduce((n, r) => n + r, 0)), step('Switches', switches.map((x) => fmt(x)).join(' + ') || '0', switches.reduce((n, r) => n + r, 0)), step('Cable', fmt(cable), cable), step('Total', '', R)] };
    },
  },
  {
    id: 'CALC-SETTLE', name: 'Settling time of an RC path', formula: 't = −R · C · ln(ε)',
    inputs: [{ key: 'R', label: 'Source + path resistance', unit: 'Ω' }, { key: 'C', label: 'Capacitance of the path (cable + input)', unit: 'F' }, { key: 'epsilon', label: 'Residual error accepted (0.001 = 0.1 %)', unit: '' }],
    source: { kind: 'standard', ref: 'first-order RC response', added: ADDED },
    notes: 'Cable at 100 pF/m and a 10 MΩ input settle in milliseconds; a relay adds its operate time on top.',
    compute({ R, C, epsilon = 0.001 }) {
      const t = R > 0 && C > 0 ? -R * C * Math.log(epsilon) : 0;
      return { value: t, unit: 's', steps: [step('τ = R · C', `${fmt(R)} · ${fmt(C)}`, R * C, 's'), step('Settling', `−τ · ln(${epsilon})`, t, 's')] };
    },
  },
  {
    id: 'CALC-SWITCH-TIME', name: 'Cycle time added by switching', formula: 't = n_switch · (t_operate + t_settle)',
    inputs: [{ key: 'switches', label: 'Switch operations in the sequence', unit: '' }, { key: 'operate', label: 'Relay operate time', unit: 's' }, { key: 'settle', label: 'Settling after the switch', unit: 's' }],
    source: { kind: 'experience', ref: 'armature relay 5 ms, reed 1 ms, plus settling', added: ADDED },
    compute({ switches, operate = 0.005, settle = 0.01 }) {
      const t = (switches || 0) * ((operate || 0) + (settle || 0));
      return { value: t, unit: 's', steps: [step('Per switch', `${fmt(operate)} + ${fmt(settle)}`, operate + settle, 's'), step('Total', `${switches} · ${fmt(operate + settle)}`, t, 's')] };
    },
  },
  {
    id: 'CALC-COST-CHANNEL', name: 'Cost per channel of an instrument', formula: 'c = price / channels',
    inputs: [{ key: 'price', label: 'Instrument price', unit: 'currency' }, { key: 'channels', label: 'Channels of one unit', unit: '' }],
    source: { kind: 'experience', ref: 'bench-building practice', added: ADDED },
    compute({ price, channels }) {
      const c = channels > 0 ? price / channels : price;
      return { value: c, steps: [step('Per channel', `${fmt(price)} / ${channels}`, c)] };
    },
  },
  {
    id: 'CALC-STATIONS', name: 'Stations for a takt', formula: 'n = ⌈(t_cycle + t_handling) / takt⌉',
    inputs: [{ key: 'cycle', label: 'Cycle time of one unit', unit: 's' }, { key: 'handling', label: 'Load/unload time', unit: 's' }, { key: 'takt', label: 'Takt time', unit: 's' }],
    source: { kind: 'experience', ref: 'line balancing', added: ADDED },
    compute({ cycle, handling = 0, takt }) {
      const n = takt > 0 ? Math.ceil((cycle + handling) / takt) : null;
      return { value: n, steps: [step('Time per unit', `${fmt(cycle)} + ${fmt(handling)}`, cycle + handling, 's'), step('Stations', `⌈${fmt(cycle + handling)} / ${fmt(takt)}⌉`, n)] };
    },
  },
];

export const calculation = (id) => CALCULATIONS.find((c) => c.id === id);
export const runCalculation = (id, inputs) => {
  const c = calculation(id);
  if (!c) throw new Error(`Unknown calculation ${id}`);
  return { calculation: c, inputs, ...c.compute(inputs) };
};
