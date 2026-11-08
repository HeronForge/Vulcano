// B2 · The gap and consistency rules. Each rule is a record — what it looks for, why it
// matters, what it blocks, where it comes from — with a `check` that reads the derived tables
// and returns findings. A finding names the rule and the element it points at, and proposes
// the question to send up the chain. User extensions add rules of the declarative kind
// (`when` + `message`, see docs/KB-FORMAT.md); the built-in set needs code for the checks
// that compare numbers across entities.
import { EXCLUSION_MODE, EXPECTED_KIND, STEP_TYPE, VARIABLE_TYPE, expectedKind, expectedTextRef, filled, isSetup } from '../model/schema.js';
import { blockResources, parseQuantity, resolveValue, unitFamily, unitScale, variantExcludedStages } from '../model/spec.js';
import { callMap, findCycles, parallelGroupsDetailed, stageIndex, transitivePrerequisites } from '../model/stages.js';
import { actionVerbs } from '../model/entities.js';

const ADDED = '2026-09-19';
const EXPERIENCE = { kind: 'experience', ref: 'bench-building practice', added: ADDED };
const STD = (ref) => ({ kind: 'standard', ref, added: ADDED });

const CHAPTER_OF = { resource: 'resources', point: 'points', interface: 'interfaces', command: 'commands', variable: 'variables', variant: 'variants', stage: 'stages', step: 'stages', image: 'images', spec: 'testing', reference: 'references' };

const finding = (rule, ctx, { id = '', type = 'spec', message, question = '', blocks = rule.blocks, data = {}, severity = rule.severity }) => ({
  ruleId: rule.id, severity, elementId: id, elementType: type, chapter: CHAPTER_OF[type] || 'general',
  label: id ? ctx.label(id) : 'the specification', message, question, why: rule.rationale, blocks, data,
});

const numericCriterion = (row) => row.limits.kind === EXPECTED_KIND.NUMERIC;
const hasText = (text, terms) => { const t = String(text || '').toLowerCase(); return terms.some((k) => t.includes(k)); };
const isVoltageLike = (name, unit) => unitFamily(unit) === 'voltage' || /volt/i.test(name);
const isCurrentLike = (name, unit) => unitFamily(unit) === 'current' || /current/i.test(name);

export const RULES = [
  // ---------------------------------------------------------------- incompleteness ----------
  {
    id: 'R-INC-01', category: 'incompleteness', severity: 'error', title: 'Measurement with no acceptance criterion',
    rationale: 'A reading with nothing to judge it by cannot be written into the limits table, and the bench software will invent a limit or skip the check.',
    blocks: ['limits table (D2)', 'accuracy requirement (A4)', 'sequence skeleton (D1)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const row of ctx.derived.criteria) {
        const e = row.expected;
        const kind = expectedKind(e);
        let empty = false;
        if (kind === EXPECTED_KIND.NUMERIC) empty = row.limits.judged && row.limits.code !== 'NONE' && !filled(e.min) && !filled(e.max) && !filled(e.nominal);
        else if (kind === EXPECTED_KIND.STRING) empty = !filled(expectedTextRef(e));
        if (!empty) continue;
        out.push(finding(this, ctx, { id: row.stepId, type: 'step', message: `«${row.quantity}» is measured but no acceptance criterion is given${row.rowLabel ? ` (row «${row.rowLabel}»)` : ''}.`, question: `What is the acceptance criterion for «${row.quantity}» in ${ctx.label(row.stepId)} — limits, nominal and tolerance, or is the value only recorded?`, data: { criterionId: row.id } }));
      }
      return out;
    },
  },
  {
    id: 'R-INC-02', category: 'incompleteness', severity: 'warning', title: 'Numeric criterion with no unit',
    rationale: 'A limit without a unit is read in whatever unit the instrument returns; 5 mA and 5 A differ by the price of a resource.',
    blocks: ['limits table (D2)', 'accuracy requirement (A4)'], source: EXPERIENCE,
    check(ctx) {
      return ctx.derived.criteria.filter((r) => numericCriterion(r) && r.limits.judged && !r.limits.unit && (r.limits.min != null || r.limits.max != null || r.limits.nominal != null))
        .map((r) => finding(this, ctx, { id: r.stepId, type: 'step', message: `The criterion «${r.text}» on «${r.quantity}» states no unit.`, question: `In which unit is «${r.quantity}» (${ctx.label(r.stepId)}) judged?`, data: { criterionId: r.id } }));
    },
  },
  {
    id: 'R-INC-03', category: 'incompleteness', severity: 'warning', title: 'Resource with no characteristics',
    rationale: 'An instrument with no stated range or accuracy cannot be selected, priced or checked against what the steps ask of it.',
    blocks: ['instrument selection (C1)', 'quote line (A1)'], source: EXPERIENCE,
    check(ctx) {
      return (ctx.doc.resources || []).filter((r) => !(r.characteristics || []).some((c) => c.name || c.value))
        .map((r) => finding(this, ctx, { id: r.id, type: 'resource', message: `${ctx.label(r.id)} has no characteristics: no range, no accuracy, no channel count.`, question: `What must ${ctx.label(r.id)} be able to do — ranges, accuracy, channels, interfaces?` }));
    },
  },
  {
    id: 'R-INC-04', category: 'incompleteness', severity: 'error', title: 'Variable with no value',
    rationale: 'Every limit that follows the variable is undefined; every variant that does not override it inherits the gap.',
    blocks: ['limits table (D2)', 'every criterion that follows it'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const v of ctx.doc.variables || []) {
        const empty = v.type === VARIABLE_TYPE.RANGE ? String(v.min ?? '').trim() === '' && String(v.max ?? '').trim() === '' : String(v.value ?? '').trim() === '';
        if (!empty) continue;
        const used = ctx.derived.criteria.filter((c) => c.limits.variables.some((x) => x.id === v.id)).length;
        out.push(finding(this, ctx, { id: v.id, type: 'variable', message: `$${v.name} has no value${used ? `; ${used} criteria follow it` : ''}.`, question: `What is the value of $${v.name}${v.unit ? ` (${v.unit})` : ''}${v.description ? ` — ${v.description}` : ''}?` }));
      }
      return out;
    },
  },
  {
    id: 'R-INC-05', category: 'incompleteness', severity: 'warning', title: 'Application point marked on no picture',
    rationale: 'The fixture maker needs to see where the probe lands; a point with a name and no place on a drawing is a guess in the fixture.',
    blocks: ['fixture and probe list (E1)', 'probe map (E3)'], source: EXPERIENCE,
    check(ctx) {
      return (ctx.doc.points || []).filter((p) => !(p.markers || []).length)
        .map((p) => finding(this, ctx, { id: p.id, type: 'point', message: `${ctx.label(p.id)} is on no picture.`, question: `Where on the unit is ${ctx.label(p.id)} (${[p.connector, p.pin].filter(Boolean).join(' pin ')})? A marked drawing is needed for the fixture.` }));
    },
  },
  {
    id: 'R-INC-06', category: 'incompleteness', severity: 'warning', title: 'Application point with no contact type',
    rationale: 'The contact type decides the probe, its force, its current rating and what it adds to the measurement.',
    blocks: ['fixture and probe list (E1)', 'signal path (C2)', 'accuracy requirement (A4)'], source: EXPERIENCE,
    check(ctx) {
      return (ctx.doc.points || []).filter((p) => !String(p.contactType || '').trim())
        .map((p) => finding(this, ctx, { id: p.id, type: 'point', message: `${ctx.label(p.id)} states no contact type.`, question: `How is ${ctx.label(p.id)} to be contacted — spring probe (which diameter), clip, mated connector, by hand?` }));
    },
  },
  {
    id: 'R-INC-07', category: 'incompleteness', severity: 'error', title: 'Interface with no instrument that speaks it',
    rationale: 'Every command over the interface then counts on no resource: the bench count misses a channel and the quote misses an adapter.',
    blocks: ['resource table', 'instrument selection (C1)', 'command and driver table (D3)'], source: EXPERIENCE,
    check(ctx) {
      return (ctx.doc.interfaces || []).filter((i) => !i.resourceId).map((i) => {
        const commands = (ctx.doc.commands || []).filter((c) => c.interfaceId === i.id).length;
        return finding(this, ctx, { id: i.id, type: 'interface', severity: commands ? 'error' : 'info', message: `${ctx.label(i.id)} names no bench instrument${commands ? `; ${commands} commands run over it` : ''}.`, question: `Which bench instrument or adapter speaks ${ctx.label(i.id)} (${i.type})?` });
      });
    },
  },
  {
    id: 'R-INC-08', category: 'incompleteness', severity: 'info', title: 'Command defined only by reference',
    rationale: 'The driver cannot be written from this document; the referenced one must be available before the software effort is firm.',
    blocks: ['command and driver table (D3)', 'software effort (A1)'], source: EXPERIENCE,
    check(ctx) {
      return (ctx.doc.commands || []).filter((c) => c.referenceId && !String(c.requestFormat || '').trim() && !String(c.responseFormat || '').trim())
        .map((c) => finding(this, ctx, { id: c.id, type: 'command', message: `${ctx.label(c.id)} is defined in ${ctx.label(c.referenceId)} and carries no format here.`, question: `Is ${ctx.label(c.referenceId)} available to the bench builder, in the revision this specification assumes?` }));
    },
  },
  {
    id: 'R-INC-09', category: 'incompleteness', severity: 'warning', title: 'Image declared but not uploaded',
    rationale: 'The points marked on it cannot be seen; the fixture drawing has a hole where the picture should be.',
    blocks: ['probe map (E3)', 'fixture and probe list (E1)'], source: EXPERIENCE,
    check(ctx) {
      return (ctx.doc.images || []).filter((i) => !i.assetId || !(ctx.assets || {})[i.assetId])
        .map((i) => finding(this, ctx, { id: i.id, type: 'image', message: `${ctx.label(i.id)} has no picture file${ctx.source && ctx.source.format === 'tsw-authoring' ? ' (an authoring file cannot carry one)' : ''}.`, question: `Please provide the picture «${i.name}» with the application points marked.` }));
    },
  },
  {
    id: 'R-INC-10', category: 'incompleteness', severity: 'warning', title: 'Resource used with no application point',
    rationale: 'A stimulus or a reading that touches the unit somewhere unnamed is a harness wire nobody has drawn; DEDALO counts it as one channel of its own.',
    blocks: ['signal list and pin map (C3)', 'channel refinement (C2)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const u of ctx.derived.uses) {
        if (!u.resourceId || u.pointIds.length) continue;
        const resource = ctx.index.get(u.resourceId);
        const category = String((resource || {}).category || '').toLowerCase();
        // Instruments that do not touch the unit — a fixture press, a controller behind an interface — are not the case.
        if (/fixtur|mechan|actuat|communication|controller|simulat/.test(category) && u.kind === 'stimulus') continue;
        if (u.interfaceId) continue;
        out.push(finding(this, ctx, { id: u.stepId, type: 'step', message: `${ctx.label(u.stepId)} uses ${ctx.label(u.resourceId)} (${u.kind}) at no application point.`, question: `Where does ${ctx.label(u.resourceId)} connect for ${ctx.label(u.stepId)}? Name the application point (connector, pin).` }));
      }
      return out;
    },
  },
  {
    id: 'R-INC-11', category: 'incompleteness', severity: 'warning', title: 'Point that carries power with no electrical characteristics',
    rationale: 'A probe or a clip is chosen by the current and voltage it must carry; a supply applied to a point with no rating is a probe chosen blind.',
    blocks: ['fixture and probe list (E1)', 'signal path (C2)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const row of ctx.derived.points) {
        if ((row.point.characteristics || []).some((c) => isCurrentLike(c.name, c.unit) || isVoltageLike(c.name, c.unit))) continue;
        const powered = row.stimuli.filter((s) => s.parameters.some((p) => (isVoltageLike(p.name, p.unit) || isCurrentLike(p.name, p.unit)) && p.value != null));
        if (!powered.length) continue;
        out.push(finding(this, ctx, { id: row.point.id, type: 'point', message: `${ctx.label(row.point.id)} receives a stimulus (${ctx.label(powered[0].stepId)}) and states no max current or voltage.`, question: `What current and voltage must the contact at ${ctx.label(row.point.id)} withstand?` }));
      }
      return out;
    },
  },
  {
    id: 'R-INC-12', category: 'incompleteness', severity: 'info', title: 'No time on a resource or a command the cycle time counts',
    rationale: 'The cycle time estimate is the base of the throughput and of the station count; every missing time makes it optimistic.',
    blocks: ['cycle time', 'throughput (A7)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const r of ctx.derived.cycle.missing.resources) out.push(finding(this, ctx, { id: r.id, type: 'resource', message: `${ctx.label(r.id)} has no average time per use.`, question: `How long does one use of ${ctx.label(r.id)} take, settling included?` }));
      for (const c of ctx.derived.cycle.missing.commands) out.push(finding(this, ctx, { id: c.id, type: 'command', message: `${ctx.label(c.id)} has no nominal time.`, question: `How long does ${ctx.label(c.id)} take end to end?` }));
      return out;
    },
  },

  // ---------------------------------------------------------------- inconsistency -----------
  {
    id: 'R-CON-01', category: 'inconsistency', severity: 'error', title: 'Resource characteristics do not cover what a step asks of it',
    rationale: 'A 32 V supply asked for 48 V is either a wrong instrument in the appendix or a wrong step; either way the bench built from it fails.',
    blocks: ['instrument selection (C1)', 'quote line (A1)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      const seen = new Set();
      for (const st of ctx.derived.stimuli) {
        for (const resourceId of st.resourceIds) {
          const resource = ctx.index.get(resourceId);
          if (!resource) continue;
          for (const p of st.parameters) {
            const family = unitFamily(p.unit);
            if (!family || !p.values) continue;
            // The characteristics of the same kind: by name when one matches, else every one of the same unit family.
            const sameFamily = (resource.characteristics || []).map((c) => ({ c, q: parseQuantity(c.value, c.unit) })).filter(({ c, q }) => (q.max != null || q.min != null || q.list) && unitFamily(c.unit || q.unit) === family);
            if (!sameFamily.length) continue;
            const byName = sameFamily.filter(({ c }) => sameQuantityName(p.name, c.name, family));
            const candidates = byName.length ? byName : sameFamily;
            for (const v of p.values) {
              const n = v.range ? v.range.max : v.value;
              if (n == null) continue;
              const base = n * unitScale(p.unit).factor;
              const covered = candidates.some(({ q }) => (q.list ? q.list.some((x) => Math.abs(x - base) <= 1e-9 * Math.max(1, base)) : !(q.max != null && base > q.max * (1 + 1e-9)) && !(q.min != null && q.min > 0 && base < q.min * (1 - 1e-9))));
              if (covered) continue;
              const key = `${st.stepId}|${resourceId}|${p.name}`;
              if (seen.has(key)) continue;
              seen.add(key);
              const stated = candidates.map(({ c }) => `${c.name} ${c.value} ${c.unit}`.trim()).join('; ');
              out.push(finding(this, ctx, { id: st.stepId, type: 'step', message: `${ctx.label(st.stepId)} asks ${resource.name} for ${p.name} = ${v.text} ${p.unit}; the resource states ${stated}.`, question: `${ctx.label(resourceId)} is specified for ${stated}, but ${ctx.label(st.stepId)} applies ${p.name} = ${v.text} ${p.unit}. Which one is right, or is a different instrument meant?`, data: { resourceId, parameter: p.name } }));
            }
          }
        }
      }
      return out;
    },
  },
  {
    id: 'R-CON-02', category: 'inconsistency', severity: 'error', title: 'Stimulus above the rating of the point it is applied to',
    rationale: 'A probe rated 3 A with 10 A through it is a burnt contact and a wrong measurement; the rating and the stimulus must agree before the fixture is drawn.',
    blocks: ['fixture and probe list (E1)', 'signal path (C2)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const st of ctx.derived.stimuli) {
        for (const pointId of st.pointIds) {
          const point = ctx.index.get(pointId);
          if (!point) continue;
          for (const c of point.characteristics || []) {
            const cq = parseQuantity(c.value, c.unit);
            if (cq.max == null && cq.value == null) continue;
            const limit = cq.max != null ? cq.max : cq.value;
            const family = unitFamily(c.unit);
            if (!/max/i.test(c.name) || (family !== 'current' && family !== 'voltage')) continue;
            for (const p of st.parameters) {
              if (unitFamily(p.unit) !== family) continue;
              for (const v of p.values || []) {
                const n = v.range ? v.range.max : v.value;
                if (n == null) continue;
                if (n * unitScale(p.unit).factor > limit * (1 + 1e-9)) out.push(finding(this, ctx, { id: pointId, type: 'point', message: `${ctx.label(st.stepId)} applies ${p.name} = ${v.text} ${p.unit} at ${ctx.label(pointId)}, rated ${c.name} ${c.value} ${c.unit}.`, question: `${ctx.label(pointId)} is rated ${c.name} ${c.value} ${c.unit}; ${ctx.label(st.stepId)} applies ${v.text} ${p.unit}. Is the rating or the stimulus wrong?`, data: { stepId: st.stepId } }));
              }
            }
          }
        }
      }
      return out;
    },
  },
  {
    id: 'R-CON-03', category: 'inconsistency', severity: 'error', title: 'Criterion with inverted or empty limits',
    rationale: 'A low limit above the high one, or a tolerance of zero, passes nothing or everything.',
    blocks: ['limits table (D2)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const r of ctx.derived.criteria) {
        if (!numericCriterion(r) || !r.limits.judged) continue;
        const L = r.limits;
        if (L.code === 'EQT' && L.tolerance != null && L.tolerance <= 0) out.push(finding(this, ctx, { id: r.stepId, type: 'step', message: `«${r.quantity}»: tolerance ${L.tolerance} ${L.toleranceType === 'percent' ? '%' : L.unit} passes nothing but the exact value.`, question: `What is the tolerance on «${r.quantity}» (${ctx.label(r.stepId)})? A tolerance of ${L.tolerance} cannot be met by a real measurement.`, data: { criterionId: r.id } }));
        else if (L.min != null && L.max != null && !L.outside && L.min > L.max) out.push(finding(this, ctx, { id: r.stepId, type: 'step', message: `«${r.quantity}»: the low limit ${L.min} is above the high limit ${L.max} ${L.unit}.`, question: `The limits on «${r.quantity}» (${ctx.label(r.stepId)}) are ${L.min} … ${L.max} ${L.unit}: which way round?`, data: { criterionId: r.id } }));
      }
      return out;
    },
  },
  {
    id: 'R-CON-04', category: 'inconsistency', severity: 'error', title: 'Variable used where its type does not fit',
    rationale: 'A text variable in a numeric limit, a range where one number is expected, a number that is not a number: the bench reads it as garbage.',
    blocks: ['limits table (D2)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      const variables = ctx.derived.variables;
      const seen = new Set();
      for (const r of ctx.derived.criteria) {
        if (!numericCriterion(r)) continue;
        const e = r.expected;
        for (const slot of ['min', 'max', 'nominal', 'tolerance']) {
          const ref = e[slot];
          if (!ref || ref.mode !== 'variable') continue;
          const v = variables.get(ref.variableId);
          if (!v) { out.push(finding(this, ctx, { id: r.stepId, type: 'step', message: `«${r.quantity}» follows a variable that no longer exists.`, question: `Which variable does «${r.quantity}» (${ctx.label(r.stepId)}) follow?` })); continue; }
          const key = `${r.id}|${slot}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (v.type === VARIABLE_TYPE.TEXT || v.type === VARIABLE_TYPE.BOOLEAN || v.type === VARIABLE_TYPE.RANGE) {
            out.push(finding(this, ctx, { id: r.stepId, type: 'step', message: `«${r.quantity}» uses $${v.name} (${v.type}) as its ${slot}.`, question: `$${v.name} is a ${v.type} but ${ctx.label(r.stepId)} uses it as a numeric ${slot}: what value is meant?` }));
          } else if (v.type === VARIABLE_TYPE.NUMBER && String(v.value ?? '').trim() && Number.isNaN(Number(String(v.value).replace(',', '.')))) {
            out.push(finding(this, ctx, { id: v.id, type: 'variable', message: `$${v.name} is a number and its value «${v.value}» is not one.`, question: `What numeric value does $${v.name} take? It reads «${v.value}».` }));
          } else if (v.type === VARIABLE_TYPE.ENUM && v.allowedValues.length && !v.allowedValues.includes(String(v.value))) {
            out.push(finding(this, ctx, { id: v.id, type: 'variable', message: `$${v.name} is «${v.value}», not one of ${v.allowedValues.join(', ')}.`, question: `$${v.name} allows ${v.allowedValues.join(', ')} and is set to «${v.value}»: which is right?` }));
          }
        }
      }
      return out;
    },
  },
  {
    id: 'R-CON-05', category: 'inconsistency', severity: 'error', title: 'Variant excludes a stage another stage depends on',
    rationale: 'The dependant stage cannot start in that variant: either its prerequisite must change, or the variant must exclude it too.',
    blocks: ['sequence skeleton (D1)', 'quote per variant'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      const index = stageIndex(ctx.doc);
      for (const variant of ctx.doc.variants || []) {
        const excluded = new Set(variantExcludedStages(variant));
        if (!excluded.size) continue;
        // An overlay may also rewrite the prerequisites of the dependants: read them through the variant.
        const rewritten = new Map((variant.overlay || []).filter((op) => op.op === 'set' && op.path.length === 3 && op.path[0] === 'stages' && op.path[2] === 'prerequisites').map((op) => [op.path[1].slice(1), op.value]));
        for (const stage of ctx.doc.stages || []) {
          if (excluded.has(stage.id)) continue;
          const prereqs = rewritten.get(stage.id) || stage.prerequisites || [];
          for (const p of prereqs) if (excluded.has(p) && index.has(p)) out.push(finding(this, ctx, { id: stage.id, type: 'stage', message: `Variant «${variant.name}» excludes ${ctx.label(p)}, and ${ctx.label(stage.id)} depends on it.`, question: `In variant «${variant.name}», ${ctx.label(stage.id)} depends on ${ctx.label(p)}, which the variant excludes. What runs before it there?` }));
        }
      }
      return out;
    },
  },
  {
    id: 'R-CON-06', category: 'inconsistency', severity: 'warning', title: 'Held stimulus with no release in sight',
    rationale: 'A supply left on at the end of the sequence is a unit removed live, a press left down is a unit that cannot be taken out; the count of channels also stays high for every later stage.',
    blocks: ['sequence skeleton (D1)', 'safety checklist (C5)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      const releaseWords = ['release', 'down', 'off', 'discharge', 'disconnect', 'unmate', 'withdraw', 'open', 'unlock', 'stop', 'remove', 'return'];
      const calls = callMap(ctx.doc);
      for (const stage of ctx.doc.stages || []) {
        for (const held of stage.heldStimuli || []) {
          const step = ctx.index.get(held.stepId);
          const resourceId = step && step.stimulus ? (blockResources(step.stimulus, ctx.derived.interfaceOfCommand)[0] || '') : '';
          if (!resourceId) continue;
          const releaser = (ctx.doc.stages || []).find((s) => s.id !== stage.id && hasText(`${s.name} ${s.description}`, releaseWords) && ctx.derived.uses.some((u) => u.stageId === s.id && u.resourceId === resourceId && u.kind === 'stimulus'));
          const released = releaser && (!isSetup(releaser) || (calls.get(releaser.id) || []).length);
          if (released) continue;
          out.push(finding(this, ctx, { id: stage.id, type: 'stage', message: `${ctx.label(stage.id)} holds ${ctx.label(resourceId)} on exit (${held.note || ctx.label(held.stepId)}) and no called stage releases it.`, question: `${ctx.label(stage.id)} leaves ${ctx.label(resourceId)} applied. Where is it released before the unit is removed, and what happens on a failure in between?` }));
        }
      }
      return out;
    },
  },
  {
    id: 'R-CON-07', category: 'inconsistency', severity: 'warning', title: 'Setup stage never called',
    rationale: 'A routine nobody calls is either dead text or a step somebody forgot; both cost debug time on the bench.',
    blocks: ['sequence skeleton (D1)'], source: EXPERIENCE,
    check(ctx) {
      const calls = callMap(ctx.doc);
      return (ctx.doc.stages || []).filter((s) => isSetup(s) && !(calls.get(s.id) || []).length)
        .map((s) => finding(this, ctx, { id: s.id, type: 'stage', message: `${ctx.label(s.id)} is a setup stage no step calls.`, question: `${ctx.label(s.id)} is never called: where in the sequence does it run, or should it be dropped?` }));
    },
  },
  {
    id: 'R-CON-08', category: 'inconsistency', severity: 'info', title: 'Stage nothing depends on and nothing can run alongside',
    rationale: 'A dead end in the graph: either a missing prerequisite elsewhere, or a stage that only makes sense at the very end.',
    blocks: ['parallel stages decision (A2)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      const tests = (ctx.doc.stages || []).filter((s) => !isSetup(s));
      if (tests.length < 2) return out;
      const { groups } = parallelGroupsDetailed(ctx.doc);
      const dependants = new Map(tests.map((s) => [s.id, 0]));
      for (const s of tests) for (const p of s.prerequisites || []) if (dependants.has(p)) dependants.set(p, dependants.get(p) + 1);
      for (const s of tests) {
        if (dependants.get(s.id)) continue;
        const alone = (s.exclusions || {}).mode === EXCLUSION_MODE.ALL || groups.every((g) => !g.includes(s.id) || g.length === 1);
        if (!alone) continue;
        if (s === tests[tests.length - 1]) continue;
        out.push(finding(this, ctx, { id: s.id, type: 'stage', message: `${ctx.label(s.id)}: no stage depends on it and none may run alongside it.`, question: `${ctx.label(s.id)} is a dead end in the sequence: is a later stage missing its prerequisite, or is it meant to close the sequence?` }));
      }
      return out;
    },
  },
  {
    id: 'R-CON-09', category: 'inconsistency', severity: 'error', title: 'Prerequisites form a cycle',
    rationale: 'No order satisfies it; the sequence cannot be scheduled.',
    blocks: ['sequence skeleton (D1)', 'cycle time'], source: EXPERIENCE,
    check(ctx) { return findCycles(ctx.doc).map((cycle) => finding(this, ctx, { id: cycle[0], type: 'stage', message: `Prerequisite cycle: ${cycle.map((id) => ctx.label(id)).join(' → ')}.`, question: `The stages ${cycle.map((id) => ctx.codes.get(id)).join(', ')} depend on each other in a circle: which order is meant?` })); },
  },
  {
    id: 'R-CON-10', category: 'inconsistency', severity: 'error', title: 'Stage call that reaches no setup stage',
    rationale: 'A call to a test stage runs it twice; a call to nothing runs nothing.',
    blocks: ['sequence skeleton (D1)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const { step } of ctx.derived.steps) {
        if (step.type !== STEP_TYPE.STAGE_CALL) continue;
        const called = ctx.index.get(step.calledStageId);
        if (!called) out.push(finding(this, ctx, { id: step.id, type: 'step', message: `${ctx.label(step.id)} calls a stage that does not exist.`, question: `Which routine does ${ctx.label(step.id)} call?` }));
        else if (!isSetup(called)) out.push(finding(this, ctx, { id: step.id, type: 'step', message: `${ctx.label(step.id)} calls ${ctx.label(called.id)}, a test stage.`, question: `${ctx.label(step.id)} calls the test stage ${ctx.label(called.id)}: should it be a setup stage, or a prerequisite instead?` }));
      }
      return out;
    },
  },
  {
    id: 'R-CON-11', category: 'inconsistency', severity: 'warning', title: 'Criterion unit disagrees with the command that produces the value',
    rationale: 'A command decoded in mA judged in V is either a wrong decoding or a wrong criterion; the limits file will carry the mistake.',
    blocks: ['limits table (D2)', 'command and driver table (D3)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const r of ctx.derived.criteria) {
        if (!r.commandId || !numericCriterion(r)) continue;
        const command = ctx.index.get(r.commandId);
        const du = command && command.decoding ? command.decoding.unit : '';
        const declared = String((r.expected.unit || '')).trim();
        if (!du || !declared) continue;
        if (unitFamily(du) !== unitFamily(declared)) out.push(finding(this, ctx, { id: r.stepId, type: 'step', message: `«${r.quantity}» is judged in ${declared}, and ${ctx.label(r.commandId)} decodes to ${du}.`, question: `${ctx.label(r.commandId)} returns ${du} and ${ctx.label(r.stepId)} judges it in ${declared}: which unit is right?`, data: { criterionId: r.id } }));
      }
      return out;
    },
  },
  {
    id: 'R-CON-12', category: 'inconsistency', severity: 'warning', title: 'Two application points on the same connector pin',
    rationale: 'Two names for one pin double the probe in the fixture and split the readings in the report.',
    blocks: ['signal list and pin map (C3)', 'fixture and probe list (E1)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      const seen = new Map();
      for (const p of ctx.doc.points || []) {
        const key = `${String(p.connector || '').trim().toLowerCase()}|${String(p.pin || '').trim().toLowerCase()}`;
        if (!p.connector || !p.pin || /^[-—–]+$|^n\/a$/i.test(String(p.pin).trim())) continue;
        if (seen.has(key)) out.push(finding(this, ctx, { id: p.id, type: 'point', message: `${ctx.label(p.id)} and ${ctx.label(seen.get(key))} are both ${p.connector} pin ${p.pin}.`, question: `${ctx.label(p.id)} and ${ctx.label(seen.get(key))} name the same pin (${p.connector}.${p.pin}): one point or two?` }));
        else seen.set(key, p.id);
      }
      return out;
    },
  },
  {
    id: 'R-CON-13', category: 'inconsistency', severity: 'warning', title: 'Computed measurement reading from a step that comes later or reads nothing',
    rationale: 'The formula needs its inputs before it runs; an input that comes after it or produces no value cannot feed it.',
    blocks: ['sequence skeleton (D1)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const { test, step } of ctx.derived.steps) {
        if (!step.measurement || !step.measurement.computed) continue;
        const order = (test.steps || []).map((s) => s.id);
        const me = order.indexOf(step.id);
        for (const inputId of step.measurement.computed.inputStepIds || []) {
          const at = order.indexOf(inputId);
          const input = ctx.index.get(inputId);
          const reads = input && (input.measurement || input.type === STEP_TYPE.TABLE);
          if (at < 0 || at > me || !reads) out.push(finding(this, ctx, { id: step.id, type: 'step', message: `${ctx.label(step.id)} computes from ${at < 0 ? 'a step outside its test' : ctx.label(inputId)}${at > me ? ', which comes after it' : !reads ? ', which reads nothing' : ''}.`, question: `Which earlier readings does the formula «${step.measurement.computed.formula}» in ${ctx.label(step.id)} use?` }));
        }
        if (!(step.measurement.computed.inputStepIds || []).length) out.push(finding(this, ctx, { id: step.id, type: 'step', message: `${ctx.label(step.id)} is computed from no input.`, question: `From which readings is «${step.measurement.description}» (${ctx.label(step.id)}) computed?` }));
      }
      return out;
    },
  },

  // ---------------------------------------------------------------- unstated assumptions ----
  ...[
    ['R-ASM-01', 'No statement of temperature or environment', 'under which ambient conditions the limits hold', ['temperature', 'ambient', '°c', 'humidity', 'environment'], 'Every limit is read at some temperature; a bench in a hall at 35 °C with a specification silent on it fails units in summer.', 'Under which ambient conditions (temperature, humidity) are the limits valid, and must the bench monitor them?', ['accuracy requirement (A4)', 'bench checklist (C5)']],
    ['R-ASM-02', 'No statement on what happens on failure', 'what happens when a step fails', ['fail', 'retest', 'reject', 'rework', 'scrap', 'stop on', 'continue on'], 'Stop at the first failure, run to the end, retest once: three different sequences and three different cycle times.', 'On a failed step, does the sequence stop, continue, or retry? How many retests are allowed, and how is a failed unit marked and handled?', ['sequence skeleton (D1)', 'software scope (D4)']],
    ['R-ASM-03', 'No serial number or traceability requirement', 'whether serial numbers are read and results traced', ['serial', 'traceab', 'barcode', 'label', 'mes ', 'database', 'data logging'], 'Reading a serial number, printing a label, sending results to a MES: each is software the quote must carry, or leave out on purpose.', 'Must the bench read or write a serial number, print a label, and send results to a MES or database? In which format?', ['software scope (D4)', 'quote line (A1)']],
    ['R-ASM-04', 'No calibration requirement', 'how and how often the bench is calibrated', ['calibrat', 'verification of the bench', 'self-test', 'golden'], 'Instruments drift; a specification that says nothing about calibration intervals or bench self-test leaves the accuracy claim to chance.', 'What calibration interval and bench self-test are required, and who performs them?', ['bench checklist (C5)', 'services (A1)']],
    ['R-ASM-05', 'No statement of who supplies the DUT harness or the golden sample', 'who supplies the harness, the mating connectors and the golden samples', ['harness', 'mating cable', 'golden', 'reference unit', 'master sample', 'supplied by'], 'Mating connectors, cables and a known-good unit for debug are either the customer’s or a cost line of the builder.', 'Who supplies the mating connectors, the DUT harness and the golden samples for debug and FAT, and how many?', ['services (A1)', 'fixture (E1)']],
    ['R-ASM-06', 'No stated production volume or takt', 'what production volume or takt the bench must meet', ['volume', 'takt', 'units per', 'pieces', 'pcs', 'throughput', 'per hour', 'per shift', 'per year'], 'The number of stations, the handling concept and the level of automation all follow from the volume; without it the quote is for one bench by default.', 'What production volume or takt time must the bench meet, on how many shifts?', ['throughput (A7)', 'quote (A1)']],
    ['R-ASM-07', 'No report or result format', 'what the bench reports and in which format', ['report', 'result', 'record', 'log file', 'csv', 'xml', 'pdf'], 'Every bench writes results somewhere; the format decides a day or a month of software.', 'What must the bench report contain, in which format, and where is it stored?', ['software scope (D4)', 'report schema (D6)']],
    ['R-ASM-08', 'No statement on operator versus automatic operation', 'whether an operator or a handler loads and runs the unit', ['operator', 'manual', 'automatic', 'handler', 'unattended', 'by hand'], 'A unit loaded by hand and a unit fed by a handler are two different machines.', 'Is the unit loaded, connected and started by an operator, or by a handler? What does the operator do during the test?', ['fixture concept (E2)', 'quote (A1)']],
  ].map(([id, title, statement, terms, rationale, question, blocks]) => ({
    id, category: 'assumption', severity: 'info', title, rationale, blocks, source: EXPERIENCE,
    check(ctx) {
      const text = `${ctx.doc.description.testing || ''}\n${ctx.doc.description.product || ''}\n${ctx.doc.header.disclaimer || ''}`;
      if (hasText(text, terms)) return [];
      if (id === 'R-ASM-01' && (ctx.doc.variables || []).some((v) => /°c|temp/i.test(`${v.unit} ${v.name}`))) return [];
      return [finding(this, ctx, { message: `The specification does not say ${statement}.`, question })];
    },
  })),
  {
    id: 'R-ASM-09', category: 'assumption', severity: 'warning', title: 'Hazardous voltage or current with no safety statement',
    rationale: 'A hipot stage or a mains source on the bench is an interlock, a guard, a category of the safety circuit and trained operators — none of which the steps say.',
    blocks: ['bench checklist (C5)', 'services (A1)'], source: STD('IEC 61010-1, EN ISO 13849-1'),
    check(ctx) {
      const hazards = hazardousStimuli(ctx);
      if (!hazards.length) return [];
      const text = `${ctx.doc.description.testing || ''}\n${ctx.doc.header.disclaimer || ''}`;
      if (hasText(text, ['interlock', 'guard', 'safety', 'emergency', 'hazard', 'qualified', 'ppe'])) return [];
      return [finding(this, ctx, { message: `${hazards.length} stimuli reach hazardous levels (${hazards.slice(0, 3).map((h) => `${ctx.codes.get(h.stepId)} ${h.text}`).join('; ')}${hazards.length > 3 ? '…' : ''}) and the specification states no safety requirement.`, question: `Stimuli reach ${hazards[0].text}: which safety measures does the customer require of the bench — interlocked guard, two-hand start, safety category, operator qualification?`, data: { hazards } })];
    },
  },
  {
    id: 'R-ASM-10', category: 'assumption', severity: 'info', title: 'Bare board contacted by probes with no ESD statement',
    rationale: 'A bed of nails on a bare board is an ESD path; whether the bench needs an ESD-safe fixture and operator earthing is a cost line.',
    blocks: ['fixture concept (E2)', 'bench checklist (C5)'], source: STD('IEC 61340-5-1'),
    check(ctx) {
      const probes = (ctx.doc.points || []).some((p) => /probe|pogo|pad|nail/i.test(p.contactType || ''));
      if (!probes) return [];
      if (hasText(`${ctx.doc.description.testing} ${ctx.doc.description.product}`, ['esd', 'electrostatic'])) return [];
      return [finding(this, ctx, { message: 'The unit is contacted by spring probes and the specification says nothing about ESD.', question: 'Is the unit ESD sensitive as tested? Which ESD measures must the fixture and the operator station provide?' })];
    },
  },

  // ---------------------------------------------------------------- cost drivers ------------
  {
    id: 'R-COST-01', category: 'costDriver', severity: 'warning', title: 'A very tight tolerance forces an instrument class',
    rationale: 'One criterion at 0.05 % turns a 4½-digit meter into a 6½-digit one for the whole bench; the reader should know which criterion it is and whether it is meant.',
    blocks: ['instrument selection (C1)', 'accuracy requirement (A4)', 'quote line (A1)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const r of ctx.derived.criteria) {
        const L = r.limits;
        if (!numericCriterion(r) || !L.twoSided || L.nominal == null || L.nominal === 0 || L.toleranceAbsolute == null) continue;
        const relative = L.toleranceAbsolute / Math.abs(L.nominal);
        if (relative >= 0.001 || relative <= 0) continue;
        const resource = r.resourceIds.map((id) => ctx.label(id)).join(', ');
        out.push(finding(this, ctx, { id: r.stepId, type: 'step', message: `«${r.quantity}» is ${r.text}: ±${(relative * 100).toFixed(3)} % relative${resource ? ` on ${resource}` : ''}.`, question: `«${r.quantity}» (${ctx.label(r.stepId)}) is judged to ±${(relative * 100).toFixed(3)} %, which forces a reference-class instrument. Is that tolerance meant, or is it a design value copied into the test?`, data: { criterionId: r.id, relative } }));
      }
      return out;
    },
  },
  {
    id: 'R-COST-02', category: 'costDriver', severity: 'info', title: 'A single stage sets the channel count of a resource',
    rationale: 'When one stage alone needs most of the channels, splitting it or switching it changes the instrument bought.',
    blocks: ['switching decision (A2)', 'channel refinement (C2)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const row of ctx.derived.resources.rows) {
        if (row.maxChannels < 4 || row.channelsPerStage.size < 2) continue;
        for (const [stageId, n] of row.channelsPerStage) {
          if (n * 2 >= row.maxChannels && n >= 4) out.push(finding(this, ctx, { id: row.resource.id, type: 'resource', message: `${ctx.label(stageId)} alone needs ${n} of the ${row.maxChannels} channels of ${ctx.label(row.resource.id)}.`, question: '', data: { stageId, channels: n } }));
        }
      }
      return out;
    },
  },
  {
    id: 'R-COST-03', category: 'costDriver', severity: 'info', title: 'Table step with many rows on a slow command',
    rationale: 'Rows multiply the command time; a 20-row table on a 0.5 s command is ten seconds of cycle time in one step.',
    blocks: ['cycle time', 'throughput (A7)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const { step } of ctx.derived.steps) {
        if (step.type !== STEP_TYPE.TABLE) continue;
        const rows = ((step.table || {}).rows || []).length;
        let perRow = 0;
        for (const c of (step.table || {}).columns || []) if (c.commandId) perRow += Number(((ctx.index.get(c.commandId) || {}).nominalTime || '0').replace(',', '.')) || 0;
        const total = rows * perRow;
        if (rows >= 6 && total >= 5) out.push(finding(this, ctx, { id: step.id, type: 'step', message: `${ctx.label(step.id)}: ${rows} rows × ${perRow} s of commands = ${total.toFixed(1)} s.`, question: '', data: { rows, total } }));
      }
      return out;
    },
  },
  {
    id: 'R-COST-04', category: 'costDriver', severity: 'warning', title: 'Physical action with no actuator among the resources',
    rationale: 'A press, a mate, a rotation done by nobody is an actuator to design or an operator to keep — either one is a line in the quote.',
    blocks: ['fixture and probe list (E1)', 'fixture concept (E2)', 'quote line (A1)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const st of ctx.derived.stimuli) {
        if (st.table) continue;
        const step = ctx.index.get(st.stepId);
        const verbs = actionVerbs(`${st.description} ${step ? step.description : ''}`);
        if (!verbs.length) continue;
        if (st.commandId) continue;
        const categories = st.resourceIds.map((id) => String((ctx.index.get(id) || {}).category || '').toLowerCase());
        if (categories.some((c) => /actuat|fixtur|mechan|handl|simulat/.test(c))) continue;
        const parametersOnly = st.parameters.some((p) => isVoltageLike(p.name, p.unit) || isCurrentLike(p.name, p.unit) || /freq|duty|resist/i.test(p.name));
        if (parametersOnly && st.resourceIds.length) continue;
        out.push(finding(this, ctx, { id: st.stepId, type: 'step', message: `${ctx.label(st.stepId)} «${st.description}» (${verbs.join(', ')}) names no actuator${st.resourceIds.length ? ` — its resource is ${st.resourceIds.map((id) => ctx.label(id)).join(', ')}` : ''}.`, question: `Who or what performs «${st.description}» in ${ctx.label(st.stepId)} — the operator, or an actuator the bench must provide?`, data: { verbs } }));
      }
      return out;
    },
  },
  {
    id: 'R-COST-05', category: 'costDriver', severity: 'info', title: 'Hazardous voltage or current on the bench',
    rationale: 'Above 50 V AC / 120 V DC or above 10 A the bench carries a guard, an interlock, rated cabling and contacts, and a safety circuit with a category.',
    blocks: ['bench checklist (C5)', 'signal path (C2)', 'fixture and probe list (E1)'], source: STD('IEC 61010-1'),
    check(ctx) {
      const hazards = hazardousStimuli(ctx);
      return hazards.map((h) => finding(this, ctx, { id: h.stepId, type: 'step', message: `${ctx.label(h.stepId)} applies ${h.text} at ${h.pointIds.map((id) => ctx.codes.get(id)).join(', ') || 'an unnamed point'}.`, question: '', data: h }));
    },
  },
  {
    id: 'R-COST-06', category: 'costDriver', severity: 'info', title: 'Optical, acoustic or radio measurements need a controlled environment',
    rationale: 'A colorimeter needs a hood, a microphone a quiet box, a radio a known field: each is an enclosure the resources do not list.',
    blocks: ['fixture concept (E2)', 'bench checklist (C5)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const r of ctx.doc.resources || []) {
        const t = `${r.name} ${r.category}`.toLowerCase();
        const kind = /optic|colorimet|camera|lumin|photo/.test(t) ? 'optical (a light-tight hood)' : /acoust|microph|sound/.test(t) ? 'acoustic (a quiet enclosure or a reference distance)' : /rf|radio|wi-fi|wifi|bluetooth|lte|antenna|wireless/.test(t) ? 'radio (a shielded box or a controlled field)' : '';
        if (kind) out.push(finding(this, ctx, { id: r.id, type: 'resource', message: `${ctx.label(r.id)} involves a${/^[aeiou]/.test(kind) ? 'n' : ''} ${kind} measurement.`, question: '', data: { kind } }));
      }
      for (const i of ctx.doc.interfaces || []) if (/wi-fi|wifi|bluetooth|lte|zigbee|lora|nfc|rfid|wireless/i.test(`${i.name} ${i.type}`)) out.push(finding(this, ctx, { id: i.id, type: 'interface', message: `${ctx.label(i.id)} is over the air: the bench decides where the field is.`, question: '', data: { kind: 'radio' } }));
      return out;
    },
  },
  {
    id: 'R-COST-07', category: 'costDriver', severity: 'info', title: 'Several product variants',
    rationale: 'Variant handling — selection, per-variant limits, excluded stages, per-variant fixtures — is software and sometimes mechanics.',
    blocks: ['software scope (D4)', 'fixture concept (E2)'], source: EXPERIENCE,
    check(ctx) {
      const n = (ctx.doc.variants || []).length;
      if (n < 2) return [];
      const excluded = (ctx.doc.variants || []).filter((v) => variantExcludedStages(v).length).length;
      return [finding(this, ctx, { message: `${n} variants, ${excluded} of which exclude stages.`, question: `How does the bench know which of the ${n} variants is under test — a scan, a selection by the operator, a read from the unit?` })];
    },
  },
  {
    id: 'R-COST-08', category: 'costDriver', severity: 'info', title: 'Long dwell in a single step',
    rationale: 'A ten-second wait in one step is a tenth of a minute of cycle time nothing else can hide; it is where parallel stages pay off.',
    blocks: ['cycle time', 'parallel stages decision (A2)'], source: EXPERIENCE,
    check(ctx) {
      const out = [];
      for (const { step } of ctx.derived.steps) {
        const w = step.wait || {};
        const r = resolveValue(w.value, ctx.derived.variables, w.unit);
        const n = r.value != null ? r.value : Number(r.text);
        if (!Number.isFinite(n)) continue;
        const s = String(r.unit || 's').toLowerCase() === 'ms' ? n / 1000 : String(r.unit || 's').toLowerCase() === 'min' ? n * 60 : n;
        if (s >= 5) out.push(finding(this, ctx, { id: step.id, type: 'step', message: `${ctx.label(step.id)} waits ${r.text} ${r.unit}.`, question: '', data: { seconds: s } }));
      }
      return out;
    },
  },
  {
    id: 'R-COST-09', category: 'costDriver', severity: 'info', title: 'KPI tests become acceptance tests of the bench',
    rationale: 'A test the customer marks as key is the one they will run at FAT with a golden sample; its repeatability is what the bench is accepted on.',
    blocks: ['services (A1)', 'statement of work (B4)'], source: EXPERIENCE,
    check(ctx) {
      const kpi = ctx.derived.steps.filter(({ test }) => test.kpi).map(({ test }) => test.id);
      const tests = [...new Set(kpi)];
      if (!tests.length) return [];
      return [finding(this, ctx, { message: `${tests.length} tests are marked KPI: ${tests.map((id) => ctx.codes.get(id)).join(', ')}.`, question: 'Are the KPI tests the acceptance criteria of the bench (FAT/SAT), and with which golden samples and repeatability?' })];
    },
  },
  {
    id: 'R-COST-10', category: 'costDriver', severity: 'info', title: 'Shared point: reached by more than one resource',
    rationale: 'One contact and several instruments is a relay, a matrix or a second probe; the choice is a decision with a price.',
    blocks: ['switching decision (A2)', 'channel refinement (C2)'], source: EXPERIENCE,
    check(ctx) {
      return ctx.derived.points.filter((row) => row.resourceIds.length > 1)
        .map((row) => finding(this, ctx, { id: row.point.id, type: 'point', message: `${ctx.label(row.point.id)} is reached by ${row.resourceIds.length} resources: ${row.resourceIds.map((id) => ctx.codes.get(id)).join(', ')}.`, question: '', data: { resourceIds: row.resourceIds } }));
    },
  },
];

function sameQuantityName(parameterName, characteristicName, family) {
  const p = String(parameterName || '').toLowerCase();
  const c = String(characteristicName || '').toLowerCase();
  if (family === 'voltage') return /volt|level|\bv\b/.test(p) && /volt/.test(c) || (!/test|trip|ramp/.test(c) && /volt/.test(c) && /volt/.test(p));
  if (family === 'current') return /current|inject|limit/.test(p) && /current|inject/.test(c) && (/inject/.test(p) === /inject/.test(c));
  if (family === 'frequency') return /freq/.test(p) && /freq/.test(c) || /bandwidth/.test(c) && /freq/.test(p);
  if (family === 'resistance') return /resist|load|\br\b/.test(p) && /resist|range/.test(c);
  if (family === 'power') return /power/.test(p) && /power/.test(c);
  if (family === 'time') return /time|ramp|dwell/.test(p) && /ramp|time/.test(c);
  return p === c;
}

/** Stimuli at hazardous levels: above 50 V AC / 120 V DC, or above 10 A. */
export function hazardousStimuli(ctx) {
  const out = [];
  for (const st of ctx.derived.stimuli) {
    for (const p of st.parameters) {
      const family = unitFamily(p.unit);
      if (family !== 'voltage' && family !== 'current') continue;
      for (const v of p.values || []) {
        const n = v.range ? v.range.max : v.value;
        if (n == null) continue;
        const base = Math.abs(n * unitScale(p.unit).factor);
        const ac = /ac|rms/i.test(`${p.unit} ${p.name} ${st.description}`);
        if ((family === 'voltage' && base >= (ac ? 50 : 120)) || (family === 'current' && base >= 10)) {
          out.push({ stepId: st.stepId, pointIds: st.pointIds, resourceIds: st.resourceIds, text: `${p.name} ${v.text} ${p.unit}`, family, value: base, hazard: family === 'voltage' ? 'hazardous voltage' : 'high current' });
        }
      }
    }
  }
  return out;
}

export const RULE_CATEGORIES = { incompleteness: 'Incompleteness', inconsistency: 'Inconsistency', assumption: 'Unstated assumption', costDriver: 'Cost driver in plain sight' };
