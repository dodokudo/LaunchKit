import fs from 'fs';
import path from 'path';
import dagre from 'dagre';
import { Funnel } from '@/types/funnel';
import { Folder } from '@/types/folder';

const DATA_DIR = path.join(process.cwd(), 'data');
const FUNNELS_FILE = path.join(DATA_DIR, 'funnels.json');
const FOLDERS_FILE = path.join(DATA_DIR, 'folders.json');

// 自動レイアウト（左上から右下への対角線フロー）
export function layoutNodes(nodes: any[], edges: any[]): any[] {
  if (nodes.length === 0) return nodes;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 }); // TB = Top to Bottom

  const nodeWidth = 150;
  const nodeHeight = 50;

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // 各ノードのランク（深さ）を計算
  const nodeRanks: Record<string, number> = {};
  const calculateRank = (nodeId: string, visited: Set<string> = new Set()): number => {
    if (visited.has(nodeId)) return nodeRanks[nodeId] || 0;
    visited.add(nodeId);

    const incomingEdges = edges.filter((e: any) => e.target === nodeId);
    if (incomingEdges.length === 0) {
      nodeRanks[nodeId] = 0;
      return 0;
    }

    const maxParentRank = Math.max(...incomingEdges.map((e: any) => calculateRank(e.source, visited)));
    nodeRanks[nodeId] = maxParentRank + 1;
    return nodeRanks[nodeId];
  };

  nodes.forEach(node => calculateRank(node.id));

  return nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    const rank = nodeRanks[node.id] || 0;
    return {
      ...node,
      position: {
        x: pos.x - nodeWidth / 2 + rank * 100, // フェーズごとに右にずらす
        y: pos.y - nodeHeight / 2,
      },
    };
  });
}

// データディレクトリが存在しない場合は作成
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 全ファネルを取得
export function getAllFunnels(): Funnel[] {
  ensureDataDir();
  if (!fs.existsSync(FUNNELS_FILE)) {
    return [];
  }
  const data = fs.readFileSync(FUNNELS_FILE, 'utf-8');
  return JSON.parse(data);
}

// 特定のファネルを取得
export function getFunnel(id: string): Funnel | null {
  const funnels = getAllFunnels();
  return funnels.find(f => f.id === id) || null;
}

// ファネルを保存（新規 or 更新）
export function saveFunnel(funnel: Funnel): Funnel {
  ensureDataDir();
  const funnels = getAllFunnels();
  const index = funnels.findIndex(f => f.id === funnel.id);

  funnel.updatedAt = new Date().toISOString();

  if (index >= 0) {
    funnels[index] = funnel;
  } else {
    funnel.createdAt = new Date().toISOString();
    funnels.push(funnel);
  }

  fs.writeFileSync(FUNNELS_FILE, JSON.stringify(funnels, null, 2));
  return funnel;
}

// ファネルを削除
export function deleteFunnel(id: string): boolean {
  const funnels = getAllFunnels();
  const filtered = funnels.filter(f => f.id !== id);

  if (filtered.length === funnels.length) {
    return false;
  }

  fs.writeFileSync(FUNNELS_FILE, JSON.stringify(filtered, null, 2));
  return true;
}

// 全フォルダを取得
export function getAllFolders(): Folder[] {
  ensureDataDir();
  if (!fs.existsSync(FOLDERS_FILE)) {
    return [];
  }
  const data = fs.readFileSync(FOLDERS_FILE, 'utf-8');
  return JSON.parse(data);
}

// 特定のフォルダを取得
export function getFolder(id: string): Folder | null {
  const folders = getAllFolders();
  return folders.find(f => f.id === id) || null;
}

// フォルダを保存（新規 or 更新）
export function saveFolder(folder: Folder): Folder {
  ensureDataDir();
  const folders = getAllFolders();
  const index = folders.findIndex(f => f.id === folder.id);

  folder.updatedAt = new Date().toISOString();

  if (index >= 0) {
    folders[index] = folder;
  } else {
    folder.createdAt = new Date().toISOString();
    folders.push(folder);
  }

  fs.writeFileSync(FOLDERS_FILE, JSON.stringify(folders, null, 2));
  return folder;
}

// フォルダを削除
export function deleteFolder(id: string): boolean {
  const folders = getAllFolders();
  const filtered = folders.filter(f => f.id !== id);

  if (filtered.length === folders.length) {
    return false;
  }

  fs.writeFileSync(FOLDERS_FILE, JSON.stringify(filtered, null, 2));
  return true;
}

// ノードを追加
export function addNode(funnelId: string, node: any): Funnel | null {
  const funnel = getFunnel(funnelId);
  if (!funnel) return null;

  funnel.canvasNodes = funnel.canvasNodes || [];
  funnel.canvasNodes.push(node);
  return saveFunnel(funnel);
}

// ノードを更新
export function updateNode(funnelId: string, nodeId: string, updates: any): Funnel | null {
  const funnel = getFunnel(funnelId);
  if (!funnel) return null;

  funnel.canvasNodes = funnel.canvasNodes || [];
  const index = funnel.canvasNodes.findIndex((n: any) => n.id === nodeId);
  if (index < 0) return null;

  funnel.canvasNodes[index] = { ...funnel.canvasNodes[index], ...updates };
  return saveFunnel(funnel);
}

// ノードを削除
export function deleteNode(funnelId: string, nodeId: string): Funnel | null {
  const funnel = getFunnel(funnelId);
  if (!funnel) return null;

  funnel.canvasNodes = funnel.canvasNodes || [];
  funnel.canvasNodes = funnel.canvasNodes.filter((n: any) => n.id !== nodeId);
  // 関連するエッジも削除
  funnel.canvasEdges = (funnel.canvasEdges || []).filter(
    (e: any) => e.source !== nodeId && e.target !== nodeId
  );
  return saveFunnel(funnel);
}

// エッジを追加（追加後に自動整列）
export function addEdge(funnelId: string, edge: any): Funnel | null {
  const funnel = getFunnel(funnelId);
  if (!funnel) return null;

  funnel.canvasEdges = funnel.canvasEdges || [];
  funnel.canvasEdges.push(edge);

  // 自動整列
  funnel.canvasNodes = layoutNodes(funnel.canvasNodes || [], funnel.canvasEdges);

  return saveFunnel(funnel);
}

// 手動で自動整列
export function autoLayout(funnelId: string): Funnel | null {
  const funnel = getFunnel(funnelId);
  if (!funnel) return null;

  funnel.canvasNodes = layoutNodes(funnel.canvasNodes || [], funnel.canvasEdges || []);
  return saveFunnel(funnel);
}
