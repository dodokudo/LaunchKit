import { BigQuery } from '@google-cloud/bigquery';
import { Folder } from '@/types/folder';
import {
  getAllFolders as getAllFoldersLocal,
  getFolder as getFolderLocal,
  saveFolder as saveFolderLocal,
  deleteFolder as deleteFolderLocal,
} from '@/lib/storage';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'mark-454114';
const DATASET = 'marketing';
const TABLE = 'folders';

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
  return new BigQuery({ projectId: PROJECT_ID });
};

const bigquery = !useLocalStore ? getBigQueryClient() : null;

const normalizeRow = (row: { id: string; data: string | Folder }): Folder => {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { ...data, id: row.id };
};

export const folderStore = {
  isRemote: !useLocalStore,

  async getAll(): Promise<Folder[]> {
    if (!bigquery) {
      return Promise.resolve(getAllFoldersLocal());
    }
    const query = `
      SELECT id, TO_JSON_STRING(data) as data, updated_at
      FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      ORDER BY updated_at DESC
    `;
    const [rows] = await bigquery.query({ query });
    return (rows || []).map((row: { id: string; data: string }) => normalizeRow(row));
  },

  async getById(id: string): Promise<Folder | null> {
    if (!bigquery) {
      return Promise.resolve(getFolderLocal(id));
    }
    const query = `
      SELECT id, TO_JSON_STRING(data) as data
      FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      WHERE id = @id
      LIMIT 1
    `;
    const [rows] = await bigquery.query({
      query,
      params: { id },
    });
    if (!rows || rows.length === 0) return null;
    return normalizeRow(rows[0] as { id: string; data: string });
  },

  async save(folder: Folder): Promise<Folder> {
    const now = new Date().toISOString();
    const nextFolder = {
      ...folder,
      updatedAt: folder.updatedAt || now,
      createdAt: folder.createdAt || now,
    };
    if (!bigquery) {
      return Promise.resolve(saveFolderLocal(nextFolder));
    }

    const query = `
      MERGE \`${PROJECT_ID}.${DATASET}.${TABLE}\` AS target
      USING (SELECT @id AS id) AS source
      ON target.id = source.id
      WHEN MATCHED THEN
        UPDATE SET
          data = PARSE_JSON(@data),
          updated_at = TIMESTAMP(@updated_at)
      WHEN NOT MATCHED THEN
        INSERT (id, data, created_at, updated_at)
        VALUES (@id, PARSE_JSON(@data), TIMESTAMP(@created_at), TIMESTAMP(@updated_at))
    `;
    await bigquery.query({
      query,
      params: {
        id: nextFolder.id,
        data: JSON.stringify(nextFolder),
        created_at: nextFolder.createdAt,
        updated_at: nextFolder.updatedAt,
      },
    });
    return nextFolder;
  },

  async delete(id: string): Promise<boolean> {
    if (!bigquery) {
      return Promise.resolve(deleteFolderLocal(id));
    }
    const query = `
      DELETE FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
      WHERE id = @id
    `;
    await bigquery.query({
      query,
      params: { id },
    });
    return true;
  },
};
