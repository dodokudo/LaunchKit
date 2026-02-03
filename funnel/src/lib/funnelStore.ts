import { BigQuery } from '@google-cloud/bigquery';
import { Funnel } from '@/types/funnel';
import {
  getAllFunnels as getAllFunnelsLocal,
  getFunnel as getFunnelLocal,
  saveFunnel as saveFunnelLocal,
  deleteFunnel as deleteFunnelLocal,
} from '@/lib/storage';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'mark-454114';
const DATASET = 'marketing';
const TABLE = 'funnels';
// BigQueryのテーブル参照（バッククォートで囲む）
const getTableRef = () => '`' + PROJECT_ID + '.' + DATASET + '.' + TABLE + '`';

const useLocalStore = process.env.NODE_ENV === 'development';

// BigQueryクライアントの初期化
const getBigQueryClient = () => {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentials) {
    const parsed = JSON.parse(credentials);
    return new BigQuery({
      projectId: PROJECT_ID,
      credentials: parsed,
    });
  }
  // デフォルト認証（ローカル開発時やGCP環境）
  return new BigQuery({ projectId: PROJECT_ID });
};

const bigquery = !useLocalStore ? getBigQueryClient() : null;

const normalizeRow = (row: { id: string; data: string | Funnel }): Funnel => {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { ...data, id: row.id };
};

export const funnelStore = {
  isRemote: !useLocalStore,

  async getAll(): Promise<Funnel[]> {
    if (!bigquery) {
      return Promise.resolve(getAllFunnelsLocal());
    }
    const tableRef = getTableRef();
    const query = `SELECT id, TO_JSON_STRING(data) as data, updated_at FROM ${tableRef} ORDER BY updated_at DESC`;
    const [rows] = await bigquery.query({ query });
    return (rows || []).map((row: { id: string; data: string }) => normalizeRow(row));
  },

  async getById(id: string): Promise<Funnel | null> {
    if (!bigquery) {
      return Promise.resolve(getFunnelLocal(id));
    }
    const tableRef = getTableRef();
    const query = `SELECT id, TO_JSON_STRING(data) as data FROM ${tableRef} WHERE id = @id LIMIT 1`;
    const [rows] = await bigquery.query({
      query,
      params: { id },
    });
    if (!rows || rows.length === 0) return null;
    return normalizeRow(rows[0] as { id: string; data: string });
  },

  async save(funnel: Funnel): Promise<Funnel> {
    const now = new Date().toISOString();
    const nextFunnel = {
      ...funnel,
      updatedAt: funnel.updatedAt || now,
      createdAt: funnel.createdAt || now,
    };
    if (!bigquery) {
      return Promise.resolve(saveFunnelLocal(nextFunnel));
    }

    // BigQueryではMERGEでUPSERTを実現
    const tableRef = getTableRef();
    const query = `MERGE ${tableRef} AS target USING (SELECT @id AS id) AS source ON target.id = source.id WHEN MATCHED THEN UPDATE SET data = PARSE_JSON(@data), updated_at = TIMESTAMP(@updated_at) WHEN NOT MATCHED THEN INSERT (id, data, created_at, updated_at) VALUES (@id, PARSE_JSON(@data), TIMESTAMP(@created_at), TIMESTAMP(@updated_at))`;
    await bigquery.query({
      query,
      params: {
        id: nextFunnel.id,
        data: JSON.stringify(nextFunnel),
        created_at: nextFunnel.createdAt,
        updated_at: nextFunnel.updatedAt,
      },
    });
    return nextFunnel;
  },

  async delete(id: string): Promise<boolean> {
    if (!bigquery) {
      return Promise.resolve(deleteFunnelLocal(id));
    }
    const tableRef = getTableRef();
    const query = `DELETE FROM ${tableRef} WHERE id = @id`;
    await bigquery.query({
      query,
      params: { id },
    });
    return true;
  },
};
