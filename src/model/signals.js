// The signal list and pin map: every application point with its contact, its
// characteristics, and every instrument channel and interface that reaches it — numbered per
// resource in the order the points appear. An export for the harness maker.
import { labelOf } from './spec.js';

export function signalList(derived) {
  const label = (id) => labelOf(derived.codes, derived.index, id);
  const next = new Map();
  const channel = (rid, pid) => { const key = `${rid}|${pid}`; if (!next.has(key)) { const n = (next.get(rid) || 0) + 1; next.set(rid, n); next.set(key, n); } return next.get(key); };
  const rows = derived.points.map((p) => ({
    code: derived.codes.get(p.point.id), name: p.point.name, connector: p.point.connector, pin: p.point.pin, signal: p.point.signal, contactType: p.point.contactType,
    characteristics: (p.point.characteristics || []).map((c) => `${c.name} ${c.value} ${c.unit}`.trim()).join('; '),
    channels: p.resourceIds.map((rid) => `${derived.codes.get(rid)} ch ${channel(rid, p.point.id)}`).join('; '), interfaces: p.interfaceIds.map(label).join('; '),
    stages: p.stageIds.map((id) => derived.codes.get(id)).join(', '), figures: (p.point.markers || []).map((m) => derived.codes.get(m.imageId)).filter(Boolean).join(', '),
  }));
  return { rows, columns: [['code', 'Point'], ['name', 'Name'], ['connector', 'Connector'], ['pin', 'Pin'], ['signal', 'Signal'], ['contactType', 'Contact'], ['characteristics', 'Characteristics'], ['channels', 'Instrument channels'], ['interfaces', 'Interfaces'], ['stages', 'Stages'], ['figures', 'Figures']] };
}
