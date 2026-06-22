/**
 * useHistoryRecord — 历史记录加载与云端同步
 *
 * 当 journalDate 变化时：
 *  1. 若为今天 → 清空历史记录（今日由 useRecordSync 管理）
 *  2. 否则 → 先加载 IndexedDB/localStorage，再异步从云端同步（云端有而本地空时覆盖）
 */

import { useState, useEffect, useCallback } from 'react';
import { loadRecordByDate, saveRecordByDate } from '../utils/storage';
import { idbGetRecord, idbSaveRecord } from '../utils/indexedDB';
import { loadRecordFromCloud } from '../utils/githubDB';
import { getTodayKey } from '../utils/recordHelpers';
import type { DailyRecord } from '../types';

export function useHistoryRecord(journalDate: string) {
  const [historyRecord, setHistoryRecord] = useState<DailyRecord | null>(null);

  useEffect(() => {
    const today = getTodayKey();
    if (journalDate === today) {
      setHistoryRecord(null);
      return;
    }

    // 先加载本地 / IndexedDB，再异步从云端同步
    idbGetRecord(journalDate)
      .then(idbRec => {
        const localRec = idbRec ?? loadRecordByDate(journalDate);
        setHistoryRecord(localRec);

        loadRecordFromCloud(journalDate)
          .then(cloudRec => {
            if (!cloudRec) return;
            const localEmpty =
              !localRec?.meals?.breakfast?.length &&
              !localRec?.meals?.lunch?.length &&
              !localRec?.meals?.dinner?.length &&
              !localRec?.meals?.snack?.length &&
              !localRec?.exercises?.length;
            const cloudHasData =
              cloudRec.meals.breakfast.length ||
              cloudRec.meals.lunch.length ||
              cloudRec.meals.dinner.length ||
              cloudRec.meals.snack.length ||
              cloudRec.exercises.length;

            if (localEmpty && cloudHasData) {
              setHistoryRecord(cloudRec);
              saveRecordByDate(cloudRec);
              idbSaveRecord(cloudRec).catch(() => {});
            }
          })
          .catch(() => {});
      })
      .catch(() => {
        const localRec = loadRecordByDate(journalDate);
        setHistoryRecord(localRec);

        loadRecordFromCloud(journalDate)
          .then(cloudRec => {
            if (cloudRec) {
              setHistoryRecord(cloudRec);
              saveRecordByDate(cloudRec);
              idbSaveRecord(cloudRec).catch(() => {});
            }
          })
          .catch(() => {});
      });
  }, [journalDate]);

  /** 全量替换历史记录 → localStorage + IndexedDB（不同步到云端） */
  const handleHistoryRecordChange = useCallback((newRecord: DailyRecord) => {
    setHistoryRecord(newRecord);
    saveRecordByDate(newRecord);
    idbSaveRecord(newRecord).catch(() => {});
  }, []);

  return { historyRecord, setHistoryRecord, handleHistoryRecordChange };
}
