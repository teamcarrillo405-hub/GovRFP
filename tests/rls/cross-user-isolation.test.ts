import { describe, it, expect } from 'vitest'

describe('AUTH-05: Row Level Security - Cross User Isolation', () => {
  it('profiles table has RLS enabled', async () => {
    const fs = await import('fs')
    const migration = fs.readFileSync('supabase/migrations/00001_foundation_schema.sql', 'utf-8')
    expect(migration).toContain('alter table public.profiles enable row level security')
  })

  it('profiles SELECT policy uses auth.uid() = id', async () => {
    const fs = await import('fs')
    const migration = fs.readFileSync('supabase/migrations/00001_foundation_schema.sql', 'utf-8')
    expect(migration).toMatch(/create policy.*profiles.*for select.*using.*auth\.uid\(\).*=.*id/s)
  })

  it('profiles UPDATE policy uses auth.uid() = id in both using and with check', async () => {
    const fs = await import('fs')
    const migration = fs.readFileSync('supabase/migrations/00001_foundation_schema.sql', 'utf-8')
    expect(migration).toMatch(/create policy.*profiles.*for update.*using.*auth\.uid\(\).*=.*id/s)
    expect(migration).toMatch(/create policy.*profiles.*for update.*with check.*auth\.uid\(\).*=.*id/s)
  })

  it('past_projects table has RLS enabled', async () => {
    const fs = await import('fs')
    const migration = fs.readFileSync('supabase/migrations/00001_foundation_schema.sql', 'utf-8')
    expect(migration).toContain('alter table public.past_projects enable row level security')
  })

  it('past_projects policy uses auth.uid() = user_id', async () => {
    const fs = await import('fs')
    const migration = fs.readFileSync('supabase/migrations/00001_foundation_schema.sql', 'utf-8')
    expect(migration).toMatch(/create policy.*past_projects.*using.*auth\.uid\(\).*=.*user_id/s)
  })

  it('key_personnel table has RLS enabled', async () => {
    const fs = await import('fs')
    const migration = fs.readFileSync('supabase/migrations/00001_foundation_schema.sql', 'utf-8')
    expect(migration).toContain('alter table public.key_personnel enable row level security')
  })

  it('proposals table has RLS enabled', async () => {
    const fs = await import('fs')
    const migration = fs.readFileSync('supabase/migrations/00001_foundation_schema.sql', 'utf-8')
    expect(migration).toContain('alter table public.proposals enable row level security')
  })

  it('all user-owned tables reference auth.users with cascade delete', async () => {
    const fs = await import('fs')
    const migration = fs.readFileSync('supabase/migrations/00001_foundation_schema.sql', 'utf-8')
    // profiles, past_projects, key_personnel, proposals all reference auth.users
    const cascadeCount = (migration.match(/references auth\.users on delete cascade/g) || []).length
    expect(cascadeCount).toBeGreaterThanOrEqual(4)
  })
})
