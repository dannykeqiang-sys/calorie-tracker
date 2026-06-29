/**
 * useBatchImport — 批量导入与口令恢复
 *
 * handleBatchImport:  解析多日期条目，按 overwrite/append 模式分派到各 handler
 * handleBackupImport: 口令恢复，直接将完整记录写入 localStorage + IndexedDB
 */

import { useCallback } from 'react';
import { loadTodayRecord, saveRecordByDate, loadRecordByDate, saveTodayRecord } from '../utils/storage';
import { idbGetRecord, idbSaveRecord } from '../utils/indexedDB';
import { syncRecordToCloud } from '../utils/apiDB';
import { getTodayKey, makeEmptyRecord } from '../utils/recordHelpers';
import type { ImportMode } from '../pages/components/BatchImportModal';
import type { MultiDateEntry } from '../utils/deepseek';
import type {
  DailyRecord,
  MealRecord,
  MealType,
  FoodItem,
  ExerciseItem,
  WaterItem,
} from '../types';

interface HandlerFns {
  handleMealsUpdate: (u: { mealType: MealType; item: FoodItem }[]) => void;
  handleExercisesUpdate: (e: ExerciseItem[]) => void;
  handleWaterUpdate: (w: WaterItem[]) => void;
  handleMealsReplace: (u: { mealType: MealType; item: FoodItem }[]) => void;
  handleExercisesReplace: (e: ExerciseItem[]) => void;
  handleWaterReplace: (w: WaterItem[]) => void;
}

export function useBatchImport(
  handlers: HandlerFns,
  setRecord: (v: DailyRecord | null | ((p: DailyRecord | null) => DailyRecord | null)) => void,
) {
  const {
    handleMealsUpdate, handleExercisesUpdate, handleWaterUpdate,
    handleMealsReplace, handleExercisesReplace, handleWaterReplace,
  } = handlers;

  /** 将历史记录复用为今日记录 */
  const handleReuseHistoryRecord = useCallback(
    (historyRecord: DailyRecord | null) => {
      if (!historyRecord) return;
      setRecord(prev => {
        const base = (prev as DailyRecord | null) ?? makeEmptyRecord(getTodayKey());
        const newRecord: DailyRecord = {
          ...base,
          meals: { ...historyRecord.meals },
          exercises: [...historyRecord.exercises],
          water: [...(historyRecord.water ?? [])],
        };
        saveTodayRecord(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        syncRecordToCloud(newRecord).catch(() => {});
        return newRecord;
      });
    },
    [setRecord],
  );

  /** 批量导入：支持 overwrite / append 两种模式 */
  const handleBatchImport = useCallback(
    async (entries: MultiDateEntry[], mode: ImportMode) => {
      const todayKey = getTodayKey();

      for (const entry of entries) {
        const isToday = entry.date === todayKey;

        const mealUpdates: { mealType: MealType; item: FoodItem }[] = [];
        for (const mt of ['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]) {
          for (const f of entry.meals[mt] ?? []) {
            mealUpdates.push({
              mealType: mt,
              item: {
                id: crypto.randomUUID(),
                name: f.name,
                calories: f.calories,
                protein: f.protein,
                carbs: f.carbs,
                fat: f.fat,
                sodium: f.sodium,
              },
            });
          }
        }

        const exerciseItems: ExerciseItem[] = (entry.exercises ?? []).map(e => ({
          id: crypto.randomUUID(),
          name: e.name,
          calories: e.calories,
          duration: 0,
        }));

        const waterItems: WaterItem[] = (entry.water_logs ?? []).map(w => ({
          id: crypto.randomUUID(),
          amount: w.amount,
          note: w.raw_text,
          time: '',
        }));

        if (isToday) {
          if (mode === 'overwrite') {
            if (mealUpdates.length > 0) handleMealsReplace(mealUpdates);
            if (exerciseItems.length > 0) handleExercisesReplace(exerciseItems);
            if (waterItems.length > 0) handleWaterReplace(waterItems);
          } else {
            if (mealUpdates.length > 0) handleMealsUpdate(mealUpdates);
            if (exerciseItems.length > 0) handleExercisesUpdate(exerciseItems);
            if (waterItems.length > 0) handleWaterUpdate(waterItems);
          }
        } else {
          // 非今日：直接操作 localStorage + IndexedDB，不影响当前视图状态
          let existing: DailyRecord;
          try {
            existing =
              (await idbGetRecord(entry.date)) ??
              loadRecordByDate(entry.date) ??
              makeEmptyRecord(entry.date);
          } catch {
            existing = loadRecordByDate(entry.date) ?? makeEmptyRecord(entry.date);
          }

          let newRecord: DailyRecord;
          if (mode === 'overwrite') {
            const newMeals = {
              breakfast: [], lunch: [], dinner: [], snack: [],
            } as MealRecord;
            for (const { mealType, item } of mealUpdates) {
              newMeals[mealType] = [...newMeals[mealType], item];
            }
            newRecord = { ...existing, meals: newMeals, exercises: exerciseItems, water: waterItems };
          } else {
            const newMeals = { ...existing.meals };
            for (const { mealType, item } of mealUpdates) {
              newMeals[mealType] = [...(newMeals[mealType] ?? []), item];
            }
            newRecord = {
              ...existing,
              meals: newMeals,
              exercises: [...(existing.exercises ?? []), ...exerciseItems],
              water: [...(existing.water ?? []), ...waterItems],
            };
          }

          saveRecordByDate(newRecord);
          await idbSaveRecord(newRecord).catch(() => {});
        }
      }
    },
    [
      handleMealsUpdate, handleExercisesUpdate, handleWaterUpdate,
      handleMealsReplace, handleExercisesReplace, handleWaterReplace,
    ],
  );

  /** 口令恢复：直接将完整记录写入，若包含今天则刷新当前记录 */
  const handleBackupImport = useCallback(
    async (records: DailyRecord[]) => {
      for (const r of records) {
        saveRecordByDate(r);
        await idbSaveRecord(r).catch(() => {});
      }
      const todayKey = getTodayKey();
      if (records.some(r => r.date === todayKey)) {
        setRecord(loadTodayRecord());
      }
    },
    [setRecord],
  );

  return { handleBatchImport, handleBackupImport, handleReuseHistoryRecord };
}
