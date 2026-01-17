const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const dataPath = path.join(__dirname, '..', 'data', 'funnels.json');

if (!fs.existsSync(dataPath)) {
  console.error(`No local data file at ${dataPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(dataPath, 'utf-8');
const funnels = JSON.parse(raw);

const normalize = (funnel) => {
  const now = new Date().toISOString();
  return {
    ...funnel,
    createdAt: funnel.createdAt || now,
    updatedAt: funnel.updatedAt || now,
  };
};

const run = async () => {
  const payload = funnels.map((funnel) => {
    const normalized = normalize(funnel);
    return {
      id: normalized.id,
      data: normalized,
      created_at: normalized.createdAt,
      updated_at: normalized.updatedAt,
    };
  });

  const { error } = await supabase.from('funnels').upsert(payload);
  if (error) {
    console.error('Supabase upsert failed:', error);
    process.exit(1);
  }

  console.log(`Migrated ${payload.length} funnels to Supabase.`);
};

run();
