/**
 * useRecordHandlers — 统一封装 12 个饮食/运动/饮水 handler
 *
 * 通过 4 个工厂函数消除今日 vs 历史、追加 vs 替换的高度重复代码：
 *  - makeMealsHandler    (追加 / 替换 × 今日 / 历史)
 *  - makeExercisesHandler(追加 / 替换 × 今日 / 历史)
 *  - makeWaterUpdateHandler (追加 × 今日 / 历史)
 *  - makeWaterReplaceHandler(替换 × 今日 / 历史)
 */

import { useCallback } from 'react';
import { saveTodayRecord, saveRecordByDate } from '../utils/storage';
import { idbSaveRecord } from '../utils/indexedDB';
import { syncRecordToCloud } from '../utils/githubDB';
import type {
  DailyRecord,
  MealRecord,
  MealType,
  FoodItem,
  ExerciseItem,
  WaterItem,
} from '../types';

// ─── 工厂函数 ─────────────────────────────────────────────

type Setter = (fn: (prev: DailyRecord | null) => DailyRecord | null) => void;
type SaveFn = (r: DailyRecord) => void;

function makeMealsHandler(
  set: Setter,
  save: SaveFn,
  scheduleScroll: (type: MealType | 'exercise') => void,
  replace: boolean,
  makeEmpty: (date: string) => DailyRecord,
  journalDate?: string,
) {
  return (updates: { mealType: MealType; item: FoodItem }[]) => {
    set(prev => {
      const base = prev ?? makeEmpty(journalDate!);
      const newMeals = { ...base.meals };
      if (replace) {
        const affected = new Set(updates.map(u => u.mealType));
        for (const type of affected) newMeals[type] = [];
      }
      for (const { mealType, item } of updates) {
        newMeals[mealType] = [...newMeals[mealType], item];
      }
      const newRecord = { ...base, meals: newMeals };
      save(newRecord);
      idbSaveRecord(newRecord).catch(() => {});
      if (!journalDate) syncRecordToCloud(newRecord).catch(() => {});
      return newRecord;
    });
    const uniqueTypes = [...new Set(updates.map(u => u.mealType))];
    uniqueTypes.forEach(type => scheduleScroll(type));
  };
}

function makeExercisesHandler(
  set: Setter,
  save: SaveFn,
  scheduleScroll: (type: MealType | 'exercise') => void,
  replace: boolean,
  makeEmpty: (date: string) => DailyRecord,
  journalDate?: string,
) {
  return (exercises: ExerciseItem[]) => {
    set(prev => {
      const base = prev ?? makeEmpty(journalDate!);
      const newRecord = {
        ...base,
        exercises: replace ? exercises : [...base.exercises, ...exercises],
      };
      save(newRecord);
      idbSaveRecord(newRecord).catch(() => {});
      if (!journalDate) syncRecordToCloud(newRecord).catch(() => {});
      return newRecord;
    });
    if (exercises.length > 0) scheduleScroll('exercise');
  };
}

function makeWaterUpdateHandler(
  set: Setter,
  save: SaveFn,
  makeEmpty: (date: string) => DailyRecord,
  journalDate?: string,
) {
  return (items: WaterItem[]) => {
    set(prev => {
      const base = prev ?? makeEmpty(journalDate!);
      const newRecord = { ...base, water: [...(base.water ?? []), ...items] };
      save(newRecord);
      idbSaveRecord(newRecord).catch(() => {});
      if (!journalDate) syncRecordToCloud(newRecord).catch(() => {});
      return newRecord;
    });
  };
}

function makeWaterReplaceHandler(
  set: Setter,
  save: SaveFn,
  cloudSync: boolean,
  makeEmpty: (date: string) => DailyRecord,
  journalDate?: string,
) {
  return (items: WaterItem[]) => {
    set(prev => {
      const base = prev ?? makeEmpty(journalDate!);
      const newRecord = { ...base, water: items };
      save(newRecord);
      idbSaveRecord(newRecord).catch(() => {});
      if (cloudSync) syncRecordToCloud(newRecord).catch(() => {});
      return newRecord;
    });
  };
}

// ─── Hook 入口 ────────────────────────────────────────────

interface Params {
  setRecord: (fn: (prev: DailyRecord | null) => DailyRecord | null) => void;
  setHistoryRecord: (fn: (prev: DailyRecord | null) => DailyRecord | null) => void;
  journalDate: string;
  scheduleScroll: (type: MealType | 'exercise') => void;
  makeEmptyRecordFn: (date: string) => DailyRecord;
}

export function useRecordHandlers({
  setRecord,
  setHistoryRecord,
  journalDate,
  scheduleScroll,
  makeEmptyRecordFn,
}: Params) {
  // ── 今日 ──────────────────────────────────────────────
  const handleMealsUpdate = useCallback(
    makeMealsHandler(setRecord, saveTodayRecord, scheduleScroll, false, makeEmptyRecordFn),
    [setRecord, scheduleScroll, makeEmptyRecordFn],
  );

  const handleMealsReplace = useCallback(
    makeMealsHandler(setRecord, saveTodayRecord, scheduleScroll, true, makeEmptyRecordFn),
    [setRecord, scheduleScroll, makeEmptyRecordFn],
  );

  const handleExercisesUpdate = useCallback(
    makeExercisesHandler(setRecord, saveTodayRecord, scheduleScroll, false, makeEmptyRecordFn),
    [setRecord, scheduleScroll, makeEmptyRecordFn],
  );

  const handleExercisesReplace = useCallback(
    makeExercisesHandler(setRecord, saveTodayRecord, scheduleScroll, true, makeEmptyRecordFn),
    [setRecord, scheduleScroll, makeEmptyRecordFn],
  );

  const handleWaterUpdate = useCallback(
    makeWaterUpdateHandler(setRecord, saveTodayRecord, makeEmptyRecordFn),
    [setRecord, makeEmptyRecordFn],
  );

  const handleWaterReplace = useCallback(
    makeWaterReplaceHandler(setRecord, saveTodayRecord, true, makeEmptyRecordFn),
    [setRecord, makeEmptyRecordFn],
  );

  // ── 历史 ──────────────────────────────────────────────
  const handleHistoryMealsUpdate = useCallback(
    makeMealsHandler(setHistoryRecord, saveRecordByDate, scheduleScroll, false, makeEmptyRecordFn, journalDate),
    [setHistoryRecord, scheduleScroll, journalDate, makeEmptyRecordFn],
  );

  const handleHistoryMealsReplace = useCallback(
    makeMealsHandler(setHistoryRecord, saveRecordByDate, scheduleScroll, true, makeEmptyRecordFn, journalDate),
    [setHistoryRecord, scheduleScroll, journalDate, makeEmptyRecordFn],
  );

  const handleHistoryExercisesUpdate = useCallback(
    makeExercisesHandler(setHistoryRecord, saveRecordByDate, scheduleScroll, false, makeEmptyRecordFn, journalDate),
    [setHistoryRecord, scheduleScroll, journalDate, makeEmptyRecordFn],
  );

  const handleHistoryExercisesReplace = useCallback(
    makeExercisesHandler(setHistoryRecord, saveRecordByDate, scheduleScroll, true, makeEmptyRecordFn, journalDate),
    [setHistoryRecord, scheduleScroll, journalDate, makeEmptyRecordFn],
  );

  const handleHistoryWaterUpdate = useCallback(
    makeWaterUpdateHandler(setHistoryRecord, saveRecordByDate, makeEmptyRecordFn, journalDate),
    [setHistoryRecord, journalDate, makeEmptyRecordFn],
  );

  const handleHistoryWaterReplace = useCallback(
    makeWaterReplaceHandler(setHistoryRecord, saveRecordByDate, true, makeEmptyRecordFn, journalDate),
    [setHistoryRecord, journalDate, makeEmptyRecordFn],
  );

  return {
    handleMealsUpdate, handleMealsReplace,
    handleExercisesUpdate, handleExercisesReplace,
    handleWaterUpdate, handleWaterReplace,
    handleHistoryMealsUpdate, handleHistoryMealsReplace,
    handleHistoryExercisesUpdate, handleHistoryExercisesReplace,
    handleHistoryWaterUpdate, handleHistoryWaterReplace,
  };
}
