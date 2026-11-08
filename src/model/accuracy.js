// Accuracy and precision requirements — the advanced help behind the instrument choice. For
// each criterion: from its tolerance to the uncertainty the measurement may have, the
// contribution of the assigned instrument and of the contacts, the test uncertainty ratio, a
// guard band and a verdict. Per resource: the accuracy class it really needs, which is known
// before any instrument is chosen. Every number comes from a reference calculation with its
// steps kept.
import { runCalculation } from '../kb/calculations.js';
import { INSTRUMENT_CLASSES, classesForResource } from '../kb/reference.js';
import { EXPECTED_KIND } from './schema.js';
import { unitFamily, unitScale } from './spec.js';

export const VERDICTS = { adequate: 'Adequate', marginal: 'Marginal', inadequate: 'Inadequate', oneSided: 'One-sided limit', notJudged: 'Not judged', dutReported: 'Reported by the unit', noInstrument: 'No instrument assigned', computed: 'Computed' };

export const classAccuracy = (cls, family) => (cls.byFamily && cls.byFamily[family]) || cls.accuracy;

/**
 * `instrumentFor(resourceId)` returns `{ percent, offset, from, switching, classId }` or null;
 * `contactFor(pointId)` returns `{ resistance, qty, sense }` or null. Both come from the
 * project's assignments; with nothing assigned the per-criterion verdicts say so and the
 * per-resource requirement still stands.
 */
export function accuracyAnalysis(derived, { settings = {}, instrumentFor = () => null, contactFor = () => null } = {}) {
  const target = Number(settings.turTarget) || 4;
  const g = settings.guardFactor != null ? Number(settings.guardFactor) : 1;
  const rows = [];
  for (const c of derived.criteria) {
    const L = c.limits;
    const row = { criterion: c, stepId: c.stepId, code: derived.codes.get(c.stepId), quantity: c.quantity, text: c.text, unit: L.unit, resourceIds: c.resourceIds, verdict: 'notJudged', notes: [], calcs: [] };
    rows.push(row);
    if (L.kind !== EXPECTED_KIND.NUMERIC || !L.judged) continue;
    if (c.computed) { row.verdict = 'computed'; row.notes.push('Computed from other readings: its uncertainty follows theirs.'); continue; }
    const resourceId = c.resourceIds[0] || '';
    const resource = derived.index.get(resourceId);
    if (c.commandId && (!resource || /communication|controller/i.test(resource.category || ''))) { row.verdict = 'dutReported'; row.notes.push('The value is reported by the unit over a command: the bench adds no measurement uncertainty.'); continue; }
    const family = unitFamily(L.unit);
    const scale = unitScale(L.unit).factor;
    const nominal = L.nominal != null ? L.nominal : L.max != null ? L.max : L.min;
    row.reading = nominal;
    if (L.twoSided && L.span > 0) { const req = runCalculation('CALC-UREQ', { span: L.span, target }); row.required = { U: req.value, span: L.span, target }; row.calcs.push(req); }
    const inst = instrumentFor(resourceId);
    if (!inst) { row.verdict = 'noInstrument'; row.notes.push('Assign an instrument to see its margin.'); continue; }
    let acc = { percent: Number(inst.percent) || 0, offset: Number(inst.offset) || 0, from: inst.from };
    if (inst.classId) { const cls = INSTRUMENT_CLASSES.find((x) => x.id === inst.classId); if (cls && cls.byFamily && cls.byFamily[family]) acc = { ...classAccuracy(cls, family), from: `${inst.from} (${family})` }; }
    const u = runCalculation('CALC-UINST', { percent: acc.percent, offset: acc.offset / scale, reading: nominal || 0 });
    row.instrument = { U: u.value, percent: acc.percent, offset: acc.offset / scale, from: acc.from };
    row.calcs.push(u);
    const contributions = [];
    const contacts = c.pointIds.map((id) => contactFor(id)).filter(Boolean);
    const sensed = contacts.some((x) => x.sense);
    const switchR = inst.switching === 'mux' ? 0.1 : inst.switching === 'matrix' ? 0.2 : 0;
    const pathR = contacts.reduce((n, x) => n + (Number(x.resistance) || 0) / Math.max(1, Number(x.qty) || 1), 0) + switchR;
    if (family === 'resistance' && pathR > 0) contributions.push(sensed ? { label: 'Path resistance (four-wire: cancelled)', value: 0 } : { label: `Path resistance, two-wire (${contacts.length} contacts${switchR ? ' + switching' : ''})`, value: pathR / scale });
    else if (family === 'voltage' && pathR > 0) { const current = stimulusCurrent(derived, c); if (current) contributions.push({ label: `I·R drop on the path (${current} A × ${pathR.toFixed(3)} Ω)${sensed ? ', four-wire: cancelled' : ''}`, value: sensed ? 0 : (current * pathR) / scale }); }
    row.path = { contributions, resistance: pathR, sensed, switching: inst.switching || 'dedicated' };
    const rss = runCalculation('CALC-RSS', { terms: [{ label: 'Instrument', value: u.value }, ...contributions.map((t) => ({ label: t.label, value: t.value }))] });
    row.combined = { U: rss.value };
    row.calcs.push(rss);
    if (!(L.twoSided && L.span > 0)) {
      row.verdict = 'oneSided';
      const limit = L.max != null ? L.max : L.min;
      row.atLimit = { U: rss.value, limit, relative: limit ? rss.value / Math.abs(limit) : null };
      row.notes.push(`Uncertainty at the limit: ${fmt(rss.value)} ${L.unit}${row.atLimit.relative != null ? ` (${(row.atLimit.relative * 100).toFixed(2)} % of it)` : ''}.`);
      continue;
    }
    const tur = runCalculation('CALC-TUR', { span: L.span, U: rss.value });
    row.tur = tur.value; row.calcs.push(tur);
    row.verdict = tur.value == null ? 'notJudged' : tur.value >= target ? 'adequate' : tur.value >= target / 2 ? 'marginal' : 'inadequate';
    const guard = runCalculation('CALC-GUARD', { min: L.min, max: L.max, U: rss.value, g });
    row.guard = guard.value; row.calcs.push(guard);
    if (guard.value.collapsed) row.notes.push('Guard band collapses the limits: nothing can pass.');
  }
  const byResource = new Map();
  for (const row of rows) {
    if (!row.resourceIds.length || ['dutReported', 'computed', 'notJudged'].includes(row.verdict)) continue;
    const id = row.resourceIds[0];
    if (!byResource.has(id)) byResource.set(id, { resourceId: id, rows: [], tightestRelative: null, tightest: null, requiredPercent: null, requiredByFamily: {}, counts: {} });
    const agg = byResource.get(id);
    agg.rows.push(row);
    agg.counts[row.verdict] = (agg.counts[row.verdict] || 0) + 1;
    const L = row.criterion.limits;
    if (L.twoSided && L.nominal && L.toleranceAbsolute != null) {
      const rel = L.toleranceAbsolute / Math.abs(L.nominal);
      if (agg.tightestRelative == null || rel < agg.tightestRelative) { agg.tightestRelative = rel; agg.tightest = row; }
      // U_req = span / (2·target); U = 2·limit/√3 ⇒ limit = U_req·√3/2 ⇒ percent of reading
      const percent = (L.span / (2 * target)) * Math.sqrt(3) / 2 / Math.abs(L.nominal) * 100;
      if (agg.requiredPercent == null || percent < agg.requiredPercent) agg.requiredPercent = percent;
      const fam = unitFamily(L.unit) || 'other';
      if (agg.requiredByFamily[fam] == null || percent < agg.requiredByFamily[fam]) agg.requiredByFamily[fam] = percent;
    }
  }
  for (const agg of byResource.values()) {
    const resource = derived.index.get(agg.resourceId);
    const classes = resource ? classesForResource(resource) : [];
    const fits = (c) => (Object.keys(agg.requiredByFamily).length ? Object.entries(agg.requiredByFamily).every(([fam, pct]) => classAccuracy(c, fam).percent <= pct) : null);
    agg.classesFit = classes.map((c) => ({ cls: c, fits: fits(c) }));
    agg.classNeeded = (agg.classesFit.find((c) => c.fits) || {}).cls || null;
    agg.noneFits = agg.requiredPercent != null && !agg.classesFit.some((c) => c.fits);
    agg.alternatives = agg.noneFits ? INSTRUMENT_CLASSES.filter((c) => !classes.includes(c) && c.accuracy.percent > 0 && fits(c)).slice(0, 4) : [];
  }
  const summary = rows.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] || 0) + 1), m), {});
  return { rows, byResource, summary, target, guardFactor: g };
}

function stimulusCurrent(derived, criterion) {
  const st = derived.stimuli.find((s) => s.stepId === criterion.stepId && s.pointIds.some((p) => criterion.pointIds.includes(p)));
  if (!st) return null;
  const p = st.parameters.find((x) => unitFamily(x.unit) === 'current' && x.value != null);
  return p ? p.value * unitScale(p.unit).factor : null;
}

const fmt = (n) => (n == null || !Number.isFinite(n) ? '—' : Number(n.toPrecision(3)).toString());
