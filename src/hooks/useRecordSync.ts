/**
 * useRecordSync — 今日记录的加载、云端同步与持久化
 *
 * 职责：
 *  1. 初始化时从 localStorage 加载今日记录
 *  2. 异步从 GitHub 云端同步，执行合并策略（本地空 → 覆盖；双方有数据 → 追加云端独有项）
 *  3. 提供 handleRecordChange：同时写入 localStorage + IndexedDB + 云端
 */

import { useState, useEffect, useCallback } from 'react';
import { loadTodayRecord, saveTodayRecord } from '../utils/storage';
import { idbSaveRecord } from '../utils/indexedDB';
import { syncRecordToCloud, loadRecordFromCloud } from '../utils/apiDB';
import { getTodayKey } from '../utils/recordHelpers';
import type { DailyRecord, MealRecord } from '../types';

export function useRecordSync() {
  const [record, setRecord] = useState<DailyRecord | null>(() => loadTodayRecord());

  // 初始挂载：从云端同步今日记录（跨设备数据一致）
  useEffect(() => {
    const todayKey = getTodayKey();
    const localRecord = loadTodayRecord();

    loadRecordFromCloud(todayKey)
      .then(cloudRecord => {
        if (!cloudRecord) return;

        const localEmpty =
          !localRecord.meals.breakfast.length &&
          !localRecord.meals.lunch.length &&
          !localRecord.meals.dinner.length &&
          !localRecord.meals.snack.length &&
          !localRecord.exercises.length;

        const cloudHasData =
          cloudRecord.meals.breakfast.length ||
          cloudRecord.meals.lunch.length ||
          cloudRecord.meals.dinner.length ||
          cloudRecord.meals.snack.length ||
          cloudRecord.exercises.length;

        if (localEmpty && cloudHasData) {
          // 本地为空 → 直接采用云端数据
          const merged = { ...cloudRecord, date: todayKey };
          setRecord(merged);
          saveTodayRecord(merged);
          idbSaveRecord(merged).catch(() => {});
        } else if (cloudHasData) {
          // 双端均有数据 → 将云端独有项追加到本地
          setRecord(prev => {
            if (!prev) return prev;

            const mergedMeals = { ...prev.meals };
            const existingNames = new Set(
              Object.values(mergedMeals).flat().map(f => f.name),
            );
            for (const mt of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
              const newItems = (cloudRecord.meals[mt] || []).filter(
                f => !existingNames.has(f.name),
              );
              if (newItems.length > 0) {
                mergedMeals[mt] = [...mergedMeals[mt], ...newItems];
              }
            }

            const existingEx = new Set(prev.exercises.map(e => e.name));
            const newEx = cloudRecord.exercises.filter(
              e => !existingEx.has(e.name),
            );

            const prevWater = prev.water ?? [];
            const cloudWater = cloudRecord.water ?? [];
            const existingWater = prevWater.map(w => w.amount + w.time);
            const newWater = cloudWater.filter(
              w => !existingWater.includes(w.amount + w.time),
            );

            const result = {
              ...prev,
              meals: mergedMeals,
              exercises: [...prev.exercises, ...newEx],
              water: [...prevWater, ...newWater],
            };
            saveTodayRecord(result);
            idbSaveRecord(result).catch(() => {});
            return result;
          });
        }
      })
      .catch(() => {});
  }, []);

  /** 全量替换今日记录 → localStorage + IndexedDB + 云端 */
  const handleRecordChange = useCallback((newRecord: DailyRecord) => {
    setRecord(newRecord);
    saveTodayRecord(newRecord);
    idbSaveRecord(newRecord).catch(() => {});
    syncRecordToCloud(newRecord).catch(() => {});
  }, []);

  return { record, setRecord, handleRecordChange };
}
