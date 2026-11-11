import { Model } from 'mongoose';
import { PagedResults } from 'src/common/paged.results.dto';

/// A page and size from a query string: page ≥ 1, size 1–100 (default 10).
export function pageOf(query: any): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(query?.page)) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query?.pageSize)) || 10));
  return { page, pageSize };
}

/// One page of [model] matching [filter], newest first by default.
export async function paged<T>(
  model: Model<T>,
  filter: Record<string, unknown>,
  { page, pageSize }: { page: number; pageSize: number },
  sort: Record<string, 1 | -1> = { createdAt: -1 },
): Promise<PagedResults<T>> {
  const [totalCount, results] = await Promise.all([
    model.countDocuments(filter as any),
    model
      .find(filter as any)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean() as Promise<T[]>,
  ]);
  return {
    results,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}
