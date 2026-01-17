'use client';

import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  NodeTypes,
  EdgeTypes,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { FunnelNode } from './nodes/FunnelNode';
import { TaskEdge } from './edges/TaskEdge';
import { PhaseBackground, PhaseHeader } from './PhaseBackground';

// フェーズの型
interface Phase {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

// フェーズの色（薄い背景色）
const PHASE_COLORS = [
  'rgba(244, 244, 245, 0.55)', // neutral-100
  'rgba(250, 250, 249, 0.55)', // stone-50
  'rgba(239, 246, 255, 0.45)', // blue-50
  'rgba(240, 253, 250, 0.45)', // teal-50
  'rgba(254, 252, 232, 0.45)', // yellow-50
  'rgba(255, 247, 237, 0.45)', // orange-50
];

const NODE_WIDTH = 150;
const NODE_HEIGHT = 50;
const ROW_GAP = 80;

// 自動レイアウト（左上から右下への対角線フロー）
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 }); // TB = Top to Bottom

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // 各ノードのランク（深さ）を計算してX方向にオフセット
  const nodeRanks: Record<string, number> = {};
  const calculateRank = (nodeId: string, visited: Set<string> = new Set()): number => {
    if (visited.has(nodeId)) return nodeRanks[nodeId] || 0;
    visited.add(nodeId);

    const incomingEdges = edges.filter(e => e.target === nodeId);
    if (incomingEdges.length === 0) {
      nodeRanks[nodeId] = 0;
      return 0;
    }

    const maxParentRank = Math.max(...incomingEdges.map(e => calculateRank(e.source, visited)));
    nodeRanks[nodeId] = maxParentRank + 1;
    return nodeRanks[nodeId];
  };

  nodes.forEach(node => calculateRank(node.id));

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const rank = nodeRanks[node.id] || 0;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2 + rank * 100, // フェーズごとに右にずらす
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// ノードタイプ
const nodeTypes: NodeTypes = {
  funnel: FunnelNode,
};

// エッジタイプ
const edgeTypes: EdgeTypes = {
  task: TaskEdge,
};

// ノードの色プリセット
const NODE_COLORS = [
  { bg: '#ffffff', border: '#cbd5e1', name: 'ニュートラル' },
  { bg: '#eff6ff', border: '#60a5fa', name: 'ブルー' },
  { bg: '#ecfdf3', border: '#34d399', name: 'グリーン' },
  { bg: '#fff7ed', border: '#fb923c', name: 'オレンジ' },
  { bg: '#fdf2f8', border: '#f472b6', name: 'ピンク' },
  { bg: '#f5f3ff', border: '#a78bfa', name: 'パープル' },
];

// デフォルトノードスタイル
const DEFAULT_NODE_STYLE = NODE_COLORS[0];

interface KPI {
  target: number;
  rate: number;
  width: number; // フェーズの幅
}

interface FreeCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  initialPhaseNames?: string[];
  initialKPIs?: KPI[];
  onSave: (nodes: Node[], edges: Edge[], phaseNames?: string[], kpis?: KPI[]) => void;
  onCollapseChange?: (collapsed: boolean) => void;
  onSectionDragStart?: () => void;
  onSectionDragEnd?: () => void;
}

// デフォルトのフェーズ設定
const DEFAULT_PHASE_NAMES = ['流入', 'アクション', '教育', '販売', 'CV'];

// デフォルトのKPI設定
const DEFAULT_KPIS: KPI[] = [
  { target: 1000, rate: 100, width: 200 },  // 流入
  { target: 700, rate: 70, width: 200 },    // アクション
  { target: 490, rate: 70, width: 200 },    // 教育
  { target: 245, rate: 50, width: 200 },    // 販売
  { target: 49, rate: 20, width: 200 },     // CV
];

// 履歴の型
interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

function FreeCanvasInner({ initialNodes, initialEdges, initialPhaseNames, initialKPIs, onSave, onCollapseChange, onSectionDragStart, onSectionDragEnd }: FreeCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [phaseNames, setPhaseNames] = useState<string[]>(initialPhaseNames || DEFAULT_PHASE_NAMES);
  const [kpis, setKpis] = useState<KPI[]>(initialKPIs || DEFAULT_KPIS);
  const [editingPhase, setEditingPhase] = useState<number | null>(null);
  const [editingKPIPhase, setEditingKPIPhase] = useState<number | null>(null);
  const [showKPI, setShowKPI] = useState(false);
  const [showKPISummary, setShowKPISummary] = useState(false);
  const [isCanvasCollapsed, setIsCanvasCollapsed] = useState(false);
  const [draggingKPIIndex, setDraggingKPIIndex] = useState<number | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const onSaveRef = useRef(onSave);
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'task',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
    }),
    []
  );
  const snapGrid = useMemo(() => [15, 15] as [number, number], []);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // 履歴管理
  const [history, setHistory] = useState<HistoryState[]>([{ nodes: initialNodes, edges: initialEdges }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoing = useRef(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // 状態変更時に履歴に追加（debounce）
  useEffect(() => {
    if (isUndoing.current) return;
    // 初期化前は何もしない
    if (!isInitialized.current) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      setHistory(prev => {
        // 現在の状態と同じなら保存しない
        const current = prev[historyIndex];
        if (current &&
            JSON.stringify(current.nodes) === JSON.stringify(nodes) &&
            JSON.stringify(current.edges) === JSON.stringify(edges)) {
          return prev;
        }

        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push({ nodes: [...nodes], edges: [...edges] });
        // 最大50件まで保持
        if (newHistory.length > 50) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex(prev => {
        const current = history[prev];
        if (current &&
            JSON.stringify(current.nodes) === JSON.stringify(nodes) &&
            JSON.stringify(current.edges) === JSON.stringify(edges)) {
          return prev;
        }
        return Math.min(prev + 1, 49);
      });
    }, 500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [nodes, edges]);

  // 戻す
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    isUndoing.current = true;
    const prevState = history[historyIndex - 1];
    setNodes(prevState.nodes);
    setEdges(prevState.edges);
    setHistoryIndex(historyIndex - 1);
    setTimeout(() => { isUndoing.current = false; }, 600);
  }, [history, historyIndex, setNodes, setEdges]);

  // やり直す
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    isUndoing.current = true;
    const nextState = history[historyIndex + 1];
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setHistoryIndex(historyIndex + 1);
    setTimeout(() => { isUndoing.current = false; }, 600);
  }, [history, historyIndex, setNodes, setEdges]);

  // フェーズカラム（幅はKPIから取得）
  const PHASE_HEIGHT = 10000; // フェーズの高さ（十分大きく）
  const PHASE_START_Y = -2000; // 開始Y位置（上方向に余裕を持たせる）
  const PHASE_START_X = -100; // 開始X位置（左に余白を持たせる）

  const phases = useMemo((): Phase[] => {
    let currentX = PHASE_START_X;
    return phaseNames.map((name, i) => {
      const width = kpis[i]?.width || 200;
      const phase = {
        id: i,
        name,
        x: currentX,
        y: PHASE_START_Y,
        width,
        height: PHASE_HEIGHT,
        color: PHASE_COLORS[i % PHASE_COLORS.length],
      };
      currentX += width;
      return phase;
    });
  }, [phaseNames, kpis]);

  // フェーズ名変更
  const handlePhaseNameChange = (index: number, name: string) => {
    const newNames = [...phaseNames];
    newNames[index] = name;
    setPhaseNames(newNames);
  };

  // エッジのタスク変更
  const handleTaskChange = useCallback((edgeId: string, task: string) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, task, onTaskChange: handleTaskChange } } : e
      )
    );
  }, [setEdges]);

  // 自動整列
  const autoLayout = useCallback(() => {
    const minPhaseWidth = 180;
    const phasePadding = 20;

    const phaseIndexByNode = new Map<string, number>();
    phases.forEach((phase, phaseIndex) => {
      nodes.forEach((node) => {
        const centerX = node.position.x + NODE_WIDTH / 2;
        if (centerX >= phase.x && centerX <= phase.x + phase.width) {
          phaseIndexByNode.set(node.id, phaseIndex);
        }
      });
    });

    const phaseMaxRight = new Map<number, number>();
    phases.forEach((phase, phaseIndex) => {
      let maxRight = phase.x + phase.width;
      nodes.forEach((node) => {
        if (phaseIndexByNode.get(node.id) === phaseIndex) {
          maxRight = Math.max(maxRight, node.position.x + NODE_WIDTH + phasePadding);
        }
      });
      phaseMaxRight.set(phaseIndex, maxRight);
    });

    const nextKpis = kpis.map((kpi, phaseIndex) => {
      const phase = phases[phaseIndex];
      const maxRight = phaseMaxRight.get(phaseIndex) || phase.x + phase.width;
      const requiredWidth = Math.max(minPhaseWidth, maxRight - phase.x);
      return { ...kpi, width: Math.max(kpi.width, Math.round(requiredWidth)) };
    });

    const phaseShift = new Map<number, number>();
    let cumulativeShift = 0;
    phases.forEach((phase, phaseIndex) => {
      phaseShift.set(phaseIndex, cumulativeShift);
      const delta = (nextKpis[phaseIndex]?.width || phase.width) - phase.width;
      cumulativeShift += Math.max(0, delta);
    });

    const shiftedNodes = nodes.map((node) => {
      const phaseIndex = phaseIndexByNode.get(node.id) ?? 0;
      const shift = phaseShift.get(phaseIndex) || 0;
      return {
        ...node,
        position: {
          ...node.position,
          x: Math.round(node.position.x + shift),
        },
      };
    });

    setKpis(nextKpis);
    setNodes(shiftedNodes.map((node) => ({ ...node, position: { ...node.position } })));
  }, [nodes, setNodes, phases, kpis, setKpis]);

  // ノード接続時
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: 'task',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#999' },
        style: { stroke: '#999', strokeWidth: 1.5 },
        data: { task: '', onTaskChange: handleTaskChange },
      };

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, handleTaskChange]
  );

  // 選択中のノード/エッジを削除
  const handleDelete = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    const selectedEdges = edges.filter(e => e.selected);

    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      const selectedNodeIds = selectedNodes.map(n => n.id);
      // 選択されたノードに接続されているエッジも削除
      setEdges(prev => prev.filter(e =>
        !e.selected &&
        !selectedNodeIds.includes(e.source) &&
        !selectedNodeIds.includes(e.target)
      ));
      setNodes(prev => prev.filter(n => !n.selected));
    }
  }, [nodes, edges, setNodes, setEdges]);

  // 右クリックメニュー
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // キーボードイベント（Delete/Backspace, Cmd+Z/Ctrl+Z, Esc）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escキーでコンテキストメニューを閉じる
      if (e.key === 'Escape') {
        setContextMenu(null);
        return;
      }

      // 入力フィールドにフォーカスがある場合は無視
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      // Delete/Backspace で削除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete();
      }

      // Cmd+Z / Ctrl+Z で戻す
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Cmd+Shift+Z / Ctrl+Shift+Z でやり直す
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete, handleUndo, handleRedo]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // コンテキストメニューから削除
  const handleContextDelete = useCallback(() => {
    if (!contextMenu) return;
    const nodeId = contextMenu.nodeId;
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setContextMenu(null);
  }, [contextMenu, setNodes, setEdges]);

  // コンテキストメニューから色変更
  const handleContextColorChange = useCallback((color: { bg: string; border: string }) => {
    if (!contextMenu) return;
    const nodeId = contextMenu.nodeId;
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, bg: color.bg, border: color.border } } : n
    ));
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  // コンテキストメニューからKPI表示切り替え
  const handleContextToggleKpi = useCallback(() => {
    if (!contextMenu) return;
    const nodeId = contextMenu.nodeId;
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, showKpi: !n.data?.showKpi } } : n
    ));
    setContextMenu(null);
  }, [contextMenu, setNodes]);

  // コンテキストメニューからコメント編集
  const [editingComment, setEditingComment] = useState<string | null>(null);

  const handleContextComment = useCallback(() => {
    if (!contextMenu) return;
    setEditingComment(contextMenu.nodeId);
    setContextMenu(null);
  }, [contextMenu]);

  const handleCommentSave = useCallback((nodeId: string, comment: string) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, comment } } : n
    ));
    setEditingComment(null);
  }, [setNodes]);

  // KPIサマリー表示
  const handleKPISummary = useCallback(() => {
    setShowKPISummary(true);
  }, []);

  // キャンバス変更を自動で親へ反映
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = setTimeout(() => {
      onSaveRef.current(nodes, edges, phaseNames, kpis);
    }, 400);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [nodes, edges, phaseNames, kpis]);

  // KPI更新（目標値）
  const handleKPITargetChange = useCallback((index: number, target: number) => {
    setKpis(prev => {
      const newKpis = [...prev];
      newKpis[index] = { ...newKpis[index], target };
      // 自動計算: 次のフェーズからCVRを再計算
      for (let i = index + 1; i < newKpis.length; i++) {
        const prevTarget = newKpis[i - 1].target;
        const rate = newKpis[i].rate;
        newKpis[i] = { ...newKpis[i], target: Math.round(prevTarget * rate / 100) };
      }
      return newKpis;
    });
  }, []);

  // KPI更新（CVR）
  const handleKPIRateChange = useCallback((index: number, rate: number) => {
    setKpis(prev => {
      const newKpis = [...prev];
      newKpis[index] = { ...newKpis[index], rate };
      // 自動計算: 現在のフェーズの目標値を再計算
      if (index > 0) {
        const prevTarget = newKpis[index - 1].target;
        newKpis[index] = { ...newKpis[index], target: Math.round(prevTarget * rate / 100) };
      }
      // 以降のフェーズも再計算
      for (let i = index + 1; i < newKpis.length; i++) {
        const prevTarget = newKpis[i - 1].target;
        const r = newKpis[i].rate;
        newKpis[i] = { ...newKpis[i], target: Math.round(prevTarget * r / 100) };
      }
      return newKpis;
    });
  }, []);

  // 全体CVR計算
  const totalCVR = useMemo(() => {
    if (kpis.length < 2 || kpis[0].target === 0) return 0;
    return ((kpis[kpis.length - 1].target / kpis[0].target) * 100).toFixed(1);
  }, [kpis]);

  // KPI項目を追加
  const handleAddKPI = useCallback(() => {
    const newPhaseName = `フェーズ${phaseNames.length + 1}`;
    const lastTarget = kpis[kpis.length - 1]?.target || 100;
    const newKPI: KPI = { target: Math.round(lastTarget * 0.5), rate: 50, width: 200 };
    setPhaseNames([...phaseNames, newPhaseName]);
    setKpis([...kpis, newKPI]);
  }, [phaseNames, kpis]);

  // フェーズ幅変更（右側のノードも一緒に移動）
  const handleKPIWidthChange = useCallback((index: number, newWidth: number) => {
    const safeWidth = Math.max(100, newWidth);
    const oldWidth = kpis[index]?.width || 200;
    const delta = safeWidth - oldWidth;

    if (delta === 0) return;

    // 変更フェーズの右端位置（変更前）を計算
    let phaseRightEdge = PHASE_START_X;
    for (let i = 0; i <= index; i++) {
      phaseRightEdge += kpis[i]?.width || 200;
    }

    // KPI幅を更新
    setKpis(prev => {
      const newKpis = [...prev];
      newKpis[index] = { ...newKpis[index], width: safeWidth };
      return newKpis;
    });

    // phaseRightEdge より右にあるノードをdelta分移動
    setNodes(prev => prev.map(node => {
      if (node.position.x >= phaseRightEdge) {
        return {
          ...node,
          position: {
            ...node.position,
            x: node.position.x + delta,
          },
        };
      }
      return node;
    }));
  }, [kpis, setNodes]);

  // KPI項目を削除
  const handleDeleteKPI = useCallback((index: number) => {
    if (phaseNames.length <= 2) return; // 最低2つは必要
    setPhaseNames(phaseNames.filter((_, i) => i !== index));
    setKpis(kpis.filter((_, i) => i !== index));
  }, [phaseNames, kpis]);

  // KPI項目のドラッグ&ドロップ
  const handleKPIDragStart = useCallback((index: number) => {
    setDraggingKPIIndex(index);
  }, []);

  const handleKPIDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggingKPIIndex === null || draggingKPIIndex === index) return;

    // 並び替え
    const newNames = [...phaseNames];
    const newKpis = [...kpis];
    const [movedName] = newNames.splice(draggingKPIIndex, 1);
    const [movedKpi] = newKpis.splice(draggingKPIIndex, 1);
    newNames.splice(index, 0, movedName);
    newKpis.splice(index, 0, movedKpi);

    setPhaseNames(newNames);
    setKpis(newKpis);
    setDraggingKPIIndex(index);
  }, [draggingKPIIndex, phaseNames, kpis]);

  const handleKPIDragEnd = useCallback(() => {
    setDraggingKPIIndex(null);
  }, []);

  // ドラッグ&ドロップでノード追加
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (nodeType !== 'node') return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 75,
        y: event.clientY - reactFlowBounds.top - 25,
      };

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: 'funnel',
        position,
        data: {
          label: 'ノード',
          bg: DEFAULT_NODE_STYLE.bg,
          border: DEFAULT_NODE_STYLE.border,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  // ドラッグ開始
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // 折りたたみ状態変更時にコールバック
  const handleCollapseToggle = useCallback(() => {
    const newState = !isCanvasCollapsed;
    setIsCanvasCollapsed(newState);
    onCollapseChange?.(newState);
  }, [isCanvasCollapsed, onCollapseChange]);

  return (
    <div className="h-full flex flex-col">
      {/* ファネルヘッダー（折りたたみボタン付き） */}
      <div className="panel-header flex items-center justify-between px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="text-gray-300 cursor-grab"
            draggable
            onDragStart={onSectionDragStart}
            onDragEnd={onSectionDragEnd}
          >⋮⋮</span>
          <span className="text-sm font-medium text-gray-700">ファネル設計</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCollapseToggle}
            className="px-2 py-1 text-gray-400 hover:text-gray-600"
          >
            {isCanvasCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* 折りたたみ可能なキャンバス部分 */}
      {!isCanvasCollapsed && (
        <div className="flex-1 flex min-h-0">
          {/* 左パネル: ファネル / KPI タブ切替 */}
          <div className="w-48 panel-side flex flex-col">
            {/* タブ */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setShowKPI(false)}
                className={`flex-1 py-2 text-xs ${!showKPI ? 'panel-tab-active bg-white/60' : 'panel-tab hover:bg-white/60'}`}
              >
                ファネル
              </button>
              <button
                onClick={() => setShowKPI(true)}
                className={`flex-1 py-2 text-xs ${showKPI ? 'panel-tab-active bg-white/60' : 'panel-tab hover:bg-white/60'}`}
              >
                KPI
              </button>
            </div>

        {!showKPI ? (
          /* ファネルパネル */
          <div className="p-3 flex flex-col flex-1">
            {/* ノード追加（ドラッグ） */}
            <div
              draggable
              onDragStart={(e) => onDragStart(e, 'node')}
              className="p-3 rounded border cursor-grab active:cursor-grabbing hover:bg-gray-100 transition text-sm text-gray-700 text-center mb-4"
              style={{ backgroundColor: DEFAULT_NODE_STYLE.bg, borderColor: DEFAULT_NODE_STYLE.border }}
            >
              ノードを追加
            </div>

            <p className="text-[10px] text-gray-400">右クリックで色変更・削除</p>

            <div className="flex-1" />

            {/* 戻す・やり直すボタン */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-100 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                戻す
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-100 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                進む
              </button>
            </div>

            {/* 整列ボタン */}
            <button
              onClick={autoLayout}
              className="mt-2 w-full border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-100 transition text-sm"
            >
              自動整列
            </button>

          </div>
        ) : (
          /* KPIパネル */
          <div className="p-3 flex flex-col flex-1 overflow-auto">
            <div className="space-y-2 flex-1">
              {phaseNames.map((phaseName, i) => (
                <div
                  key={i}
                  className={`border rounded p-2 relative group cursor-grab active:cursor-grabbing ${
                    draggingKPIIndex === i ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                  }`}
                  draggable
                  onDragStart={() => handleKPIDragStart(i)}
                  onDragOver={(e) => handleKPIDragOver(e, i)}
                  onDragEnd={handleKPIDragEnd}
                >
                  {/* 削除ボタン（ホバー時表示） */}
                  <div className="absolute -right-1 top-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleDeleteKPI(i)}
                      disabled={phaseNames.length <= 2}
                      className="w-5 h-5 text-[10px] bg-red-50 hover:bg-red-100 text-red-500 rounded disabled:opacity-30"
                    >
                      x
                    </button>
                  </div>

                  {/* ドラッグハンドル */}
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-300 text-xs">⋮⋮</div>

                  {/* フェーズ名（クリックで編集可能） */}
                  {editingKPIPhase === i ? (
                    <input
                      type="text"
                      defaultValue={phaseName}
                      onBlur={(e) => {
                        handlePhaseNameChange(i, e.target.value);
                        setEditingKPIPhase(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePhaseNameChange(i, e.currentTarget.value);
                          setEditingKPIPhase(null);
                        }
                        if (e.key === 'Escape') setEditingKPIPhase(null);
                      }}
                      className="text-xs text-gray-700 mb-1 border border-gray-300 rounded px-1 w-full focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <div
                      className="text-xs text-gray-500 mb-1 cursor-pointer hover:text-gray-700"
                      onClick={() => setEditingKPIPhase(i)}
                    >
                      {phaseName}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={kpis[i]?.target || 0}
                      onChange={(e) => handleKPITargetChange(i, parseInt(e.target.value) || 0)}
                      className="w-16 text-sm border border-gray-300 rounded px-1 py-0.5 text-right"
                    />
                    <span className="text-xs text-gray-400">人</span>
                  </div>
                  {i > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">CVR:</span>
                      <input
                        type="number"
                        value={kpis[i]?.rate || 0}
                        onChange={(e) => handleKPIRateChange(i, parseInt(e.target.value) || 0)}
                        className="w-12 text-sm border border-gray-300 rounded px-1 py-0.5 text-right"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  )}
                </div>
              ))}

              {/* 追加ボタン */}
              <button
                onClick={handleAddKPI}
                className="w-full border border-dashed border-gray-300 text-gray-400 py-2 rounded hover:bg-gray-50 hover:text-gray-600 transition text-xs"
              >
                + 項目を追加
              </button>
            </div>

            {/* 全体CVR */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-1">全体CVR</div>
              <div className="text-lg font-medium text-gray-700">{totalCVR}%</div>
              <div className="text-xs text-gray-400 mt-1">
                {kpis[0]?.target || 0} → {kpis[kpis.length - 1]?.target || 0}人
              </div>
            </div>

            {/* KPIサマリーボタン */}
            <button
              onClick={handleKPISummary}
              className="mt-3 w-full border border-gray-400 text-gray-700 py-2 rounded hover:bg-gray-100 transition text-sm"
            >
              サマリー表示
            </button>
          </div>
        )}
      </div>

      {/* キャンバス */}
      <div className="flex-1 relative bg-white" ref={reactFlowWrapper}>
        {/* フェーズヘッダー（固定、ズームに幅が連動） */}
        <PhaseHeader
          phases={phases}
          onPhaseNameChange={handlePhaseNameChange}
          onWidthChange={handleKPIWidthChange}
          onAddPhase={handleAddKPI}
          onDeletePhase={handleDeleteKPI}
          editingPhase={editingPhase}
          setEditingPhase={setEditingPhase}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneClick={closeContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={false}
          snapToGrid
          snapGrid={snapGrid}
          panOnDrag
          zoomOnScroll
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={defaultEdgeOptions}
        >
          <PhaseBackground phases={phases} />
          <Background color="#fafafa" gap={20} />
          <Controls position="bottom-left" />
          {/* KPIサマリーパネル */}
          {showKPISummary && (
            <Panel position="top-right" className="bg-white p-2 rounded border border-gray-200 shadow-sm text-xs" style={{ marginTop: '40px', marginRight: '10px' }}>
              <div className="min-w-[180px]">
                <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-200">
                  <span className="text-gray-600 font-medium">KPI</span>
                  <button
                    onClick={() => setShowKPISummary(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-1">
                  {phaseNames.map((name, i) => (
                    <div key={i} className="flex justify-between items-center text-gray-600">
                      <span>{name}</span>
                      <span className="font-medium">
                        {kpis[i]?.target || 0}人
                        {i > 0 && <span className="text-gray-400 ml-1">({kpis[i]?.rate || 0}%)</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-gray-500">全体CVR</span>
                  <span className="font-medium text-gray-700">{totalCVR}%</span>
                </div>
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* 右クリックコンテキストメニュー */}
        {contextMenu && (
          <div
            className="fixed bg-white border border-gray-200 rounded shadow-lg py-1 z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={handleContextToggleKpi}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              KPIを表示/非表示
            </button>
            <button
              onClick={handleContextComment}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              コメント編集
            </button>
            <div className="border-t border-gray-100 my-1" />
            <div className="px-4 py-1 text-xs text-gray-500">色を変更</div>
            <div className="flex gap-1 px-4 py-1">
              {NODE_COLORS.map((color, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded border cursor-pointer hover:opacity-80"
                  style={{ backgroundColor: color.bg, borderColor: color.border }}
                  onClick={() => handleContextColorChange(color)}
                />
              ))}
            </div>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={handleContextDelete}
              className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50"
            >
              削除
            </button>
          </div>
        )}

        {/* コメント編集モーダル */}
        {editingComment && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditingComment(null)}>
            <div className="bg-white rounded-lg p-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="text-sm text-gray-600 mb-2">コメント</div>
              <textarea
                className="w-64 h-24 border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-gray-400"
                defaultValue={nodes.find(n => n.id === editingComment)?.data?.comment || ''}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleCommentSave(editingComment, e.currentTarget.value);
                  }
                }}
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setEditingComment(null)}
                  className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  キャンセル
                </button>
                <button
                  onClick={(e) => {
                    const textarea = e.currentTarget.parentElement?.parentElement?.querySelector('textarea');
                    if (textarea) handleCommentSave(editingComment, textarea.value);
                  }}
                  className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
}

// ReactFlowProviderでラップ
export function FreeCanvas(props: FreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <FreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
