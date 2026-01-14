import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ファネル関連の操作
export const funnelApi = {
  // 全ファネル取得
  async getAll() {
    const { data, error } = await supabase
      .from('funnels')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // 特定のファネル取得
  async getById(id: string) {
    const { data, error } = await supabase
      .from('funnels')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // ファネル作成
  async create(funnel: {
    name: string;
    description?: string;
    nodes: unknown[];
    edges: unknown[];
  }) {
    const { data, error } = await supabase
      .from('funnels')
      .insert([funnel])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ファネル更新
  async update(
    id: string,
    updates: {
      name?: string;
      description?: string;
      nodes?: unknown[];
      edges?: unknown[];
    }
  ) {
    const { data, error } = await supabase
      .from('funnels')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ファネル削除
  async delete(id: string) {
    const { error } = await supabase.from('funnels').delete().eq('id', id);

    if (error) throw error;
  },
};
