import { createClient } from '@supabase/supabase-js';
import { Funnel } from '@/types/funnel';
import {
  getAllFunnels as getAllFunnelsLocal,
  getFunnel as getFunnelLocal,
  saveFunnel as saveFunnelLocal,
  deleteFunnel as deleteFunnelLocal,
} from '@/lib/storage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);
const useLocalStore = process.env.NODE_ENV === 'development';

const supabase = hasSupabaseConfig && !useLocalStore
  ? createClient(supabaseUrl as string, supabaseKey as string, {
      auth: { persistSession: false },
    })
  : null;

const TABLE = 'funnels';

const normalizeRow = (row: { id: string; data?: Funnel }) => {
  if (row.data) {
    return { ...row.data, id: row.id };
  }
  return row as unknown as Funnel;
};

export const funnelStore = {
  isRemote: hasSupabaseConfig && !useLocalStore,

  async getAll(): Promise<Funnel[]> {
    if (!supabase) {
      return Promise.resolve(getAllFunnelsLocal());
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, data, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => normalizeRow(row as { id: string; data?: Funnel }));
  },

  async getById(id: string): Promise<Funnel | null> {
    if (!supabase) {
      return Promise.resolve(getFunnelLocal(id));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, data')
      .eq('id', id)
      .single();
    if (error) return null;
    return normalizeRow(data as { id: string; data?: Funnel });
  },

  async save(funnel: Funnel): Promise<Funnel> {
    const now = new Date().toISOString();
    const nextFunnel = {
      ...funnel,
      updatedAt: funnel.updatedAt || now,
      createdAt: funnel.createdAt || now,
    };
    if (!supabase) {
      return Promise.resolve(saveFunnelLocal(nextFunnel));
    }
    const payload = {
      id: nextFunnel.id,
      data: nextFunnel,
      created_at: nextFunnel.createdAt,
      updated_at: nextFunnel.updatedAt,
    };
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(payload)
      .select('id, data')
      .single();
    if (error) throw error;
    return normalizeRow(data as { id: string; data?: Funnel });
  },

  async delete(id: string): Promise<boolean> {
    if (!supabase) {
      return Promise.resolve(deleteFunnelLocal(id));
    }
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
