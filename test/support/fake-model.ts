/// A tiny in-memory stand-in for a Mongoose model: enough of find, update,
/// upsert and $in / $ne / $or / ranges for these services.
export function model(rows: any[]) {
  const num = (x: any) => (x instanceof Date ? x.getTime() : x);
  const test = (value: any, v: any): boolean => {
    if (v instanceof RegExp) return typeof value === 'string' && v.test(value);
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      return Object.entries(v).every(([op, arg]: [string, any]) => {
        switch (op) {
          case '$in': return arg.some((a: any) => num(a) === num(value));
          case '$nin': return !arg.some((a: any) => num(a) === num(value));
          case '$ne': return num(value) !== num(arg);
          case '$gte': return value != null && num(value) >= num(arg);
          case '$gt': return value != null && num(value) > num(arg);
          case '$lte': return value != null && num(value) <= num(arg);
          case '$lt': return value != null && num(value) < num(arg);
          default: throw new Error(`unsupported ${op}`);
        }
      });
    }
    if (Array.isArray(value)) return value.includes(v);
    return num(value) === num(v);
  };
  const matches = (row: any, q: any): boolean =>
    Object.entries(q).every(([k, v]: [string, any]) =>
      k === '$or' ? v.some((part: any) => matches(row, part)) : test(row[k], v),
    );
  const apply = (row: any, update: any) => {
    const { $set, $push, $inc, $setOnInsert, ...plain } = update;
    Object.assign(row, plain, $set ?? {});
    for (const [k, v] of Object.entries($push ?? {})) row[k] = [...(row[k] ?? []), v];
    for (const [k, v] of Object.entries($inc ?? {})) row[k] = (row[k] ?? 0) + (v as number);
  };
  const lean = <T>(value: T) => ({ lean: async () => value, then: (r: any) => r(value) });
  return {
    rows,
    findOne: (q: any) => {
      const chain: any = {
        sort: () => chain,
        lean: async () => rows.find((r) => matches(r, q)) ?? null,
        then: (r: any) => r(rows.find((x) => matches(x, q)) ?? null),
      };
      return chain;
    },
    find: (q: any) => {
      const found = rows.filter((r) => matches(r, q));
      const chain: any = { skip: () => chain, limit: () => chain, sort: () => chain, lean: async () => found };
      return chain;
    },
    findOneAndUpdate: (q: any, update: any, opts: any = {}) => {
      let row = rows.find((r) => matches(r, q));
      if (!row && opts.upsert) {
        row = { ...Object.fromEntries(Object.entries(q).filter(([k]) => !k.startsWith('$'))), ...(update.$setOnInsert ?? {}) };
        rows.push(row);
      }
      if (row) apply(row, update);
      return lean(row ? { ...row } : null);
    },
    updateOne: async (q: any, update: any) => {
      const row = rows.find((r) => matches(r, q));
      if (row) apply(row, update);
      return { modifiedCount: row ? 1 : 0 };
    },
    updateMany: async (q: any, update: any) => {
      const hit = rows.filter((r) => matches(r, q));
      hit.forEach((r) => apply(r, update));
      return { modifiedCount: hit.length };
    },
    create: async (doc: any) => {
      rows.push({ ...doc });
      return { toObject: () => ({ ...doc }) };
    },
    countDocuments: async (q: any) => rows.filter((r) => matches(r, q)).length,
    distinct: async (field: string, q: any) => [...new Set(rows.filter((r) => matches(r, q)).map((r) => r[field]))],
    /// $match, then $group by a field or fields with { $sum: 1 }, then $match.
    aggregate: async (pipeline: any[]) => {
      let out: any[] = rows;
      for (const stage of pipeline) {
        if (stage.$match) out = out.filter((r) => matches(r, stage.$match));
        if (stage.$group) {
          const { _id, ...acc } = stage.$group;
          const keyOf = (r: any) =>
            typeof _id === 'string'
              ? r[_id.slice(1)]
              : Object.fromEntries(Object.entries(_id).map(([k, v]: [string, any]) => [k, r[v.slice(1)]]));
          const groups = new Map<string, any>();
          for (const r of out) {
            const key = keyOf(r);
            const id = JSON.stringify(key);
            const g = groups.get(id) ?? { _id: key, ...Object.fromEntries(Object.keys(acc).map((k) => [k, 0])) };
            for (const k of Object.keys(acc)) g[k] += 1;
            groups.set(id, g);
          }
          out = [...groups.values()];
        }
      }
      return out;
    },
  };
}
