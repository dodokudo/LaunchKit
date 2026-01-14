'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Funnel, Segment, DeliveryItem, Connection, SegmentTransition, DELIVERY_TYPES, KPI, Task, Period } from '@/types/funnel';
import { SegmentPanel } from './SegmentPanel';
import { FreeCanvas } from './FreeCanvas';
import { DeliveryModal } from './DeliveryModal';
import { SettingsPanel } from './SettingsPanel';
import { Node, Edge } from 'reactflow';

interface TimelineEditorProps {
  funnel: Funnel;
  onUpdate: (funnel: Funnel) => void;
}

export function TimelineEditor({ funnel, onUpdate }: TimelineEditorProps) {
  const [selectedCell, setSelectedCell] = useState<{ date: string; segmentId: string } | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<DeliveryItem | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [isCanvasCollapsed, setIsCanvasCollapsed] = useState(false);
  const [isTaskListCollapsed, setIsTaskListCollapsed] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(50); // パーセント
  const [taskListHeight, setTaskListHeight] = useState(200); // ピクセル
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingTaskList, setIsResizingTaskList] = useState(false);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [sectionOrder, setSectionOrder] = useState<('funnel' | 'schedule' | 'tasks')[]>(['funnel', 'schedule', 'tasks']);
  const [draggingSection, setDraggingSection] = useState<string | null>(null);
  const [isScheduleCollapsed, setIsScheduleCollapsed] = useState(false);
  const [scheduleHeight, setScheduleHeight] = useState(50); // パーセント（展開時）
  const [scheduleTab, setScheduleTab] = useState<'segment' | 'settings'>('segment');
  const [isResizingSchedule, setIsResizingSchedule] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [segmentNameDrafts, setSegmentNameDrafts] = useState<Record<string, string>>({});
  const [taskCategoryDrafts, setTaskCategoryDrafts] = useState<string[]>([]);
  const [taskTitleDrafts, setTaskTitleDrafts] = useState<Record<string, string>>({});

  // 共通の左パネル幅（ファネル設計のKPIパネルと同じ幅）
  const LEFT_PANEL_WIDTH = 'w-48';

  // フェーズ名（FreeCanvasと同期）
  const phaseNames = funnel.phaseNames || ['流入', 'アクション', '教育', '販売', 'CV'];
  const tasks = funnel.tasks || [];

  // タスクリスト用のカテゴリ（ファネルと独立）
  const taskCategories = funnel.taskCategories || funnel.taskPhases || phaseNames;

  // 期間（タイムライン上部の色帯）
  const periods = funnel.periods || [];
  const addDays = (dateStr: string, days: number) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const getPeriodDays = (period: Period) => {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  };

  const basePeriod = useMemo(() => {
    if (!funnel.baseDate) return null;
    const days = funnel.baseDateDays || 1;
    const endDate = addDays(funnel.baseDate, days - 1) || funnel.baseDate;
    return {
      id: 'base-period',
      name: funnel.baseDateLabel || '販売期間',
      startDate: funnel.baseDate,
      endDate,
      color: '#FEE2E2',
    };
  }, [funnel.baseDate, funnel.baseDateDays, funnel.baseDateLabel]);

  const displayPeriods = useMemo(() => {
    return basePeriod ? [...periods, basePeriod] : periods;
  }, [periods, basePeriod]);

  const visibleSectionOrder = useMemo(() => {
    return isTaskListCollapsed ? sectionOrder.filter((section) => section !== 'tasks') : sectionOrder;
  }, [isTaskListCollapsed, sectionOrder]);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    funnel.segments.forEach((segment) => {
      nextDrafts[segment.id] = segment.name;
    });
    setSegmentNameDrafts(nextDrafts);
  }, [funnel.segments]);

  useEffect(() => {
    setTaskCategoryDrafts(taskCategories);
  }, [taskCategories]);

  useEffect(() => {
    setTaskTitleDrafts((prev) => {
      const next = { ...prev };
      tasks.forEach((task) => {
        if (next[task.id] === undefined) {
          next[task.id] = task.title;
        }
      });
      Object.keys(next).forEach((id) => {
        if (!tasks.find((task) => task.id === id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [tasks]);

  // リサイズ処理（ファネル設計）
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newHeight = ((e.clientY - rect.top) / rect.height) * 100;
      // 10%〜90%の範囲に制限
      setCanvasHeight(Math.min(90, Math.max(10, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // リサイズ処理（タスクリスト）
  useEffect(() => {
    if (!isResizingTaskList) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;
      // 100px〜500pxの範囲に制限
      setTaskListHeight(Math.min(500, Math.max(100, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizingTaskList(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTaskList]);

  // リサイズ処理（スケジュール）
  useEffect(() => {
    if (!isResizingSchedule) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newHeight = ((e.clientY - rect.top) / rect.height) * 100;
      // 10%〜80%の範囲に制限
      setScheduleHeight(Math.min(80, Math.max(10, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizingSchedule(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSchedule]);

  // セクション順序ドラッグ処理
  const handleSectionDragStart = (section: string) => {
    setDraggingSection(section);
  };

  const handleSectionDragOver = (e: React.DragEvent, targetSection: string) => {
    e.preventDefault();
    if (!draggingSection || draggingSection === targetSection) return;

    const dragIndex = sectionOrder.indexOf(draggingSection as any);
    const targetIndex = sectionOrder.indexOf(targetSection as any);
    if (dragIndex === -1 || targetIndex === -1) return;

    const newOrder = [...sectionOrder];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(targetIndex, 0, draggingSection as any);
    setSectionOrder(newOrder);
  };

  const handleSectionDragEnd = () => {
    setDraggingSection(null);
  };

  // タスクカテゴリ追加
  const handleAddTaskCategory = () => {
    const newCategories = [...taskCategories, `カテゴリ${taskCategories.length + 1}`];
    onUpdate({
      ...funnel,
      taskCategories: newCategories,
      updatedAt: new Date().toISOString(),
    });
  };

  // タスクカテゴリ削除
  const handleDeleteTaskCategory = (index: number) => {
    if (taskCategories.length <= 1) return;
    const newCategories = taskCategories.filter((_, i) => i !== index);
    // タスクのカテゴリインデックスも調整
    const newTasks = tasks.map(t => {
      if (t.phaseIndex === index) return { ...t, phaseIndex: 0 };
      if (t.phaseIndex > index) return { ...t, phaseIndex: t.phaseIndex - 1 };
      return t;
    });
    onUpdate({
      ...funnel,
      taskCategories: newCategories,
      tasks: newTasks,
      updatedAt: new Date().toISOString(),
    });
  };

  // タスクカテゴリ名変更
  const handleTaskCategoryNameChange = (index: number, name: string) => {
    const newCategories = [...taskCategories];
    newCategories[index] = name;
    onUpdate({
      ...funnel,
      taskCategories: newCategories,
      updatedAt: new Date().toISOString(),
    });
  };

  // タスク追加
  const handleAddTask = (phaseIndex: number) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: '',
      phaseIndex,
      completed: false,
      order: tasks.filter(t => t.phaseIndex === phaseIndex).length,
    };
    onUpdate({
      ...funnel,
      tasks: [...tasks, newTask],
      updatedAt: new Date().toISOString(),
    });
    setEditingTaskId(newTask.id);
  };

  // タスク更新
  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    onUpdate({
      ...funnel,
      tasks: tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
      updatedAt: new Date().toISOString(),
    });
  };

  const commitTaskTitle = (taskId: string) => {
    const nextTitle = (taskTitleDrafts[taskId] ?? '').trim();
    handleUpdateTask(taskId, { title: nextTitle });
    setEditingTaskId(null);
  };

  // タスク削除
  const handleDeleteTask = (taskId: string) => {
    onUpdate({
      ...funnel,
      tasks: tasks.filter(t => t.id !== taskId),
      updatedAt: new Date().toISOString(),
    });
  };

  // タスクドラッグ開始
  const handleTaskDragStart = (task: Task) => {
    setDraggingTask(task);
  };

  // タスクドロップ（カテゴリ間移動）
  const handleTaskDrop = (phaseIndex: number) => {
    if (!draggingTask) return;
    if (draggingTask.phaseIndex === phaseIndex) {
      setDraggingTask(null);
      return;
    }
    // カテゴリを移動
    const newOrder = tasks.filter(t => t.phaseIndex === phaseIndex).length;
    handleUpdateTask(draggingTask.id, { phaseIndex, order: newOrder });
    setDraggingTask(null);
  };

  // 期間追加
  const handleAddPeriod = () => {
    const newPeriod: Period = {
      id: `period-${Date.now()}`,
      name: '新しい期間',
      startDate: funnel.startDate,
      endDate: funnel.startDate,
      color: '#E5E7EB', // gray-200
    };
    onUpdate({
      ...funnel,
      periods: [...periods, newPeriod],
      updatedAt: new Date().toISOString(),
    });
  };

  // 期間更新
  const handleUpdatePeriod = (periodId: string, updates: Partial<Period>) => {
    onUpdate({
      ...funnel,
      periods: periods.map(p => p.id === periodId ? { ...p, ...updates } : p),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdatePeriodStartDate = (periodId: string, startDate: string) => {
    const period = periods.find(p => p.id === periodId);
    const days = period ? getPeriodDays(period) : 1;
    const endDate = addDays(startDate, days - 1) || startDate;
    handleUpdatePeriod(periodId, { startDate, endDate });
  };

  const handleUpdatePeriodDays = (periodId: string, days: number) => {
    const period = periods.find(p => p.id === periodId);
    const startDate = period?.startDate || funnel.startDate;
    const safeDays = Math.max(1, days || 1);
    const endDate = addDays(startDate, safeDays - 1) || startDate;
    handleUpdatePeriod(periodId, { startDate, endDate });
  };

  // 期間削除
  const handleDeletePeriod = (periodId: string) => {
    onUpdate({
      ...funnel,
      periods: periods.filter(p => p.id !== periodId),
      updatedAt: new Date().toISOString(),
    });
  };

  // 期間の色プリセット
  const PERIOD_COLORS = [
    { color: '#FEE2E2', name: '赤（販売）' },
    { color: '#FEF3C7', name: '黄（準備）' },
    { color: '#DBEAFE', name: '青（教育）' },
    { color: '#D1FAE5', name: '緑（フォロー）' },
    { color: '#F3E8FF', name: '紫' },
    { color: '#E5E7EB', name: 'グレー' },
  ];

  // 日付配列を生成
  const dates = useMemo(() => {
    const result: string[] = [];
    const start = new Date(funnel.startDate);
    const end = new Date(funnel.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      result.push(d.toISOString().split('T')[0]);
    }
    return result;
  }, [funnel.startDate, funnel.endDate]);

  // セグメント更新
  const handleUpdateSegments = (segments: Segment[]) => {
    onUpdate({ ...funnel, segments, updatedAt: new Date().toISOString() });
  };

  const handleUpdateSegmentName = (segmentId: string, name: string) => {
    handleUpdateSegments(funnel.segments.map(segment => (
      segment.id === segmentId ? { ...segment, name } : segment
    )));
  };

  // キャンバス更新
  const handleCanvasSave = (nodes: Node[], edges: Edge[], phaseNames?: string[], kpis?: KPI[]) => {
    onUpdate({
      ...funnel,
      canvasNodes: nodes,
      canvasEdges: edges,
      phaseNames: phaseNames || funnel.phaseNames,
      kpis: kpis || funnel.kpis,
      updatedAt: new Date().toISOString()
    });
  };

  // 特定のセル（日付×セグメント）の配信を取得
  const getDeliveryRange = (delivery: DeliveryItem) => {
    const startDate = delivery.startDate || delivery.date;
    const endDate = delivery.endDate || delivery.date || startDate;
    return { startDate, endDate };
  };

  const getDeliveries = (date: string, segmentId: string): DeliveryItem[] => {
    return funnel.deliveries.filter(d => {
      const { startDate, endDate } = getDeliveryRange(d);
      if (!startDate || !endDate) return false;
      if (date < startDate || date > endDate) return false;
      const segmentIds = d.segmentIds || [d.segmentId];
      return segmentIds.includes(segmentId);
    });
  };

  // セルクリック
  const handleCellClick = (date: string, segmentId: string) => {
    if (connectingFrom) {
      setConnectingFrom(null);
      return;
    }
    setSelectedCell({ date, segmentId });
    setEditingDelivery(null);
    setIsDeliveryModalOpen(true);
  };

  // 配信クリック
  const handleDeliveryClick = (e: React.MouseEvent, delivery: DeliveryItem) => {
    e.stopPropagation();
    setEditingDelivery(delivery);
    setSelectedCell(null);
    setIsDeliveryModalOpen(true);
  };

  // 配信を保存
  const handleSaveDelivery = (delivery: DeliveryItem) => {
    let newDeliveries: DeliveryItem[];
    if (editingDelivery) {
      newDeliveries = funnel.deliveries.map(d => d.id === editingDelivery.id ? delivery : d);
    } else {
      newDeliveries = [...funnel.deliveries, delivery];
    }
    onUpdate({ ...funnel, deliveries: newDeliveries, updatedAt: new Date().toISOString() });
    setIsDeliveryModalOpen(false);
    setSelectedCell(null);
    setEditingDelivery(null);
  };

  // 配信を削除
  const handleDeleteDelivery = (deliveryId: string) => {
    const newDeliveries = funnel.deliveries.filter(d => d.id !== deliveryId);
    onUpdate({ ...funnel, deliveries: newDeliveries, updatedAt: new Date().toISOString() });
    setIsDeliveryModalOpen(false);
    setEditingDelivery(null);
  };

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 曜日取得
  const getDayOfWeek = (dateStr: string) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[new Date(dateStr).getDay()];
  };

  // 販売期間内か
  const isInBaseDatePeriod = (dateStr: string) => {
    if (!funnel.baseDate) return false;
    const checkDate = new Date(dateStr);
    const startDate = new Date(funnel.baseDate);
    const endDate = new Date(funnel.baseDate);
    endDate.setDate(endDate.getDate() + (funnel.baseDateDays || 1) - 1);
    return checkDate >= startDate && checkDate <= endDate;
  };

  const getBaseDateDayNumber = (dateStr: string) => {
    if (!funnel.baseDate || !isInBaseDatePeriod(dateStr)) return 0;
    const checkDate = new Date(dateStr);
    const startDate = new Date(funnel.baseDate);
    const diffTime = checkDate.getTime() - startDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // セクションをレンダリング
  const renderSection = (sectionId: 'funnel' | 'schedule' | 'tasks', index: number) => {
    const isLastVisible = index === visibleSectionOrder.length - 1;

    switch (sectionId) {
      case 'funnel':
        const isFunnelFill = isLastVisible && !isCanvasCollapsed;
        return (
          <div
            key="funnel"
            className={`${isFunnelFill ? 'flex-1 min-h-0' : 'flex-shrink-0'} flex flex-col ${draggingSection === 'funnel' ? 'opacity-50' : ''}`}
            style={{ height: isCanvasCollapsed ? 'auto' : `${canvasHeight}%` }}
            onDragOver={(e) => handleSectionDragOver(e, 'funnel')}
          >
            <FreeCanvas
              initialNodes={funnel.canvasNodes || []}
              initialEdges={funnel.canvasEdges || []}
              initialPhaseNames={funnel.phaseNames}
              initialKPIs={funnel.kpis}
              onSave={handleCanvasSave}
              onCollapseChange={setIsCanvasCollapsed}
              onSectionDragStart={() => handleSectionDragStart('funnel')}
              onSectionDragEnd={handleSectionDragEnd}
            />
          </div>
        );

      case 'schedule':
        const isScheduleFill = isLastVisible && !isScheduleCollapsed;
        return (
          <div
            key="schedule"
            className={`${isScheduleFill ? 'flex-1 min-h-0' : 'flex-shrink-0'} flex flex-col ${draggingSection === 'schedule' ? 'opacity-50' : ''}`}
            style={{ height: isScheduleCollapsed ? 'auto' : `${scheduleHeight}%` }}
            onDragOver={(e) => handleSectionDragOver(e, 'schedule')}
          >
            {/* スケジュールヘッダー */}
            <div className="panel-header flex items-center justify-between px-3 py-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-gray-300 cursor-grab"
                  draggable
                  onDragStart={() => handleSectionDragStart('schedule')}
                  onDragEnd={handleSectionDragEnd}
                >⋮⋮</span>
                <span className="text-sm font-medium text-gray-700">スケジュール</span>
              </div>
              <button
                onClick={() => setIsScheduleCollapsed(!isScheduleCollapsed)}
                className="px-2 py-1 text-gray-400 hover:text-gray-600"
              >
                {isScheduleCollapsed ? '▼' : '▲'}
              </button>
            </div>

            {/* スケジュールコンテンツ */}
            {!isScheduleCollapsed && (
              <div className="flex-1 flex overflow-hidden">
                {/* 左パネル: タブ切り替え（ファネル設計と同じ形式） */}
                <div className={`${LEFT_PANEL_WIDTH} flex-shrink-0 panel-side flex flex-col`}>
                  {/* タブ */}
                  <div className="flex border-b border-gray-200">
                    <button
                      onClick={() => setScheduleTab('segment')}
                      className={`flex-1 py-2 text-xs ${scheduleTab === 'segment' ? 'panel-tab-active bg-white/60' : 'panel-tab hover:bg-white/60'}`}
                    >
                      セグメント
                    </button>
                    <button
                      onClick={() => setScheduleTab('settings')}
                      className={`flex-1 py-2 text-xs ${scheduleTab === 'settings' ? 'panel-tab-active bg-white/60' : 'panel-tab hover:bg-white/60'}`}
                    >
                      設定
                    </button>
                  </div>

                  {scheduleTab === 'segment' ? (
                    /* セグメントタブ */
                    <div className="p-3 flex-1 overflow-y-auto">
                      <div className="text-xs text-gray-500 mb-2">セグメント</div>
                      <div className="space-y-1">
                        {funnel.segments.map((segment) => (
                          <div key={segment.id} className="flex items-center gap-2 group">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />
                            <input
                              type="text"
                              value={segmentNameDrafts[segment.id] ?? segment.name}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setSegmentNameDrafts((prev) => ({ ...prev, [segment.id]: nextValue }));
                              }}
                              onBlur={(e) => handleUpdateSegmentName(segment.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setSegmentNameDrafts((prev) => ({ ...prev, [segment.id]: segment.name }));
                                  e.currentTarget.blur();
                                }
                              }}
                              className="flex-1 text-xs border border-transparent hover:border-gray-300 focus:border-gray-400 rounded px-1 py-0.5 focus:outline-none text-gray-700 bg-transparent"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          const newSegment = {
                            id: `seg-${Date.now()}`,
                            name: `セグメント${funnel.segments.length + 1}`,
                            color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][funnel.segments.length % 5],
                          };
                          handleUpdateSegments([...funnel.segments, newSegment]);
                        }}
                        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded py-1"
                      >
                        + セグメント追加
                      </button>
                    </div>
                  ) : (
                    /* 設定タブ */
                    <div className="p-3 flex-1 overflow-y-auto">
                      {/* 期間設定 */}
                      <div className="mb-4">
                      <div className="text-xs text-gray-500 mb-2">期間</div>
                      <div className="space-y-3">
                          <div className="rounded border border-red-200 bg-red-50/40 p-2">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }} />
                              <span className="text-[10px] text-gray-500">販売期間（基準）</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  aria-label="開始日"
                                  value={funnel.baseDate || ''}
                                  onChange={(e) => onUpdate({ ...funnel, baseDate: e.target.value, updatedAt: new Date().toISOString() })}
                                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  max="120"
                                  aria-label="日数"
                                  value={funnel.baseDateDays || 1}
                                  onChange={(e) => onUpdate({ ...funnel, baseDateDays: parseInt(e.target.value) || 1, updatedAt: new Date().toISOString() })}
                                  className="w-16 text-xs border border-gray-200 rounded px-2 py-1"
                                />
                                <span className="text-xs text-gray-400">日間</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  defaultValue={funnel.baseDateLabel || ''}
                                  onBlur={(e) => onUpdate({ ...funnel, baseDateLabel: e.target.value, updatedAt: new Date().toISOString() })}
                                  placeholder="ラベル"
                                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                                />
                              </div>
                            </div>
                          </div>
                          {periods.map((period) => (
                            <div key={period.id} className="rounded border border-gray-200 p-2">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="w-3 h-3 rounded flex-shrink-0"
                                    style={{ backgroundColor: period.color }}
                                    onClick={() => {
                                      const idx = PERIOD_COLORS.findIndex(c => c.color === period.color);
                                      const next = PERIOD_COLORS[(idx + 1) % PERIOD_COLORS.length];
                                      handleUpdatePeriod(period.id, { color: next.color });
                                    }}
                                  />
                                  <span className="panel-label text-[10px] text-gray-400">期間</span>
                                </div>
                                <button
                                  onClick={() => handleDeletePeriod(period.id)}
                                  className="text-[10px] text-gray-400 hover:text-red-500"
                                >
                                  削除
                                </button>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    aria-label="開始日"
                                    value={period.startDate}
                                    onChange={(e) => handleUpdatePeriodStartDate(period.id, e.target.value)}
                                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="1"
                                    max="120"
                                    aria-label="日数"
                                    value={getPeriodDays(period)}
                                    onChange={(e) => handleUpdatePeriodDays(period.id, parseInt(e.target.value) || 1)}
                                    className="w-16 text-xs border border-gray-200 rounded px-2 py-1"
                                  />
                                  <span className="text-xs text-gray-400">日間</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    defaultValue={period.name}
                                    onBlur={(e) => handleUpdatePeriod(period.id, { name: e.target.value })}
                                    placeholder="ラベル"
                                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={handleAddPeriod}
                          className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded py-1"
                        >
                          + 期間追加
                        </button>
                      </div>

                      {/* タイムライン表示範囲 */}
                      <div>
                        <div className="text-xs text-gray-500 mb-2">表示範囲</div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              aria-label="開始"
                              value={funnel.startDate || ''}
                              onChange={(e) => onUpdate({ ...funnel, startDate: e.target.value, updatedAt: new Date().toISOString() })}
                              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              aria-label="終了"
                              value={funnel.endDate || ''}
                              onChange={(e) => onUpdate({ ...funnel, endDate: e.target.value, updatedAt: new Date().toISOString() })}
                              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 右: タイムライン */}
                <div className="flex-1 overflow-auto p-2 panel-white" ref={gridRef}>
                  <div className="inline-block min-w-full">
                    {/* 期間帯（上部） */}
                    {displayPeriods.length > 0 && (
                      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-30">
                        <div className="w-24 flex-shrink-0 p-1 border-r border-gray-200 text-[10px] text-gray-400">
                          期間
                        </div>
                        {dates.map(date => {
                          // この日付が含まれる期間を探す
                          const matchingPeriod = displayPeriods.find(p => {
                            const checkDate = new Date(date);
                            const start = new Date(p.startDate);
                            const end = new Date(p.endDate);
                            return checkDate >= start && checkDate <= end;
                          });
                          return (
                            <div
                              key={`period-${date}`}
                              className="w-24 flex-shrink-0 border-r border-gray-200 h-6"
                              style={{ backgroundColor: matchingPeriod?.color || 'transparent' }}
                            >
                              {matchingPeriod && date === matchingPeriod.startDate && (
                                <span className="text-[9px] text-gray-600 px-1 truncate block">
                                  {matchingPeriod.name}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ヘッダー（日付） */}
                    <div className={`flex border-b-2 border-gray-300 sticky bg-white z-20 ${displayPeriods.length > 0 ? 'top-6' : 'top-0'}`}>
                      <div className="w-24 flex-shrink-0 p-2 font-medium text-gray-600 border-r border-gray-200 text-xs">
                        セグメント
                      </div>
                      {dates.map(date => {
                        const dayNum = getBaseDateDayNumber(date);
                        const isInPeriod = dayNum > 0;
                        return (
                          <div
                            key={date}
                            className={`w-24 flex-shrink-0 p-1 text-center border-r border-gray-200 ${isInPeriod ? 'bg-red-50' : ''}`}
                          >
                            <div className={`text-xs font-bold ${isInPeriod ? 'text-red-600' : 'text-gray-800'}`}>
                              {formatDate(date)}
                            </div>
                            <div className={`text-[10px] ${isInPeriod ? 'text-red-500' : 'text-gray-500'}`}>
                              ({getDayOfWeek(date)})
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 行（セグメントごと） */}
                    {funnel.segments.map((segment) => (
                      <div key={segment.id} className="flex border-b border-gray-200">
                        <div
                          className="w-24 flex-shrink-0 p-1 border-r border-gray-200 flex items-center gap-1"
                          style={{ backgroundColor: segment.color + '20' }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.color }} />
                          <span className="text-xs font-medium truncate">{segment.name}</span>
                        </div>
                        {dates.map(date => {
                          const deliveries = getDeliveries(date, segment.id);
                          const isInBasePeriod = isInBaseDatePeriod(date);
                          // 期間の色も適用
                          const matchingPeriod = displayPeriods.find(p => {
                            const checkDate = new Date(date);
                            const start = new Date(p.startDate);
                            const end = new Date(p.endDate);
                            return checkDate >= start && checkDate <= end;
                          });
                          return (
                            <div
                              key={`${segment.id}-${date}`}
                              className={`w-24 flex-shrink-0 p-1 border-r border-gray-200 min-h-[150px] cursor-pointer hover:bg-gray-50 ${
                                isInBasePeriod ? 'bg-red-50/50' : ''
                              }`}
                              style={{ backgroundColor: matchingPeriod && !isInBasePeriod ? matchingPeriod.color + '30' : undefined }}
                              onClick={() => handleCellClick(date, segment.id)}
                            >
                              {deliveries.map(delivery => (
                                <div
                                  key={delivery.id}
                                  onClick={(e) => handleDeliveryClick(e, delivery)}
                                  className="rounded px-1 py-0.5 text-[10px] mb-1 cursor-pointer hover:opacity-80"
                                  style={{ backgroundColor: DELIVERY_TYPES[delivery.type].color + '30' }}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: DELIVERY_TYPES[delivery.type].color }}
                                    />
                                    <span className="text-[9px] text-gray-600">{DELIVERY_TYPES[delivery.type].label}</span>
                                  </span>
                                  <span className="ml-1 truncate">{delivery.title}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'tasks':
        const isTasksFill = isLastVisible && !isTaskListCollapsed;
        return (
          <div
            key="tasks"
            className={`${isTasksFill ? 'flex-1 min-h-0' : 'flex-shrink-0'} bg-white border-t border-gray-200 flex flex-col ${draggingSection === 'tasks' ? 'opacity-50' : ''}`}
            style={{ minHeight: isTaskListCollapsed ? 'auto' : taskListHeight }}
            onDragOver={(e) => handleSectionDragOver(e, 'tasks')}
          >
            {/* タスクリストヘッダー */}
            <div className="panel-header flex items-center justify-between px-3 py-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-gray-300 cursor-grab"
                  draggable
                  onDragStart={() => handleSectionDragStart('tasks')}
                  onDragEnd={handleSectionDragEnd}
                >⋮⋮</span>
                <span className="text-sm font-medium text-gray-700">タスクリスト</span>
              </div>
              <button
                onClick={() => setIsTaskListCollapsed(!isTaskListCollapsed)}
                className="px-2 py-1 text-gray-400 hover:text-gray-600"
              >
                {isTaskListCollapsed ? '▼' : '▲'}
              </button>
            </div>

            {/* タスクリストコンテンツ */}
            {!isTaskListCollapsed && (
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* 左: カテゴリ管理 */}
                <div className={`${LEFT_PANEL_WIDTH} flex-shrink-0 panel-side p-3 overflow-y-auto`}>
                  <div className="text-xs text-gray-500 mb-2">カテゴリ</div>
                  <div className="space-y-1">
                    {taskCategories.map((category, i) => (
                      <div key={i} className="flex items-center gap-1 group">
                        <input
                          type="text"
                          value={taskCategoryDrafts[i] ?? category}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setTaskCategoryDrafts((prev) => {
                              const next = [...prev];
                              next[i] = nextValue;
                              return next;
                            });
                          }}
                          onBlur={(e) => handleTaskCategoryNameChange(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleTaskCategoryNameChange(i, e.currentTarget.value);
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              setTaskCategoryDrafts((prev) => {
                                const next = [...prev];
                                next[i] = category;
                                return next;
                              });
                              e.currentTarget.blur();
                            }
                          }}
                          className="flex-1 text-xs border border-transparent hover:border-gray-300 focus:border-gray-400 rounded px-1 py-0.5 focus:outline-none"
                        />
                        <button
                          onClick={() => handleDeleteTaskCategory(i)}
                          className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleAddTaskCategory}
                    className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded py-1"
                  >
                    + カテゴリ追加
                  </button>
                </div>

                {/* 右: カンバン */}
                <div className="flex-1 overflow-auto bg-white h-full">
                  <div className="flex min-h-full min-w-max bg-white">
                    {taskCategories.map((categoryName, phaseIndex) => {
                      const phaseTasks = tasks
                        .filter(t => t.phaseIndex === phaseIndex)
                        .sort((a, b) => a.order - b.order);

                      return (
                        <div
                          key={phaseIndex}
                          className={`w-56 flex-shrink-0 border-r border-gray-200 flex flex-col min-h-full ${
                            draggingTask && draggingTask.phaseIndex !== phaseIndex ? 'bg-blue-50/50' : 'bg-white'
                          }`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleTaskDrop(phaseIndex)}
                        >
                          <div className="px-2 py-1 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600">{categoryName}</span>
                            <span className="text-xs text-gray-400">{phaseTasks.length}</span>
                          </div>
                          <div className="flex-1 p-2 space-y-2 overflow-auto">
                            {phaseTasks.map((task) => (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={() => handleTaskDragStart(task)}
                                onDragEnd={() => setDraggingTask(null)}
                                className={`p-2 bg-white rounded border shadow-sm cursor-grab active:cursor-grabbing ${
                                  task.completed ? 'opacity-50' : ''
                                } ${draggingTask?.id === task.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
                              >
                                <div className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={task.completed}
                                    onChange={(e) => handleUpdateTask(task.id, { completed: e.target.checked })}
                                    className="mt-0.5 rounded"
                                  />
                                  {editingTaskId === task.id ? (
                                    <input
                                      type="text"
                                      value={taskTitleDrafts[task.id] ?? task.title}
                                      onChange={(e) =>
                                        setTaskTitleDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
                                      }
                                      onBlur={() => commitTaskTitle(task.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          commitTaskTitle(task.id);
                                        } else if (e.key === 'Escape') {
                                          setTaskTitleDrafts((prev) => ({ ...prev, [task.id]: task.title }));
                                          setEditingTaskId(null);
                                        }
                                      }}
                                      className="flex-1 text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none"
                                      autoFocus
                                      placeholder="タスク名を入力"
                                    />
                                  ) : (
                                    <span
                                      className={`flex-1 text-xs ${task.completed ? 'line-through text-gray-400' : 'text-gray-700'} cursor-pointer`}
                                      onClick={() => {
                                        setTaskTitleDrafts((prev) => ({ ...prev, [task.id]: task.title }));
                                        setEditingTaskId(task.id);
                                      }}
                                    >
                                      {task.title || 'タスク名を入力'}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="text-gray-300 hover:text-red-500 text-xs"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button
                              onClick={() => handleAddTask(phaseIndex)}
                              className="w-full p-1.5 border border-dashed border-gray-300 rounded text-gray-400 text-xs hover:bg-gray-50 hover:text-gray-600"
                            >
                              + 追加
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-shell flex flex-col h-full overflow-y-auto relative" ref={containerRef}>
      {visibleSectionOrder.map((sectionId, index) => (
        <React.Fragment key={sectionId}>
          {renderSection(sectionId, index)}
          {/* リサイズハンドル（最後以外） */}
          {index < visibleSectionOrder.length - 1 && (
            <div
              className="h-1 cursor-row-resize flex items-center justify-center hover:bg-blue-100 bg-gray-200 flex-shrink-0"
              onMouseDown={() => {
                if (sectionId === 'funnel') setIsResizing(true);
                else if (sectionId === 'schedule') setIsResizingSchedule(true);
                else if (sectionId === 'tasks') setIsResizingTaskList(true);
              }}
            >
              <div className="w-10 h-1 rounded bg-gray-400" />
            </div>
          )}
        </React.Fragment>
      ))}
      {isTaskListCollapsed && (
        <button
          onClick={() => setIsTaskListCollapsed(false)}
          className="absolute bottom-3 right-3 text-xs bg-white border border-gray-300 rounded px-2 py-1 shadow-sm hover:bg-gray-50"
        >
          タスクリストを表示
        </button>
      )}

      {/* 配信編集モーダル */}
      {isDeliveryModalOpen && (
        <DeliveryModal
          date={selectedCell?.date || editingDelivery?.date || ''}
          segments={funnel.segments}
          initialSegmentIds={selectedCell ? [selectedCell.segmentId] : (editingDelivery?.segmentIds || [editingDelivery?.segmentId || ''])}
          delivery={editingDelivery}
          onSave={handleSaveDelivery}
          onDelete={editingDelivery ? () => handleDeleteDelivery(editingDelivery.id) : undefined}
          onClose={() => {
            setIsDeliveryModalOpen(false);
            setSelectedCell(null);
            setEditingDelivery(null);
          }}
        />
      )}
    </div>
  );
}
