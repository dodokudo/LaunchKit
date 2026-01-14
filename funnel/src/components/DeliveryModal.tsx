'use client';

import { useState } from 'react';
import { DeliveryItem, Segment, DELIVERY_TYPES } from '@/types/funnel';

interface DeliveryModalProps {
  date: string;
  segments: Segment[];
  initialSegmentIds: string[];
  delivery: DeliveryItem | null;
  onSave: (delivery: DeliveryItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function DeliveryModal({
  date,
  segments,
  initialSegmentIds,
  delivery,
  onSave,
  onDelete,
  onClose,
}: DeliveryModalProps) {
  const [title, setTitle] = useState(delivery?.title || '');
  const [description, setDescription] = useState(delivery?.description || '');
  const [type, setType] = useState<DeliveryItem['type']>(delivery?.type || 'message');
  const [startDate, setStartDate] = useState(delivery?.startDate || delivery?.date || date);
  const [endDate, setEndDate] = useState(delivery?.endDate || delivery?.date || date);
  const [isRange, setIsRange] = useState(() => {
    const start = delivery?.startDate || delivery?.date || date;
    const end = delivery?.endDate || delivery?.date || date;
    return start !== end;
  });
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>(
    delivery?.segmentIds || delivery?.segmentId ? [delivery.segmentId] : initialSegmentIds
  );

  const handleSegmentToggle = (segmentId: string) => {
    setSelectedSegmentIds(prev => {
      if (prev.includes(segmentId)) {
        // 最低1つは選択必須
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== segmentId);
      } else {
        return [...prev, segmentId];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedSegmentIds(segments.map(s => s.id));
  };

  const handleSave = () => {
    if (!title.trim() || selectedSegmentIds.length === 0) return;
    const normalizedEndDate = isRange && endDate >= startDate ? endDate : startDate;

    const newDelivery: DeliveryItem = {
      id: delivery?.id || `delivery-${Date.now()}`,
      date: startDate,
      startDate,
      endDate: normalizedEndDate,
      segmentId: selectedSegmentIds[0], // 後方互換性
      segmentIds: selectedSegmentIds,
      title: title.trim(),
      description: description.trim() || undefined,
      type,
    };

    onSave(newDelivery);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const formatDateRange = () => {
    if (startDate === endDate) return formatDate(startDate);
    return `${formatDate(startDate)} 〜 ${formatDate(endDate)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="panel-surface w-full max-w-md mx-4">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800">
              {delivery ? '配信スケジュールを編集' : '配信スケジュールを追加'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {formatDateRange()}
          </p>
        </div>

        {/* フォーム */}
        <div className="p-4 space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 予告配信"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* 配信期間 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                配信期間
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={isRange}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIsRange(next);
                    if (!next) setEndDate(startDate);
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                期間指定
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">開始</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setStartDate(nextStart);
                    if (!isRange) setEndDate(nextStart);
                    if (isRange && endDate < nextStart) setEndDate(nextStart);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">終了</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={!isRange}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${!isRange ? 'bg-gray-100 text-gray-400' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* セグメント選択 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                対象セグメント
              </label>
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                全て選択
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {segments.map(segment => (
                <label
                  key={segment.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedSegmentIds.includes(segment.id)}
                    onChange={() => handleSegmentToggle(segment.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-sm">{segment.name}</span>
                </label>
              ))}
            </div>
            {selectedSegmentIds.length > 1 && (
              <p className="text-xs text-blue-600 mt-1">
                {selectedSegmentIds.length}つのセグメントに同時配信
              </p>
            )}
          </div>

          {/* タイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              配信タイプ
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(DELIVERY_TYPES) as [DeliveryItem['type'], typeof DELIVERY_TYPES[DeliveryItem['type']]][]).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`p-2 rounded-lg border-2 transition ${
                    type === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: value.color }} />
                    <span className="text-xs font-medium">{value.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メモ（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="配信内容の詳細など"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <div>
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || selectedSegmentIds.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
