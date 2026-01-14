'use client';

import { useState } from 'react';
import { Funnel } from '@/types/funnel';

interface SettingsPanelProps {
  funnel: Funnel;
  onUpdate: (funnel: Funnel) => void;
}

export function SettingsPanel({ funnel, onUpdate }: SettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleBaseDateChange = (baseDate: string) => {
    onUpdate({ ...funnel, baseDate, updatedAt: new Date().toISOString() });
  };

  const handleBaseDateDaysChange = (days: number) => {
    onUpdate({ ...funnel, baseDateDays: Math.max(1, days), updatedAt: new Date().toISOString() });
  };

  const handleBaseDateLabelChange = (baseDateLabel: string) => {
    onUpdate({ ...funnel, baseDateLabel, updatedAt: new Date().toISOString() });
  };

  const handleStartDateChange = (startDate: string) => {
    onUpdate({ ...funnel, startDate, updatedAt: new Date().toISOString() });
  };

  const handleEndDateChange = (endDate: string) => {
    onUpdate({ ...funnel, endDate, updatedAt: new Date().toISOString() });
  };

  // 販売期間の終了日を計算
  const getBaseDateEnd = () => {
    if (!funnel.baseDate) return '';
    const start = new Date(funnel.baseDate);
    const days = funnel.baseDateDays || 1;
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);
    return `${end.getMonth() + 1}/${end.getDate()}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <span>📅</span>
          <span className="font-medium text-gray-800">スケジュール</span>
        </div>
        <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {/* コンテンツ */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {/* 販売期間設定 */}
          <div className="pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">🎯 販売期間（基準日）</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">開始日</label>
                <input
                  type="date"
                  value={funnel.baseDate || ''}
                  onChange={(e) => handleBaseDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">日数</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={funnel.baseDateDays || 1}
                    onChange={(e) => handleBaseDateDaysChange(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">日間</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ラベル</label>
                <input
                  type="text"
                  value={funnel.baseDateLabel || ''}
                  onChange={(e) => handleBaseDateLabelChange(e.target.value)}
                  placeholder="販売期間"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {/* 期間表示 */}
            {funnel.baseDate && (
              <div className="mt-2 text-sm text-gray-600 bg-red-50 px-3 py-2 rounded-lg">
                📅 <strong>{funnel.baseDateLabel || '販売期間'}</strong>: {formatDate(funnel.baseDate)} 〜 {getBaseDateEnd()}
                （{funnel.baseDateDays || 1}日間）
              </div>
            )}
          </div>

          {/* 表示期間 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">📆 タイムライン表示範囲</h4>
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">開始</label>
                <input
                  type="date"
                  value={funnel.startDate || ''}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-gray-400 mt-5">〜</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">終了</label>
                <input
                  type="date"
                  value={funnel.endDate || ''}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
