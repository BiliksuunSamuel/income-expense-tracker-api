import { JwtService } from '@nestjs/jwt';
import { AdminRole, AdminStatus } from 'src/enums';
import { AdminAuthService } from 'src/services/admin-auth.service';

process.env.JwtSecret = 'test-secret';

/// Just enough of a Mongoose model for the admin sign-in.
function model(rows: any[]) {
  const matches = (row: any, q: any) => Object.entries(q).every(([k, v]) => row[k] === v);
  return {
    rows,
    findOne: (q: any) => ({ lean: async () => rows.find((r) => matches(r, q)) ?? null }),
    updateOne: async (q: any, update: any) => {
      const row = rows.find((r) => matches(r, q));
      if (row) Object.assign(row, update);
      return { modifiedCount: row ? 1 : 0 };
    },
    countDocuments: async () => rows.length,
    create: async (doc: any) => rows.push(doc),
  };
}

function setup() {
  const admins = model([
    { id: 'a1', phoneNumber: '233241234567', role: AdminRole.Owner, status: AdminStatus.Active },
    { id: 'a2', phoneNumber: '233201112222', role: AdminRole.Admin, status: AdminStatus.Suspended },
  ]);
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new AdminAuthService(admins as any, jwt, {} as any);
  const codes: string[] = [];
  jest.spyOn(service as any, 'sendSms').mockImplementation((_to: string, _msg: string, code: string) => {
    codes.push(code);
  });
  return { admins, service, codes, jwt };
}

const later = (now: Date, ms: number) => new Date(now.getTime() + ms);

describe('Console sign-in', () => {
  it('texts a code to an admin and signs them in with it', async () => {
    const { service, codes, admins } = setup();
    const now = new Date();
    const start = await service.login('024 123 4567', now);
    expect(start.code).toBe(200);
    expect(codes).toHaveLength(1);
    expect(admins.rows[0].verificationCodeHash).not.toContain(codes[0]);

    const pending = await service.adminForToken(start.data.token, true);
    expect(pending.id).toBe('a1');
    // A pending token isn't a session.
    expect(await service.adminForToken(start.data.token)).toBeNull();

    const done = await service.verify('a1', codes[0], later(now, 1000));
    expect(done.code).toBe(200);
    expect((await service.adminForToken(done.data.token)).id).toBe('a1');
    expect(admins.rows[0].verificationCodeHash).toBeNull();
  });

  it('refuses numbers that are not active admins', async () => {
    const { service, codes } = setup();
    expect((await service.login('0559998888')).code).toBe(403);
    expect((await service.login('0201112222')).code).toBe(403);
    expect((await service.login('not a number')).code).toBe(400);
    expect(codes).toHaveLength(0);
  });

  it('throws the code away after 5 wrong guesses', async () => {
    const { service, codes } = setup();
    const now = new Date();
    await service.login('0241234567', now);
    for (let i = 0; i < 4; i++) {
      expect((await service.verify('a1', '000000', now)).message).toBe("That code isn't right.");
    }
    expect((await service.verify('a1', '000000', now)).message).toMatch(/Too many wrong codes/);
    expect((await service.verify('a1', codes[0], now)).code).toBe(401);
  });

  it('expires a code after 5 minutes', async () => {
    const { service, codes } = setup();
    const now = new Date();
    await service.login('0241234567', now);
    expect((await service.verify('a1', codes[0], later(now, 5 * 60 * 1000 + 1))).message).toMatch(/expired/);
  });

  it('limits how often codes are sent', async () => {
    const { service, codes } = setup();
    const now = new Date();
    await service.login('0241234567', now);
    expect((await service.resend('a1', later(now, 10_000))).code).toBe(429);
    for (let i = 1; i <= 4; i++) {
      expect((await service.resend('a1', later(now, i * 61_000))).code).toBe(200);
    }
    expect((await service.resend('a1', later(now, 5 * 61_000))).code).toBe(429);
    expect(codes).toHaveLength(5);
  });

  it('ends a session on sign-out or a newer sign-in', async () => {
    const { service, codes } = setup();
    const now = new Date();
    await service.login('0241234567', now);
    const first = (await service.verify('a1', codes[0], now)).data.token;

    await service.login('0241234567', later(now, 61_000));
    const second = (await service.verify('a1', codes[1], later(now, 62_000))).data.token;
    expect(await service.adminForToken(first)).toBeNull();
    expect(await service.adminForToken(second)).not.toBeNull();

    await service.signOut('a1');
    expect(await service.adminForToken(second)).toBeNull();
  });
});
