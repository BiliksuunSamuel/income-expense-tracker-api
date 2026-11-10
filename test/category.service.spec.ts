import { CategoryService } from 'src/services/category.service';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import {
  CategoryColor,
  CategoryIcon,
  CategoryKind,
  CategoryType,
} from 'src/enums';
import { STARTER_CATEGORIES, guessLook } from 'src/utils/categories';

const user = { id: 'u1', email: 'ama@example.com' } as UserJwtDetails;

const cat = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  titleKey: id.toLowerCase(),
  creatorId: 'u1',
  type: CategoryType.Personal,
  kind: CategoryKind.Expense,
  icon: CategoryIcon.Other,
  color: CategoryColor.Grey,
  parentId: null,
  archived: false,
  createdAt: new Date('2026-01-01'),
  ...extra,
});

function repo(categories: any[] = [], used: any[] = []) {
  const store = [...categories];
  return {
    store,
    ownedBy: jest.fn(async () => [...store]),
    byId: jest.fn(async (id: string) => store.find((c) => c.id === id) ?? null),
    ownerOf: jest.fn(
      async (id: string) => store.find((c) => c.id === id)?.creatorId ?? null,
    ),
    byTitle: jest.fn(
      async (_u: string, kind: string, key: string) =>
        store.find((c) => c.kind === kind && c.titleKey === key) ?? null,
    ),
    insertMissing: jest.fn(async (docs: any[]) => {
      store.push(...docs);
    }),
    create: jest.fn(async (c) => {
      store.push(c);
      return c;
    }),
    update: jest.fn(async (id: string, _u: string, changes: any) => {
      const c = store.find((x) => x.id === id);
      Object.assign(c, changes);
      return c;
    }),
    delete: jest.fn(async (id: string) => {
      const i = store.findIndex((c) => c.id === id);
      return i >= 0 ? store.splice(i, 1)[0] : null;
    }),
    hasChildren: jest.fn(async (id: string) =>
      store.some((c) => c.parentId === id),
    ),
    isUsed: jest.fn().mockResolvedValue(false),
    renameInEntries: jest.fn().mockResolvedValue(3),
    usedTitles: jest.fn().mockResolvedValue(used),
    reorder: jest.fn(),
  };
}

describe('setting up categories', () => {
  it('gives a new user the starter set', async () => {
    const r = repo();
    const res = await new CategoryService(r as any).getCategories(user);
    expect(res.code).toBe(200);
    expect(res.data).toHaveLength(STARTER_CATEGORIES.length);
    expect(res.data.find((c) => c.title === 'Salary').kind).toBe(
      CategoryKind.Income,
    );
  });

  it('adds the titles their transactions already use, with a guessed look', async () => {
    const r = repo(
      [],
      [
        { title: 'Trotro', kind: CategoryKind.Expense },
        { title: 'Food', kind: CategoryKind.Expense },
        { title: 'Side hustle', kind: CategoryKind.Income },
      ],
    );
    const res = await new CategoryService(r as any).getCategories(user);
    const trotro = res.data.find((c) => c.title === 'Trotro');
    expect(trotro.icon).toBe(CategoryIcon.Transport);
    expect(res.data.filter((c) => c.titleKey === 'food')).toHaveLength(1);
    expect(res.data.find((c) => c.title === 'Side hustle').kind).toBe(
      CategoryKind.Income,
    );
  });

  it('fills in old categories in place, keeping their ids', async () => {
    const old = {
      id: 'old1',
      title: 'Salary',
      creatorId: 'u1',
      type: CategoryType.Personal,
    };
    const r = repo([old], [{ title: 'Salary', kind: CategoryKind.Income }]);
    const res = await new CategoryService(r as any).getCategories(user);
    const salaries = res.data.filter((c) => c.titleKey === 'salary');
    expect(salaries).toHaveLength(1);
    expect(salaries[0]).toMatchObject({
      id: 'old1',
      kind: CategoryKind.Income,
    });
  });

  it('leaves a set-up user alone', async () => {
    const r = repo([cat('Food')]);
    await new CategoryService(r as any).getCategories(user);
    expect(r.insertMissing).not.toHaveBeenCalled();
  });
});

describe('adding a category', () => {
  it('returns the existing one for a repeated title and shows it again', async () => {
    const r = repo([cat('Food', { archived: true })]);
    const res = await new CategoryService(r as any).createCategory(
      { title: '  food ', kind: CategoryKind.Expense },
      user,
    );
    expect(res.code).toBe(200);
    expect(res.data).toMatchObject({ id: 'Food', archived: false });
  });

  it('allows the same title for income and expenses', async () => {
    const r = repo([cat('Other')]);
    const res = await new CategoryService(r as any).createCategory(
      { title: 'Other', kind: CategoryKind.Income },
      user,
    );
    expect(res.code).toBe(201);
  });

  it('only nests one level, under the same kind', async () => {
    const r = repo([
      cat('Food'),
      cat('Lunch', { parentId: 'Food' }),
      cat('Salary', { kind: CategoryKind.Income }),
    ]);
    const s = new CategoryService(r as any);
    expect(
      (await s.createCategory({ title: 'Waakye', parentId: 'Lunch' }, user))
        .code,
    ).toBe(400);
    expect(
      (await s.createCategory({ title: 'Bonus', parentId: 'Salary' }, user))
        .code,
    ).toBe(400);
    const ok = await s.createCategory(
      { title: 'Dinner', parentId: 'Food' },
      user,
    );
    expect(ok.code).toBe(201);
    expect(ok.data.parentId).toBe('Food');
  });
});

describe('changing a category', () => {
  it('carries a rename into past entries', async () => {
    const r = repo([cat('Trotro')]);
    const res = await new CategoryService(r as any).updateCategory(
      'Trotro',
      { title: 'Transport' },
      user,
    );
    expect(res.code).toBe(200);
    expect(r.renameInEntries).toHaveBeenCalledWith(
      'u1',
      CategoryKind.Expense,
      'Trotro',
      'Transport',
    );
  });

  it('refuses a rename onto another category', async () => {
    const r = repo([cat('Food'), cat('Lunch')]);
    const res = await new CategoryService(r as any).updateCategory(
      'Lunch',
      { title: 'FOOD' },
      user,
    );
    expect(res.code).toBe(409);
    expect(r.renameInEntries).not.toHaveBeenCalled();
  });

  it('will not put a parent under another category', async () => {
    const r = repo([
      cat('Food'),
      cat('Lunch', { parentId: 'Food' }),
      cat('Bills'),
    ]);
    const res = await new CategoryService(r as any).updateCategory(
      'Food',
      { parentId: 'Bills' },
      user,
    );
    expect(res.code).toBe(400);
  });
});

describe('ordering', () => {
  it('starter categories keep their listed order', async () => {
    const r = repo();
    const res = await new CategoryService(r as any).getCategories(user);
    expect(res.data.map((c) => c.position)).toEqual(
      STARTER_CATEGORIES.map((_, i) => i),
    );
  });

  it('a new category goes last', async () => {
    const r = repo([
      cat('Food', { position: 0 }),
      cat('Bills', { position: 4 }),
    ]);
    const res = await new CategoryService(r as any).createCategory(
      { title: 'Pets' },
      user,
    );
    expect(res.data.position).toBe(5);
  });

  it('saves the order once per id', async () => {
    const r = repo([cat('Food')]);
    await new CategoryService(r as any).reorder({ ids: ['b', 'a', 'b'] }, user);
    expect(r.reorder).toHaveBeenCalledWith('u1', ['b', 'a']);
  });
});

describe('deleting a category', () => {
  it('asks to archive one that has entries', async () => {
    const r = repo([cat('Food')]);
    r.isUsed.mockResolvedValue(true);
    const res = await new CategoryService(r as any).deleteCategory(
      'Food',
      user,
    );
    expect(res.code).toBe(409);
  });

  it('asks to deal with sub-categories first', async () => {
    const r = repo([cat('Food'), cat('Lunch', { parentId: 'Food' })]);
    const res = await new CategoryService(r as any).deleteCategory(
      'Food',
      user,
    );
    expect(res.code).toBe(409);
  });
});

describe('guessing a look', () => {
  it('does not mistake words that contain another', () => {
    expect(guessLook('Refund').icon).toBe(CategoryIcon.Refund);
    expect(guessLook('Business').icon).toBe(CategoryIcon.Business);
    expect(guessLook('Personal care').icon).toBe(CategoryIcon.PersonalCare);
    expect(guessLook('Flight').icon).toBe(CategoryIcon.Travel);
  });
});
