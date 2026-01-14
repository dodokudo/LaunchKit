// セグメント定義
export interface Segment {
  id: string;
  name: string;
  description?: string;
  color: string;
  isDefault?: boolean; // 「全員」のようなデフォルトセグメント
}

// 配信アイテム（各セルの内容）
export interface DeliveryItem {
  id: string;
  date: string; // YYYY-MM-DD
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  segmentId: string; // 後方互換性のため残す（単一セグメントの場合）
  segmentIds: string[]; // 複数セグメント対応（これを優先）
  title: string;
  description?: string;
  type: 'message' | 'video' | 'sale' | 'reminder' | 'branch'; // 配信タイプ
}

// 接続（配信間の矢印）
export interface Connection {
  id: string;
  fromDeliveryId: string; // 接続元の配信ID
  toDeliveryId: string;   // 接続先の配信ID
  label?: string;         // 接続ラベル（条件など）
}

// 分岐点（あるセグメントから別のセグメントへの分岐）- 廃止予定
export interface BranchPoint {
  id: string;
  date: string; // 分岐が発生する日付
  fromSegmentId: string; // 分岐元（通常は「全員」）
  toSegmentIds: string[]; // 分岐先のセグメントID配列
  condition?: string; // 分岐条件の説明
}

// KPI（フェーズごとの目標数値）
export interface KPI {
  target: number; // 目標人数
  rate: number;   // 前フェーズからのCVR (%)
  width: number;  // フェーズの幅 (px)
}

// 期間（タイムライン上部に表示する色付き帯）
export interface Period {
  id: string;
  name: string;       // 「準備期間」「販売期間」「フォロー期間」など
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  color: string;      // 背景色
}

// タスク
export interface Task {
  id: string;
  title: string;
  description?: string;
  phaseIndex: number; // どのフェーズに属するか
  completed: boolean;
  order: number; // フェーズ内での順番
}

// セグメント間の移行（フローチャート用）
export interface SegmentTransition {
  id: string;
  fromSegmentId: string; // 移行元セグメント（'entry'は流入元）
  toSegmentId: string;   // 移行先セグメント
  condition: string;     // 移行条件（例: 「LINE登録」「購入完了」）
  description?: string;  // 補足説明
}

// 入口（SNS媒体）
export type SNSPlatform = 'twitter' | 'instagram' | 'tiktok' | 'youtube' | 'threads' | 'line' | 'other';

export interface EntryPoint {
  id: string;
  platform: SNSPlatform;
  label: string;
  description?: string;
}

// ファネル全体
export interface Funnel {
  id: string;
  name: string;
  description?: string;

  // 基準日（販売日など）
  baseDate: string; // YYYY-MM-DD（開始日）
  baseDateDays: number; // 期間（日数）。1なら1日だけ、5なら5日間
  baseDateLabel: string; // 「販売日」「セミナー日」など

  // 表示期間
  startDate: string;
  endDate: string;

  // 入口
  entryPoints: EntryPoint[];

  // セグメント
  segments: Segment[];

  // 配信アイテム
  deliveries: DeliveryItem[];

  // 接続（矢印）
  connections: Connection[];

  // セグメント間の移行（フローチャート用）
  transitions: SegmentTransition[];

  // フリーキャンバス用（React Flow）
  canvasNodes: any[];
  canvasEdges: any[];

  // フェーズ名（カスタマイズ可能）
  phaseNames?: string[];

  // KPI（各フェーズの目標）
  kpis?: KPI[];

  // タスク（カンバン形式）
  tasks?: Task[];

  // タスクカテゴリ（ファネルとは独立）
  taskCategories?: string[];
  // 旧: タスク用フェーズ（互換用）
  taskPhases?: string[];

  // 分岐点（廃止予定、connectionsで代替）
  branchPoints: BranchPoint[];

  // 期間（タイムライン上部の色帯）
  periods?: Period[];

  createdAt: string;
  updatedAt: string;
}

// SNSプラットフォームの表示設定
export const SNS_PLATFORMS: Record<SNSPlatform, { label: string; color: string }> = {
  twitter: { label: 'X (Twitter)', color: '#000000' },
  instagram: { label: 'Instagram', color: '#E4405F' },
  tiktok: { label: 'TikTok', color: '#000000' },
  youtube: { label: 'YouTube', color: '#FF0000' },
  threads: { label: 'Threads', color: '#000000' },
  line: { label: 'LINE', color: '#06C755' },
  other: { label: 'その他', color: '#6B7280' },
};

// 配信タイプの表示設定
export const DELIVERY_TYPES: Record<DeliveryItem['type'], { label: string; color: string; icon: string }> = {
  message: { label: 'メッセージ', color: '#3B82F6', icon: '💬' },
  video: { label: '動画', color: '#8B5CF6', icon: '🎬' },
  sale: { label: '販売', color: '#EF4444', icon: '🛒' },
  reminder: { label: 'リマインド', color: '#F59E0B', icon: '🔔' },
  branch: { label: '分岐', color: '#10B981', icon: '🔀' },
};

// デフォルトセグメント
export const DEFAULT_SEGMENTS: Segment[] = [
  { id: 'all', name: '全員', color: '#6B7280', isDefault: true },
];

// 新規ファネルのデフォルト値
export function createDefaultFunnel(id: string): Funnel {
  const today = new Date();
  const baseDate = new Date(today);
  baseDate.setDate(baseDate.getDate() + 14); // 2週間後をデフォルトの販売日に

  const startDate = new Date(today);
  const endDate = new Date(baseDate);
  endDate.setDate(endDate.getDate() + 7); // 販売日の1週間後まで表示

  return {
    id,
    name: '新規ファネル',
    description: '',
    baseDate: baseDate.toISOString().split('T')[0],
    baseDateDays: 3, // デフォルトは3日間
    baseDateLabel: '販売期間',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    entryPoints: [],
    segments: [...DEFAULT_SEGMENTS],
    deliveries: [],
    connections: [],
    transitions: [],
    canvasNodes: [],
    canvasEdges: [],
    branchPoints: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
