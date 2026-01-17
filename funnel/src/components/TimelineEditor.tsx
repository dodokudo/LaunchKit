'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Funnel, Segment, DeliveryItem, Connection, KPI, Task, Period } from '@/types/funnel';
import { FreeCanvas } from './FreeCanvas';
import { Node, Edge } from 'reactflow';

interface TimelineEditorProps {
  funnel: Funnel;
  onUpdate: (funnel: Funnel) => void;
}

export function TimelineEditor({ funnel, onUpdate }: TimelineEditorProps) {
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
  const gridContentRef = useRef<HTMLDivElement>(null);
  const deliveryCardRefs = useRef(new Map<string, HTMLDivElement>());
  const scheduleRafRef = useRef<number | null>(null);
  const [scheduleLayoutTick, setScheduleLayoutTick] = useState(0);
  const [dayWidth, setDayWidth] = useState(120);
  const rowHeight = 200;
  const segmentLabelWidth = 120;
  const [isResizingDayWidth, setIsResizingDayWidth] = useState(false);
  const dayWidthDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ id: string; side: 'top' | 'right' | 'bottom' | 'left' } | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalDeliveryId, setScheduleModalDeliveryId] = useState<string | null>(null);
  const [scheduleModalTitle, setScheduleModalTitle] = useState('');
  const [scheduleModalDescription, setScheduleModalDescription] = useState('');
  const [scheduleModalStartIndex, setScheduleModalStartIndex] = useState(0);
  const [scheduleModalEndIndex, setScheduleModalEndIndex] = useState(0);
  const [scheduleModalSegmentStart, setScheduleModalSegmentStart] = useState(0);
  const [scheduleModalSegmentEnd, setScheduleModalSegmentEnd] = useState(0);
  const [scheduleContextMenu, setScheduleContextMenu] = useState<{
    x: number;
    y: number;
    deliveryId: string;
  } | null>(null);
  const scheduleHistoryRef = useRef<
    { deliveries: DeliveryItem[]; connections: Connection[]; key: string }[]
  >([]);
  const scheduleHistoryIndexRef = useRef(-1);
  const isScheduleUndoingRef = useRef(false);
  const [dragState, setDragState] = useState<{
    id: string;
    mode: 'move' | 'resize-x' | 'resize-y';
    startIndex: number;
    endIndex: number;
    segmentStart: number;
    segmentEnd: number;
    startX: number;
    startY: number;
  } | null>(null);
  const dragPreviewRef = useRef<{
    startIndex: number;
    endIndex: number;
    segmentStart: number;
    segmentEnd: number;
  } | null>(null);
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

  const bumpScheduleLayout = useCallback(() => {
    if (scheduleRafRef.current !== null) return;
    scheduleRafRef.current = window.requestAnimationFrame(() => {
      scheduleRafRef.current = null;
      setScheduleLayoutTick((prev) => prev + 1);
    });
  }, []);

  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const handle = () => bumpScheduleLayout();
    gridEl.addEventListener('scroll', handle, { passive: true });
    window.addEventListener('resize', handle);
    return () => {
      gridEl.removeEventListener('scroll', handle);
      window.removeEventListener('resize', handle);
    };
  }, [bumpScheduleLayout]);

  const handleCardMouseDown = (e: React.MouseEvent, delivery: DeliveryItem) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { start, end } = getDeliveryDateRange(delivery);
    const startIndex = Math.max(0, dates.indexOf(start));
    const endIndex = Math.max(startIndex, dates.indexOf(end));
    const segmentsRange = getDeliverySegmentRange(delivery);
    setDragState({
      id: delivery.id,
      mode: 'move',
      startIndex,
      endIndex,
      segmentStart: segmentsRange.start,
      segmentEnd: segmentsRange.end,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  const handleResizeXMouseDown = (e: React.MouseEvent, delivery: DeliveryItem) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { start, end } = getDeliveryDateRange(delivery);
    const startIndex = Math.max(0, dates.indexOf(start));
    const endIndex = Math.max(startIndex, dates.indexOf(end));
    const segmentsRange = getDeliverySegmentRange(delivery);
    setDragState({
      id: delivery.id,
      mode: 'resize-x',
      startIndex,
      endIndex,
      segmentStart: segmentsRange.start,
      segmentEnd: segmentsRange.end,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  const handleResizeYMouseDown = (e: React.MouseEvent, delivery: DeliveryItem) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { start, end } = getDeliveryDateRange(delivery);
    const startIndex = Math.max(0, dates.indexOf(start));
    const endIndex = Math.max(startIndex, dates.indexOf(end));
    const segmentsRange = getDeliverySegmentRange(delivery);
    setDragState({
      id: delivery.id,
      mode: 'resize-y',
      startIndex,
      endIndex,
      segmentStart: segmentsRange.start,
      segmentEnd: segmentsRange.end,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  const addDeliveryAt = (dateIndex: number, segmentIndex: number) => {
    if (dates.length === 0 || funnel.segments.length === 0) return;
    const safeDateIndex = clamp(dateIndex, 0, dates.length - 1);
    const safeSegmentIndex = clamp(segmentIndex, 0, funnel.segments.length - 1);
    const date = dates[safeDateIndex];
    const segment = funnel.segments[safeSegmentIndex];
    const newDelivery: DeliveryItem = {
      id: `delivery-${Date.now()}`,
      date,
      startDate: date,
      endDate: date,
      segmentId: segment.id,
      segmentIds: [segment.id],
      title: 'タイトル',
      description: '',
      type: 'message',
    };
    commitScheduleUpdate([...funnel.deliveries, newDelivery], connections);
    setActiveCardId(newDelivery.id);
    openScheduleModal(newDelivery);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (!gridContentRef.current) return;
    if (dates.length === 0 || funnel.segments.length === 0) return;
    const rect = gridContentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dateIndex = Math.floor(x / dayWidth);
    const segmentIndex = Math.floor(y / rowHeight);
    addDeliveryAt(dateIndex, segmentIndex);
  };

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

  useEffect(() => {
    if (!isScheduleModalOpen || !scheduleModalDeliveryId) return;
    const delivery = funnel.deliveries.find((item) => item.id === scheduleModalDeliveryId);
    if (!delivery) return;
    const { start, end } = getDeliveryDateRange(delivery);
    const startIndex = Math.max(0, dates.indexOf(start));
    const endIndex = Math.max(startIndex, dates.indexOf(end));
    const segmentRange = getDeliverySegmentRange(delivery);
    setScheduleModalTitle(delivery.title || '');
    setScheduleModalDescription(delivery.description || '');
    setScheduleModalStartIndex(startIndex);
    setScheduleModalEndIndex(endIndex);
    setScheduleModalSegmentStart(segmentRange.start);
    setScheduleModalSegmentEnd(segmentRange.end);
  }, [funnel.deliveries, isScheduleModalOpen, scheduleModalDeliveryId, dates]);

  const connections = useMemo(() => funnel.connections ?? [], [funnel.connections]);

  useEffect(() => {
    bumpScheduleLayout();
  }, [bumpScheduleLayout, funnel.deliveries, connections, dates, funnel.segments]);

  const scheduleSize = useMemo(() => {
    return {
      width: dates.length * dayWidth,
      height: funnel.segments.length * rowHeight,
    };
  }, [dates.length, dayWidth, funnel.segments.length, rowHeight, scheduleLayoutTick]);

  const setDeliveryCardRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) {
        deliveryCardRefs.current.set(id, el);
      } else {
        deliveryCardRefs.current.delete(id);
      }
    },
    []
  );

  const handleStartConnection = (deliveryId: string, side: 'top' | 'right' | 'bottom' | 'left') => {
    setConnectingFrom({ id: deliveryId, side });
  };

  const recordScheduleHistory = useCallback(() => {
    if (isScheduleUndoingRef.current) return;
    const snapshot = {
      deliveries: funnel.deliveries,
      connections: funnel.connections ?? [],
    };
    const key = JSON.stringify(snapshot);
    const history = scheduleHistoryRef.current;
    const last = history[scheduleHistoryIndexRef.current];
    if (last && last.key === key) return;
    history.splice(scheduleHistoryIndexRef.current + 1);
    history.push({ ...snapshot, key });
    scheduleHistoryIndexRef.current = history.length - 1;
  }, [funnel.deliveries, funnel.connections]);

  const commitScheduleUpdate = useCallback(
    (nextDeliveries: DeliveryItem[], nextConnections: Connection[]) => {
      recordScheduleHistory();
      onUpdate({
        ...funnel,
        deliveries: nextDeliveries,
        connections: nextConnections,
        updatedAt: new Date().toISOString(),
      });
    },
    [funnel, onUpdate, recordScheduleHistory]
  );

  const handleAddConnection = (
    fromId: string,
    fromSide: 'top' | 'right' | 'bottom' | 'left',
    toId: string,
    toSide: 'top' | 'right' | 'bottom' | 'left'
  ) => {
    if (fromId === toId) {
      setConnectingFrom(null);
      return;
    }
    const exists = connections.some(
      (connection) =>
        connection.fromDeliveryId === fromId &&
        connection.toDeliveryId === toId &&
        (connection.fromHandle || 'right') === fromSide &&
        (connection.toHandle || 'left') === toSide
    );
    if (exists) {
      setConnectingFrom(null);
      return;
    }
    const next: Connection = {
      id: `conn-${Date.now()}`,
      fromDeliveryId: fromId,
      toDeliveryId: toId,
      fromHandle: fromSide,
      toHandle: toSide,
    };
    commitScheduleUpdate(funnel.deliveries, [...connections, next]);
    setConnectingFrom(null);
  };

  const handleScheduleUndo = useCallback(() => {
    const history = scheduleHistoryRef.current;
    const idx = scheduleHistoryIndexRef.current;
    if (idx <= 0) return;
    isScheduleUndoingRef.current = true;
    const prev = history[idx - 1];
    scheduleHistoryIndexRef.current = idx - 1;
    onUpdate({
      ...funnel,
      deliveries: prev.deliveries,
      connections: prev.connections,
      updatedAt: new Date().toISOString(),
    });
    setTimeout(() => {
      isScheduleUndoingRef.current = false;
    }, 0);
  }, [funnel, onUpdate]);

  useEffect(() => {
    scheduleHistoryRef.current = [];
    scheduleHistoryIndexRef.current = -1;
    recordScheduleHistory();
  }, [funnel.id, recordScheduleHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleScheduleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleScheduleUndo]);

  const clamp = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
  };

  const getDeliveryDateRange = (delivery: DeliveryItem) => {
    const start = delivery.startDate || delivery.date;
    const end = delivery.endDate || start;
    return { start, end };
  };

  const getDeliverySegmentRange = (delivery: DeliveryItem) => {
    const ids = delivery.segmentIds?.length ? delivery.segmentIds : [delivery.segmentId];
    const indices = ids
      .map((id) => funnel.segments.findIndex((segment) => segment.id === id))
      .filter((index) => index >= 0);
    if (indices.length === 0) return { start: 0, end: 0 };
    return { start: Math.min(...indices), end: Math.max(...indices) };
  };

  useEffect(() => {
    if (!isResizingDayWidth) return;
    const start = dayWidthDragRef.current;
    if (!start) return;
    const handleMouseMove = (e: MouseEvent) => {
      const next = clamp(start.startWidth + (e.clientX - start.startX), 80, 220);
      setDayWidth(next);
    };
    const handleMouseUp = () => {
      setIsResizingDayWidth(false);
      dayWidthDragRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingDayWidth]);

  const applyDeliveryLayout = (
    deliveryId: string,
    startIndex: number,
    endIndex: number,
    segmentStart: number,
    segmentEnd: number
  ) => {
    const startDate = dates[startIndex];
    const endDate = dates[endIndex];
    const segmentIds = funnel.segments.slice(segmentStart, segmentEnd + 1).map((segment) => segment.id);
    const nextDeliveries = funnel.deliveries.map((delivery) =>
      delivery.id === deliveryId
        ? {
            ...delivery,
            date: startDate,
            startDate,
            endDate,
            segmentId: segmentIds[0],
            segmentIds,
          }
        : delivery
    );
    commitScheduleUpdate(nextDeliveries, connections);
  };

  const updateDelivery = useCallback(
    (deliveryId: string, updates: Partial<DeliveryItem>) => {
      const nextDeliveries = funnel.deliveries.map((delivery) =>
        delivery.id === deliveryId ? { ...delivery, ...updates } : delivery
      );
      commitScheduleUpdate(nextDeliveries, connections);
    },
    [funnel, connections, commitScheduleUpdate]
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const spanDays = dragState.endIndex - dragState.startIndex;
      const spanSegments = dragState.segmentEnd - dragState.segmentStart;
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      const shiftDays = Math.round(deltaX / dayWidth);
      const shiftSegments = Math.round(deltaY / rowHeight);

      let nextStart = dragState.startIndex;
      let nextEnd = dragState.endIndex;
      let nextSegmentStart = dragState.segmentStart;
      let nextSegmentEnd = dragState.segmentEnd;

      if (dragState.mode === 'move') {
        nextStart = clamp(dragState.startIndex + shiftDays, 0, dates.length - 1);
        nextEnd = clamp(nextStart + spanDays, nextStart, dates.length - 1);
        nextSegmentStart = clamp(dragState.segmentStart + shiftSegments, 0, funnel.segments.length - 1);
        nextSegmentEnd = clamp(nextSegmentStart + spanSegments, nextSegmentStart, funnel.segments.length - 1);
      } else if (dragState.mode === 'resize-x') {
        nextEnd = clamp(dragState.endIndex + shiftDays, dragState.startIndex, dates.length - 1);
      } else if (dragState.mode === 'resize-y') {
        nextSegmentEnd = clamp(dragState.segmentEnd + shiftSegments, dragState.segmentStart, funnel.segments.length - 1);
      }

      dragPreviewRef.current = {
        startIndex: nextStart,
        endIndex: nextEnd,
        segmentStart: nextSegmentStart,
        segmentEnd: nextSegmentEnd,
      };
      setScheduleLayoutTick((prev) => prev + 1);
    };

    const handleMouseUp = () => {
      const preview = dragPreviewRef.current;
      if (preview) {
        applyDeliveryLayout(dragState.id, preview.startIndex, preview.endIndex, preview.segmentStart, preview.segmentEnd);
      }
      dragPreviewRef.current = null;
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dayWidth, rowHeight, dates.length, funnel.segments.length]);

  // セグメント更新
  const handleUpdateSegments = (segments: Segment[]) => {
    onUpdate({ ...funnel, segments, updatedAt: new Date().toISOString() });
  };

  const handleDeleteSegment = (segmentId: string) => {
    const nextSegments = funnel.segments.filter((segment) => segment.id !== segmentId);
    if (nextSegments.length === 0) return;
    const nextDeliveries = funnel.deliveries
      .map((delivery) => {
        const currentIds = delivery.segmentIds?.length ? delivery.segmentIds : [delivery.segmentId];
        const filteredIds = currentIds.filter((id) => id !== segmentId);
        if (filteredIds.length === 0) return null;
        return {
          ...delivery,
          segmentIds: filteredIds,
          segmentId: filteredIds[0],
        };
      })
      .filter((delivery): delivery is DeliveryItem => delivery !== null);
    onUpdate({
      ...funnel,
      segments: nextSegments,
      deliveries: nextDeliveries,
      updatedAt: new Date().toISOString(),
    });
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

  // 配信クリック
  const handleDeliveryClick = (e: React.MouseEvent, delivery: DeliveryItem) => {
    e.stopPropagation();
    setActiveCardId(delivery.id);
  };

  const handleDeliveryDelete = (deliveryId: string) => {
    const nextDeliveries = funnel.deliveries.filter((delivery) => delivery.id !== deliveryId);
    const nextConnections = connections.filter(
      (connection) =>
        connection.fromDeliveryId !== deliveryId && connection.toDeliveryId !== deliveryId
    );
    commitScheduleUpdate(nextDeliveries, nextConnections);
    if (scheduleModalDeliveryId === deliveryId) {
      closeScheduleModal();
    }
    setActiveCardId(null);
    setConnectingFrom(null);
  };

  const getHandlePoint = (
    rect: DOMRect,
    containerRect: DOMRect,
    side: 'top' | 'right' | 'bottom' | 'left'
  ) => {
    const left = rect.left - containerRect.left;
    const top = rect.top - containerRect.top;
    const centerX = left + rect.width / 2;
    const centerY = top + rect.height / 2;
    switch (side) {
      case 'top':
        return { x: centerX, y: top };
      case 'bottom':
        return { x: centerX, y: top + rect.height };
      case 'left':
        return { x: left, y: centerY };
      case 'right':
        return { x: left + rect.width, y: centerY };
      default:
        return { x: left + rect.width, y: centerY };
    }
  };

  const resolveDeliveryLayout = (delivery: DeliveryItem) => {
    if (dragState?.id === delivery.id && dragPreviewRef.current) {
      return dragPreviewRef.current;
    }
    const { start, end } = getDeliveryDateRange(delivery);
    const startIndex = Math.max(0, dates.indexOf(start));
    const endIndex = Math.max(startIndex, dates.indexOf(end));
    const segmentRange = getDeliverySegmentRange(delivery);
    return {
      startIndex,
      endIndex,
      segmentStart: segmentRange.start,
      segmentEnd: segmentRange.end,
    };
  };

  const openScheduleModal = (delivery: DeliveryItem) => {
    const { start, end } = getDeliveryDateRange(delivery);
    const startIndex = Math.max(0, dates.indexOf(start));
    const endIndex = Math.max(startIndex, dates.indexOf(end));
    const segmentRange = getDeliverySegmentRange(delivery);
    setScheduleModalDeliveryId(delivery.id);
    setScheduleModalTitle(delivery.title || '');
    setScheduleModalDescription(delivery.description || '');
    setScheduleModalStartIndex(startIndex);
    setScheduleModalEndIndex(endIndex);
    setScheduleModalSegmentStart(segmentRange.start);
    setScheduleModalSegmentEnd(segmentRange.end);
    setIsScheduleModalOpen(true);
  };

  const closeScheduleModal = () => {
    setIsScheduleModalOpen(false);
    setScheduleModalDeliveryId(null);
  };

  const saveScheduleModal = () => {
    if (!scheduleModalDeliveryId) return;
    const nextStart = clamp(
      Math.min(scheduleModalStartIndex, scheduleModalEndIndex),
      0,
      dates.length - 1
    );
    const nextEnd = clamp(
      Math.max(scheduleModalStartIndex, scheduleModalEndIndex),
      nextStart,
      dates.length - 1
    );
    const nextSegmentStart = clamp(
      Math.min(scheduleModalSegmentStart, scheduleModalSegmentEnd),
      0,
      funnel.segments.length - 1
    );
    const nextSegmentEnd = clamp(
      Math.max(scheduleModalSegmentStart, scheduleModalSegmentEnd),
      nextSegmentStart,
      funnel.segments.length - 1
    );
    const startDate = dates[nextStart];
    const endDate = dates[nextEnd];
    const segmentIds = funnel.segments
      .slice(nextSegmentStart, nextSegmentEnd + 1)
      .map((segment) => segment.id);
    const nextDeliveries = funnel.deliveries.map((delivery) =>
      delivery.id === scheduleModalDeliveryId
        ? {
            ...delivery,
            title: scheduleModalTitle.trim() || 'タイトル',
            description: scheduleModalDescription.trim(),
            date: startDate,
            startDate,
            endDate,
            segmentId: segmentIds[0],
            segmentIds,
          }
        : delivery
    );
    commitScheduleUpdate(nextDeliveries, connections);
    closeScheduleModal();
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addDeliveryAt(0, 0)}
                    className="text-xs text-gray-500 border border-gray-300 rounded px-2 py-1 hover:bg-gray-100"
                  >
                    + カード追加
                  </button>
                  <button
                    type="button"
                    onClick={handleScheduleUndo}
                    className="text-xs text-gray-500 border border-gray-300 rounded px-2 py-1 hover:bg-gray-100"
                  >
                    戻す
                  </button>
                  <button
                    onClick={() => setIsScheduleCollapsed(!isScheduleCollapsed)}
                    className="px-2 py-1 text-gray-400 hover:text-gray-600"
                  >
                    {isScheduleCollapsed ? '▼' : '▲'}
                </button>
              </div>
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
                            <button
                              type="button"
                              onClick={() => handleDeleteSegment(segment.id)}
                              className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100"
                              title="セグメント削除"
                            >
                              ×
                            </button>
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
                  <div className="min-w-max">
                    {/* 期間帯（上部） */}
                    {displayPeriods.length > 0 && (
                      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-30">
                        <div
                          className="flex-shrink-0 p-1 border-r border-gray-200 text-[10px] text-gray-400 bg-white"
                          style={{ width: segmentLabelWidth }}
                        >
                          期間
                        </div>
                        <div className="relative" style={{ width: scheduleSize.width }}>
                          <div className="flex">
                            {dates.map((date) => {
                              const matchingPeriod = displayPeriods.find((p) => {
                                const checkDate = new Date(date);
                                const start = new Date(p.startDate);
                                const end = new Date(p.endDate);
                                return checkDate >= start && checkDate <= end;
                              });
                              return (
                                <div
                                  key={`period-${date}`}
                                  className="flex-shrink-0 border-r border-gray-200 h-6"
                                  style={{ width: dayWidth, backgroundColor: matchingPeriod?.color || 'transparent' }}
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
                        </div>
                      </div>
                    )}

                    {/* ヘッダー（日付） */}
                    <div
                      className={`flex border-b-2 border-gray-300 sticky bg-white z-20 ${
                        displayPeriods.length > 0 ? 'top-6' : 'top-0'
                      }`}
                    >
                      <div
                        className="flex-shrink-0 p-2 font-medium text-gray-600 border-r border-gray-200 text-xs bg-white"
                        style={{ width: segmentLabelWidth }}
                      >
                        セグメント
                      </div>
                      <div className="relative" style={{ width: scheduleSize.width }}>
                        <div className="flex">
                          {dates.map((date) => {
                            const dayNum = getBaseDateDayNumber(date);
                            const isInPeriod = dayNum > 0;
                            return (
                              <div
                                key={date}
                                className={`flex-shrink-0 p-1 text-center border-r border-gray-200 relative ${
                                  isInPeriod ? 'bg-red-50' : ''
                                }`}
                                style={{ width: dayWidth }}
                              >
                                <div className={`text-xs font-bold ${isInPeriod ? 'text-red-600' : 'text-gray-800'}`}>
                                  {formatDate(date)}
                                </div>
                                <div className={`text-[10px] ${isInPeriod ? 'text-red-500' : 'text-gray-500'}`}>
                                  ({getDayOfWeek(date)})
                                </div>
                                <div
                                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setIsResizingDayWidth(true);
                                    dayWidthDragRef.current = { startX: e.clientX, startWidth: dayWidth };
                                  }}
                                  title="日付幅を調整"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex">
                      <div
                        className="flex-shrink-0 border-r border-gray-200 bg-white sticky left-0 z-10"
                        style={{ width: segmentLabelWidth }}
                      >
                        {funnel.segments.map((segment) => (
                          <div
                            key={segment.id}
                            className="flex items-center gap-2 px-2 border-b border-gray-200"
                            style={{ height: rowHeight, backgroundColor: `${segment.color}14` }}
                          >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.color }} />
                            <span className="text-xs font-medium truncate">{segment.name}</span>
                          </div>
                        ))}
                      </div>

                      <div
                        ref={gridContentRef}
                        className="relative"
                        style={{ width: scheduleSize.width, height: scheduleSize.height }}
                        onDoubleClick={handleCanvasDoubleClick}
                        onClick={() => {
                          setActiveCardId(null);
                          setConnectingFrom(null);
                          setScheduleContextMenu(null);
                        }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage:
                              'linear-gradient(to right, rgba(229,231,235,0.8) 1px, transparent 1px), linear-gradient(to bottom, rgba(229,231,235,0.8) 1px, transparent 1px)',
                            backgroundSize: `${dayWidth}px ${rowHeight}px`,
                          }}
                        />

                        <svg
                          className="absolute inset-0 z-0 pointer-events-none"
                          width="100%"
                          height="100%"
                          viewBox={`0 0 ${scheduleSize.width} ${scheduleSize.height}`}
                        >
                          <defs>
                            <marker
                              id="schedule-arrow"
                              viewBox="0 0 10 10"
                              refX="10"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto-start-reverse"
                            >
                              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                            </marker>
                          </defs>
                          {connections.map((connection) => {
                            const sourceEl = deliveryCardRefs.current.get(connection.fromDeliveryId);
                            const targetEl = deliveryCardRefs.current.get(connection.toDeliveryId);
                            const containerEl = gridContentRef.current;
                            if (!sourceEl || !targetEl || !containerEl) return null;
                            const containerRect = containerEl.getBoundingClientRect();
                            const sourceRect = sourceEl.getBoundingClientRect();
                            const targetRect = targetEl.getBoundingClientRect();
                            const startSide = connection.fromHandle || 'right';
                            const endSide = connection.toHandle || 'left';
                            const startPoint = getHandlePoint(sourceRect, containerRect, startSide);
                            const endPoint = getHandlePoint(targetRect, containerRect, endSide);
                            const startX = startPoint.x;
                            const startY = startPoint.y;
                            const endX = endPoint.x;
                            const endY = endPoint.y;
                            const curve = Math.max(40, Math.abs(endX - startX) * 0.4);
                            const path = `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
                            return (
                              <path
                                key={connection.id}
                                d={path}
                                stroke="#94a3b8"
                                strokeWidth={2}
                                fill="none"
                                markerEnd="url(#schedule-arrow)"
                              />
                            );
                          })}
                        </svg>

                        {(() => {
                          const stackCounts = new Map<string, number>();
                          return funnel.deliveries.map((delivery) => {
                            const layout = resolveDeliveryLayout(delivery);
                            const stackKey = `${layout.segmentStart}:${layout.startIndex}`;
                            const stackIndex = stackCounts.get(stackKey) ?? 0;
                            stackCounts.set(stackKey, stackIndex + 1);
                            const left = layout.startIndex * dayWidth + 6;
                            const top = layout.segmentStart * rowHeight + 6 + stackIndex * 62;
                            const rawWidth = (layout.endIndex - layout.startIndex + 1) * dayWidth - 12;
                            const rawHeight = (layout.segmentEnd - layout.segmentStart + 1) * rowHeight - 12;
                            const width = Math.min(Math.max(88, rawWidth), scheduleSize.width - left - 6);
                            const height = Math.min(Math.max(48, rawHeight), scheduleSize.height - top - 6);
                            const isActive = activeCardId === delivery.id;
                          const startSegmentName = funnel.segments[layout.segmentStart]?.name || '';
                          const endSegmentName = funnel.segments[layout.segmentEnd]?.name || '';
                          const segmentLabel =
                            layout.segmentStart === layout.segmentEnd
                              ? startSegmentName
                              : `${startSegmentName}〜${endSegmentName}`;
                          return (
                            <div
                              key={delivery.id}
                              ref={setDeliveryCardRef(delivery.id)}
                              onMouseDown={(e) => handleCardMouseDown(e, delivery)}
                              onClick={(e) => handleDeliveryClick(e, delivery)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                openScheduleModal(delivery);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setScheduleContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  deliveryId: delivery.id,
                                });
                              }}
                              className={`absolute rounded-lg border bg-white shadow-sm transition overflow-visible ${
                                isActive ? 'ring-2 ring-blue-200 border-blue-300' : 'border-gray-200'
                              }`}
                              style={{ left, top, width, height }}
                            >
                              <div
                                className={`absolute left-1/2 -translate-x-1/2 top-1 w-2 h-2 rounded-full border bg-white cursor-pointer ${
                                  connectingFrom?.id === delivery.id && connectingFrom.side === 'top'
                                    ? 'border-blue-400'
                                    : 'border-gray-300'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (connectingFrom && connectingFrom.id !== delivery.id) {
                                    handleAddConnection(connectingFrom.id, connectingFrom.side, delivery.id, 'top');
                                  } else {
                                    handleStartConnection(delivery.id, 'top');
                                  }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                title="接続"
                              >
                                <span className="sr-only">接続</span>
                              </div>
                              <div
                                className={`absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border bg-white cursor-pointer ${
                                  connectingFrom?.id === delivery.id && connectingFrom.side === 'right'
                                    ? 'border-blue-400'
                                    : 'border-gray-300'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (connectingFrom && connectingFrom.id !== delivery.id) {
                                    handleAddConnection(connectingFrom.id, connectingFrom.side, delivery.id, 'right');
                                  } else {
                                    handleStartConnection(delivery.id, 'right');
                                  }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                title="接続"
                              >
                                <span className="sr-only">接続</span>
                              </div>
                              <div
                                className={`absolute left-1/2 -translate-x-1/2 bottom-1 w-2 h-2 rounded-full border bg-white cursor-pointer ${
                                  connectingFrom?.id === delivery.id && connectingFrom.side === 'bottom'
                                    ? 'border-blue-400'
                                    : 'border-gray-300'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (connectingFrom && connectingFrom.id !== delivery.id) {
                                    handleAddConnection(connectingFrom.id, connectingFrom.side, delivery.id, 'bottom');
                                  } else {
                                    handleStartConnection(delivery.id, 'bottom');
                                  }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                title="接続"
                              >
                                <span className="sr-only">接続</span>
                              </div>
                              <div
                                className={`absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border bg-white cursor-pointer ${
                                  connectingFrom?.id === delivery.id && connectingFrom.side === 'left'
                                    ? 'border-blue-400'
                                    : 'border-gray-300'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (connectingFrom && connectingFrom.id !== delivery.id) {
                                    handleAddConnection(connectingFrom.id, connectingFrom.side, delivery.id, 'left');
                                  } else {
                                    handleStartConnection(delivery.id, 'left');
                                  }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                title="接続"
                              >
                                <span className="sr-only">接続</span>
                              </div>
                              <div className="flex items-start justify-between gap-2 px-2 pt-2">
                                <div className="text-[11px] font-medium text-gray-700 truncate">
                                  {delivery.title || 'タイトル'}
                                </div>
                              </div>
                              <div className="px-2 pt-1 text-[9px] text-gray-400 truncate">
                                {segmentLabel}
                              </div>

                              <div className="px-2 pb-2 pt-1 text-[10px] text-gray-500">
                                <div className="text-[10px] text-gray-500 line-clamp-2">
                                  {delivery.description || '訴求・詳細'}
                                </div>
                              </div>

                            </div>
                          );
                          });
                        })()}
                      </div>
                    </div>
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

      {isScheduleModalOpen && scheduleModalDeliveryId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-[360px] p-4">
            <div className="text-sm font-medium text-gray-700 mb-3">配信カード</div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">タイトル</label>
                <input
                  type="text"
                  value={scheduleModalTitle}
                  onChange={(e) => setScheduleModalTitle(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none"
                  placeholder="タイトル"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">訴求・詳細</label>
                <textarea
                  value={scheduleModalDescription}
                  onChange={(e) => setScheduleModalDescription(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 h-20 resize-none focus:outline-none"
                  placeholder="訴求・詳細"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">期間</label>
                <div className="flex items-center gap-2">
                  <select
                    value={scheduleModalStartIndex}
                    onChange={(e) => setScheduleModalStartIndex(parseInt(e.target.value, 10))}
                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    {dates.map((date, idx) => (
                      <option key={`start-${date}`} value={idx}>
                        {formatDate(date)}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400">→</span>
                  <select
                    value={scheduleModalEndIndex}
                    onChange={(e) => setScheduleModalEndIndex(parseInt(e.target.value, 10))}
                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    {dates.map((date, idx) => (
                      <option key={`end-${date}`} value={idx}>
                        {formatDate(date)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">セグメント</label>
                <div className="flex items-center gap-2">
                  <select
                    value={scheduleModalSegmentStart}
                    onChange={(e) => setScheduleModalSegmentStart(parseInt(e.target.value, 10))}
                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    {funnel.segments.map((segment, idx) => (
                      <option key={`seg-start-${segment.id}`} value={idx}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400">→</span>
                  <select
                    value={scheduleModalSegmentEnd}
                    onChange={(e) => setScheduleModalSegmentEnd(parseInt(e.target.value, 10))}
                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    {funnel.segments.map((segment, idx) => (
                      <option key={`seg-end-${segment.id}`} value={idx}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleDeliveryDelete(scheduleModalDeliveryId)}
                className="text-xs text-red-500 px-2 py-1"
              >
                削除
              </button>
              <button
                type="button"
                onClick={closeScheduleModal}
                className="text-xs text-gray-500 px-2 py-1"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveScheduleModal}
                className="text-xs bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-800"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleContextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded shadow-md text-xs"
          style={{ left: scheduleContextMenu.x, top: scheduleContextMenu.y }}
        >
          <button
            type="button"
            onClick={() => {
              const target = funnel.deliveries.find(
                (delivery) => delivery.id === scheduleContextMenu.deliveryId
              );
              if (target) openScheduleModal(target);
              setScheduleContextMenu(null);
            }}
            className="block w-full text-left px-3 py-2 hover:bg-gray-100"
          >
            編集
          </button>
          <button
            type="button"
            onClick={() => {
              handleDeliveryDelete(scheduleContextMenu.deliveryId);
              setScheduleContextMenu(null);
            }}
            className="block w-full text-left px-3 py-2 text-red-500 hover:bg-red-50"
          >
            削除
          </button>
        </div>
      )}

    </div>
  );
}
