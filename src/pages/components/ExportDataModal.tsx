import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/shadcn/dialog';
import { Download, Loader2, FileText, LayoutDashboard, Sheet, Shield, Key, Copy, Check } from 'lucide-react';
import { idbGetAllRecords } from '../../utils/indexedDB';
import { generatePasscode, encryptData } from '../../utils/crypto';
import { uploadBackup } from '../../utils/apiDB';
import type { DailyRecord } from '../../types';

interface ExportDataModalProps {
  open: boolean;
  onClose: () => void;
}

type ExportFormat = 'html' | 'text' | 'csv' | 'backup';
type FormatStatus = 'idle' | 'loading' | 'done' | 'empty' | 'error';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MEAL_LABELS: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
const MEAL_COLORS: Record<string, string> = { breakfast: '#f59e0b', lunch: '#10b981', dinner: '#6366f1', snack: '#ec4899' };
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function buildTextExport(records: DailyRecord[]): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const header = ['══════════════════════════════', '   健康记录数据导出', `   导出时间：${dateStr} ${timeStr}`, `   共 ${sorted.length} 天数据`, '══════════════════════════════', ''].join('\n');
  const body = sorted.map(r => {
    const lines: string[] = [];
    const d = new Date(r.date + 'T00:00:00');
    lines.push(`[ ${r.date} ${WEEKDAYS[d.getDay()]} ]`, '');
    let hasMeal = false;
    for (const mt of MEAL_ORDER) {
      const items = r.meals[mt] ?? [];
      if (items.length > 0) {
        hasMeal = true;
        lines.push(`  ${MEAL_LABELS[mt]}：`);
        items.forEach(f => lines.push(`    - ${f.name}  ${f.calories} kcal`));
        lines.push(`    小计：${items.reduce((s, f) => s + f.calories, 0)} kcal`);
      }
    }
    if (!hasMeal) lines.push('  （无饮食记录）');
    lines.push('');
    const exercises = r.exercises ?? [];
    if (exercises.length > 0) {
      lines.push('  运动：');
      exercises.forEach(e => lines.push(`    - ${e.name}${e.duration > 0 ? `  ${e.duration}分钟` : ''}  -${e.calories} kcal`));
      lines.push(`    消耗：${exercises.reduce((s, e) => s + e.calories, 0)} kcal`);
    }
    const water = r.water ?? [];
    if (water.length > 0) {
      lines.push('  饮水：');
      water.forEach(w => lines.push(`    - ${w.amount} ml${w.note ? `（${w.note}）` : ''}${w.time ? `  ${w.time}` : ''}`));
      lines.push(`    合计：${water.reduce((s, w) => s + w.amount, 0)} ml`);
    }
    return lines.join('\n');
  }).join('\n\n──────────────────────────────\n\n');
  return header + body + '\n';
}

function buildCsvExport(records: DailyRecord[]): string {
  const BOM = '\uFEFF';
  const rows: string[] = [];
  rows.push(['日期', '星期', '类别', '名称', '热量摄入(kcal)', '热量消耗(kcal)', '时长(分钟)', '饮水量(ml)', '蛋白质(g)', '碳水(g)', '脂肪(g)', '备注'].join(','));
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  for (const r of sorted) {
    const wd = WEEKDAYS[new Date(r.date + 'T00:00:00').getDay()];
    for (const mt of MEAL_ORDER) {
      for (const f of (r.meals[mt] ?? [])) {
        rows.push([escapeCsv(r.date), escapeCsv(wd), escapeCsv(MEAL_LABELS[mt]), escapeCsv(f.name), escapeCsv(f.calories), '', '', '', escapeCsv(f.protein ?? ''), escapeCsv(f.carbs ?? ''), escapeCsv(f.fat ?? ''), ''].join(','));
      }
    }
    for (const e of (r.exercises ?? [])) {
      rows.push([escapeCsv(r.date), escapeCsv(wd), '运动', escapeCsv(e.name), '', escapeCsv(e.calories), escapeCsv(e.duration || ''), '', '', '', '', ''].join(','));
    }
    for (const w of (r.water ?? [])) {
      rows.push([escapeCsv(r.date), escapeCsv(wd), '饮水', '水', '', '', '', escapeCsv(w.amount), '', '', '', escapeCsv(w.note ?? '')].join(','));
    }
  }
  return BOM + rows.join('\n');
}

function buildCalorieTrendSvg(records: DailyRecord[]): string {
  const n = records.length;
  if (n === 0) return '<p style="color:#94a3b8;text-align:center;padding:24px;font-size:12px">暂无数据</p>';
  const W = 800, H = 200, ml = 65, mr = 48, mt = 34, mb = 38;
  const iW = W - ml - mr;
  const iH = H - mt - mb;
  const kcalList = records.map(r => MEAL_ORDER.reduce((s, m) => s + (r.meals[m] ?? []).reduce((ms, f) => ms + f.calories, 0), 0));
  const burnList = records.map(r => (r.exercises ?? []).reduce((s, e) => s + e.calories, 0));
  const maxVal = Math.max(...kcalList, 500);
  const yTop = Math.ceil(maxVal / 500) * 500;
  const xOf = (i: number) => ml + (n === 1 ? iW / 2 : (i / (n - 1)) * iW);
  const yOf = (v: number) => mt + iH * (1 - Math.max(0, v) / yTop);
  const gVals = [500, 1000, 1500, 2000, 2500, 3000].filter(v => v <= yTop);
  let grids = '';
  for (const v of gVals) {
    const y = yOf(v);
    grids += '<line x1="' + ml + '" y1="' + y.toFixed(1) + '" x2="' + (W - mr) + '" y2="' + y.toFixed(1) + '" stroke="#f1f5f9" stroke-width="1"/>';
    grids += '<text x="' + (ml - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="#94a3b8" font-size="10">' + v + '</text>';
  }
  let areaD = 'M ' + xOf(0).toFixed(1) + ' ' + (mt + iH).toFixed(1);
  for (let i = 0; i < n; i++) areaD += ' L ' + xOf(i).toFixed(1) + ' ' + yOf(kcalList[i]).toFixed(1);
  areaD += ' L ' + xOf(n - 1).toFixed(1) + ' ' + (mt + iH).toFixed(1) + ' Z';
  let intakePts = '';
  for (let i = 0; i < n; i++) intakePts += (i > 0 ? ' ' : '') + xOf(i).toFixed(1) + ',' + yOf(kcalList[i]).toFixed(1);
  const hasBurn = burnList.some(v => v > 0);
  let netPts = '';
  if (hasBurn) {
    for (let i = 0; i < n; i++) netPts += (i > 0 ? ' ' : '') + xOf(i).toFixed(1) + ',' + yOf(kcalList[i] - burnList[i]).toFixed(1);
  }
  let dots = '';
  if (n <= 60) {
    for (let i = 0; i < n; i++) dots += '<circle cx="' + xOf(i).toFixed(1) + '" cy="' + yOf(kcalList[i]).toFixed(1) + '" r="' + (n > 30 ? 2 : 3) + '" fill="#6366f1" stroke="white" stroke-width="1.5"/>';
  }
  const step = Math.max(1, Math.ceil(n / 8));
  let xLabels = '';
  for (let i = 0; i < n; i++) {
    if (i % step !== 0 && i !== n - 1) continue;
    const d = new Date(records[i].date + 'T00:00:00');
    xLabels += '<text x="' + xOf(i).toFixed(1) + '" y="' + (mt + iH + 20).toFixed(1) + '" text-anchor="middle" fill="#94a3b8" font-size="10">' + (d.getMonth() + 1) + '/' + d.getDate() + '</text>';
  }
  const avg = kcalList.reduce((s, v) => s + v, 0) / n;
  const avgY = yOf(avg).toFixed(1);
  const legend = '<g transform="translate(' + ml + ',18)">'
    + '<rect x="0" y="0" width="12" height="4" rx="2" fill="#6366f1" opacity="0.85"/>'
    + '<text x="16" y="4.5" fill="#64748b" font-size="10">摄入热量</text>'
    + (hasBurn ? '<rect x="75" y="0" width="12" height="4" rx="2" fill="#f59e0b" opacity="0.75"/><text x="91" y="4.5" fill="#64748b" font-size="10">净热量（摄入-消耗）</text>' : '')
    + '<line x1="' + (hasBurn ? 220 : 80) + '" y1="2" x2="' + (hasBurn ? 234 : 94) + '" y2="2" stroke="#a3b899" stroke-width="1.5" stroke-dasharray="5,2"/>'
    + '<text x="' + (hasBurn ? 238 : 98) + '" y="4.5" fill="#64748b" font-size="10">日均</text>'
    + '</g>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block">'
    + '<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity="0.2"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0.02"/></linearGradient></defs>'
    + legend + grids
    + '<path d="' + areaD + '" fill="url(#ag)"/>'
    + (n > 1 ? '<polyline points="' + intakePts + '" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' : '')
    + (n > 1 && hasBurn ? '<polyline points="' + netPts + '" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="4,2"/>' : '')
    + dots
    + '<line x1="' + ml + '" y1="' + avgY + '" x2="' + (W - mr) + '" y2="' + avgY + '" stroke="#a3b899" stroke-width="1.5" stroke-dasharray="6,3"/>'
    + '<text x="' + (W - mr + 5) + '" y="' + (parseFloat(avgY) + 4).toFixed(1) + '" fill="#a3b899" font-size="10">' + Math.round(avg) + '</text>'
    + xLabels
    + '</svg>';
}

function buildMealDonutSvg(records: DailyRecord[]): string {
  const totals: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const r of records) {
    for (const mt of MEAL_ORDER) totals[mt] += (r.meals[mt] ?? []).reduce((s, f) => s + f.calories, 0);
  }
  const grand = Object.values(totals).reduce((s, v) => s + v, 0);
  if (grand === 0) return '<p style="text-align:center;color:#94a3b8;padding:20px;font-size:12px">暂无饮食数据</p>';
  const cx = 95, cy = 95, R = 68, ri = 42;
  const avgKcal = Math.round(grand / Math.max(1, records.length));
  const active = MEAL_ORDER.filter(mt => totals[mt] > 0);
  let paths = '';
  if (active.length === 1) {
    paths = '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + MEAL_COLORS[active[0]] + '"/>';
  } else {
    let angle = -Math.PI / 2;
    for (const mt of MEAL_ORDER) {
      if (totals[mt] === 0) continue;
      const sweep = (totals[mt] / grand) * 2 * Math.PI;
      const end = angle + sweep;
      const large = sweep > Math.PI ? 1 : 0;
      const ox1 = (cx + R * Math.cos(angle)).toFixed(2);
      const oy1 = (cy + R * Math.sin(angle)).toFixed(2);
      const ox2 = (cx + R * Math.cos(end)).toFixed(2);
      const oy2 = (cy + R * Math.sin(end)).toFixed(2);
      const ix2 = (cx + ri * Math.cos(end)).toFixed(2);
      const iy2 = (cy + ri * Math.sin(end)).toFixed(2);
      const ix1 = (cx + ri * Math.cos(angle)).toFixed(2);
      const iy1 = (cy + ri * Math.sin(angle)).toFixed(2);
      paths += '<path d="M ' + ox1 + ' ' + oy1 + ' A ' + R + ' ' + R + ' 0 ' + large + ' 1 ' + ox2 + ' ' + oy2 + ' L ' + ix2 + ' ' + iy2 + ' A ' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + ix1 + ' ' + iy1 + ' Z" fill="' + MEAL_COLORS[mt] + '" stroke="white" stroke-width="1.5"/>';
      angle = end;
    }
  }
  let legend = '';
  MEAL_ORDER.forEach((mt, i) => {
    const pct = Math.round(totals[mt] / grand * 100);
    const kcal = Math.round(totals[mt]);
    legend += '<g transform="translate(185,' + (18 + i * 26) + ')">'
      + '<rect width="11" height="11" rx="3" fill="' + MEAL_COLORS[mt] + '"/>'
      + '<text x="16" y="9" fill="#475569" font-size="11.5">' + MEAL_LABELS[mt] + ' ' + pct + '%</text>'
      + '<text x="16" y="20" fill="#94a3b8" font-size="9.5">' + kcal.toLocaleString() + ' kcal 共计</text>'
      + '</g>';
  });
  return '<svg viewBox="0 0 310 200" style="width:100%;display:block">'
    + '<text x="0" y="14" fill="#64748b" font-size="12" font-weight="700">餐食热量分布</text>'
    + paths
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (ri - 2) + '" fill="white"/>'
    + '<text x="' + cx + '" y="' + (cy - 10) + '" text-anchor="middle" fill="#94a3b8" font-size="10">日均摄入</text>'
    + '<text x="' + cx + '" y="' + (cy + 10) + '" text-anchor="middle" fill="#1e293b" font-size="20" font-weight="900">' + avgKcal + '</text>'
    + '<text x="' + cx + '" y="' + (cy + 26) + '" text-anchor="middle" fill="#94a3b8" font-size="10">kcal / 天</text>'
    + legend
    + '</svg>';
}

function buildExerciseBarsSvg(records: DailyRecord[]): string {
  const burnList = records.map(r => (r.exercises ?? []).reduce((s, e) => s + e.calories, 0));
  const activeDays = burnList.filter(v => v > 0).length;
  if (activeDays === 0) return '<p style="text-align:center;color:#94a3b8;padding:20px;font-size:12px">暂无运动记录</p>';
  const maxBurn = Math.max(...burnList, 100);
  const n = records.length;
  const W = 310, H = 200, ml = 50, mr = 18, mt = 34, mb = 35;
  const iW = W - ml - mr;
  const iH = H - mt - mb;
  const barW = Math.max(3, Math.min(18, iW / n - 2));
  const xOf = (i: number) => ml + (n === 1 ? iW / 2 : (i / (n - 1)) * iW);
  const yOf = (v: number) => mt + iH * (1 - v / maxBurn);
  const hOf = (v: number) => iH * v / maxBurn;
  const gStep = Math.max(100, Math.ceil(maxBurn / 3 / 100) * 100);
  let grids = '';
  for (let v = gStep; v <= maxBurn; v += gStep) {
    const y = yOf(v);
    grids += '<line x1="' + ml + '" y1="' + y.toFixed(1) + '" x2="' + (W - mr) + '" y2="' + y.toFixed(1) + '" stroke="#f1f5f9" stroke-width="1"/>';
    grids += '<text x="' + (ml - 4) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="#94a3b8" font-size="9">' + v + '</text>';
  }
  let bars = '';
  for (let i = 0; i < n; i++) {
    const v = burnList[i];
    if (v === 0) continue;
    bars += '<rect x="' + (xOf(i) - barW / 2).toFixed(1) + '" y="' + yOf(v).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + hOf(v).toFixed(1) + '" rx="2" fill="#ef4444" opacity="0.75"/>';
  }
  const avgBurn = burnList.filter(v => v > 0).reduce((s, v) => s + v, 0) / activeDays;
  const avgY = yOf(avgBurn).toFixed(1);
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block">'
    + '<text x="0" y="14" fill="#64748b" font-size="12" font-weight="700">运动消耗 (kcal)</text>'
    + '<text x="' + (W - mr) + '" y="14" text-anchor="end" fill="#94a3b8" font-size="10">' + activeDays + '/' + n + '天有运动</text>'
    + grids + bars
    + '<line x1="' + ml + '" y1="' + avgY + '" x2="' + (W - mr) + '" y2="' + avgY + '" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.55"/>'
    + '<text x="' + (W - mr + 3) + '" y="' + (parseFloat(avgY) + 4).toFixed(1) + '" fill="#ef4444" font-size="9" opacity="0.7">均值</text>'
    + '</svg>';
}

function buildWaterBarsSvg(records: DailyRecord[]): string {
  const waterList = records.map(r => (r.water ?? []).reduce((s, w) => s + w.amount, 0));
  const TARGET = 2000;
  const maxWater = Math.max(...waterList, TARGET, 500);
  const n = records.length;
  const W = 800, H = 170, ml = 60, mr = 60, mt = 28, mb = 35;
  const iW = W - ml - mr;
  const iH = H - mt - mb;
  const barW = Math.max(3, Math.min(22, iW / n - 2));
  const xOf = (i: number) => ml + (n === 1 ? iW / 2 : (i / (n - 1)) * iW);
  const yOf = (v: number) => mt + iH * (1 - Math.max(0, v) / maxWater);
  const hOf = (v: number) => iH * Math.max(0, v) / maxWater;
  const gVals = [500, 1000, 1500, 2000, 2500, 3000].filter(v => v <= maxWater);
  let grids = '';
  for (const v of gVals) {
    const y = yOf(v);
    grids += '<line x1="' + ml + '" y1="' + y.toFixed(1) + '" x2="' + (W - mr) + '" y2="' + y.toFixed(1) + '" stroke="#f1f5f9" stroke-width="1"/>';
    grids += '<text x="' + (ml - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="#94a3b8" font-size="10">' + v + '</text>';
  }
  let bars = '';
  for (let i = 0; i < n; i++) {
    const v = waterList[i];
    const met = v >= TARGET;
    bars += '<rect x="' + (xOf(i) - barW / 2).toFixed(1) + '" y="' + yOf(v).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + hOf(v).toFixed(1) + '" rx="2" fill="' + (met ? '#0ea5e9' : '#bae6fd') + '" opacity="0.85"/>';
  }
  const step = Math.max(1, Math.ceil(n / 8));
  let xLabels = '';
  for (let i = 0; i < n; i++) {
    if (i % step !== 0 && i !== n - 1) continue;
    const d = new Date(records[i].date + 'T00:00:00');
    xLabels += '<text x="' + xOf(i).toFixed(1) + '" y="' + (mt + iH + 20).toFixed(1) + '" text-anchor="middle" fill="#94a3b8" font-size="10">' + (d.getMonth() + 1) + '/' + d.getDate() + '</text>';
  }
  const targetY = yOf(TARGET).toFixed(1);
  const metDays = waterList.filter(v => v >= TARGET).length;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block">'
    + '<text x="' + ml + '" y="16" fill="#64748b" font-size="12" font-weight="700">每日饮水量 (ml)</text>'
    + '<text x="' + (W - mr) + '" y="16" text-anchor="end" fill="#94a3b8" font-size="10">' + metDays + '/' + n + '天达标</text>'
    + grids + bars
    + '<line x1="' + ml + '" y1="' + targetY + '" x2="' + (W - mr) + '" y2="' + targetY + '" stroke="#0ea5e9" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.7"/>'
    + '<text x="' + (W - mr + 6) + '" y="' + (parseFloat(targetY) + 4).toFixed(1) + '" fill="#0ea5e9" font-size="10" font-weight="600">2L 目标</text>'
    + xLabels
    + '</svg>';
}

function buildHtmlDashboard(records: DailyRecord[]): string {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const chrono = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const totalDays = sorted.length;
  const allMealKcal = sorted.map(r => MEAL_ORDER.reduce((s, mt) => s + (r.meals[mt] ?? []).reduce((ms, f) => ms + f.calories, 0), 0));
  const totalMealKcal = allMealKcal.reduce((s, v) => s + v, 0);
  const avgKcal = totalDays > 0 ? Math.round(totalMealKcal / totalDays) : 0;
  const totalBurn = sorted.reduce((s, r) => s + (r.exercises ?? []).reduce((es, e) => es + e.calories, 0), 0);
  const exerciseDays = sorted.filter(r => (r.exercises ?? []).length > 0).length;
  const totalWater = sorted.reduce((s, r) => s + (r.water ?? []).reduce((ws, w) => ws + w.amount, 0), 0);
  const avgWater = totalDays > 0 ? Math.round(totalWater / totalDays) : 0;
  const now = new Date();
  const exportTime = now.toISOString().split('T')[0] + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  const calorieSvg = buildCalorieTrendSvg(chrono);
  const donutSvg = buildMealDonutSvg(sorted);
  const exerciseSvg = buildExerciseBarsSvg(chrono);
  const waterSvg = buildWaterBarsSvg(chrono);

  const dayCardsHtml = sorted.map(r => {
    const d = new Date(r.date + 'T00:00:00');
    const wd = WEEKDAYS[d.getDay()];
    const dayKcal = MEAL_ORDER.reduce((s, mt) => s + (r.meals[mt] ?? []).reduce((ms, f) => ms + f.calories, 0), 0);
    const exercises = r.exercises ?? [];
    const dayBurn = exercises.reduce((s, e) => s + e.calories, 0);
    const netKcal = dayKcal - dayBurn;
    const water = r.water ?? [];
    const dayWater = water.reduce((s, w) => s + w.amount, 0);
    const mealRowsHtml = MEAL_ORDER.map(mt => {
      const items = r.meals[mt] ?? [];
      if (items.length === 0) return '';
      const mTotal = items.reduce((s, f) => s + f.calories, 0);
      const color = MEAL_COLORS[mt];
      const tags = items.map(f => '<span class="ftag">' + escHtml(f.name) + ' <b>' + f.calories + '</b>kcal</span>').join('');
      return '<div class="mrow"><div class="mlabel" style="color:' + color + '">' + MEAL_LABELS[mt] + '</div><div class="mcontent"><div class="ftags">' + tags + '</div><div class="mtotal" style="color:' + color + '">' + mTotal + ' kcal</div></div></div>';
    }).filter(Boolean).join('');
    const exHtml = exercises.length > 0 ? '<div class="srow"><span class="sicon" style="color:#ef4444">&#127939;</span><div class="scontent">' + exercises.map(e => '<span class="etag">' + escHtml(e.name) + (e.duration > 0 ? ' ' + e.duration + '分' : '') + ' <b>-' + e.calories + 'kcal</b></span>').join('') + '</div></div>' : '';
    const waterHtml = water.length > 0 ? '<div class="srow"><span class="sicon" style="color:#0ea5e9">&#128167;</span><div class="scontent"><span class="wtotal">' + dayWater + ' ml</span>' + water.map(w => '<span class="wtag">' + w.amount + 'ml' + (w.note ? ' ' + escHtml(w.note) : '') + '</span>').join('') + '</div></div>' : '';
    return '<div class="dcard"><div class="dhead"><div class="ddate">' + r.date + ' <span class="dwd">' + wd + '</span></div><div class="dsumm">' + (dayKcal > 0 ? '<span class="stag in">+' + dayKcal + 'kcal</span>' : '') + (dayBurn > 0 ? '<span class="stag ex">-' + dayBurn + 'kcal</span>' : '') + (dayBurn > 0 ? '<span class="stag net">净 ' + netKcal + 'kcal</span>' : '') + '</div></div>' + (mealRowsHtml || '<p class="empty">无饮食记录</p>') + exHtml + waterHtml + '</div>';
  }).join('');

  const css = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(135deg,#f0f4ff 0%,#fafbff 100%);color:#1e293b;min-height:100vh;padding:32px 16px}.wrap{max-width:900px;margin:0 auto}.hdr{text-align:center;margin-bottom:32px}.hdr h1{font-size:30px;font-weight:900;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-0.5px}.hdr .sub{font-size:12px;color:#94a3b8;margin-top:6px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}@media(max-width:600px){.stats{grid-template-columns:repeat(2,1fr)}}.sc{background:#fff;border-radius:18px;padding:18px 14px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.05)}.sv{font-size:26px;font-weight:900;color:#6366f1;line-height:1;margin-bottom:5px}.sl{font-size:11px;color:#94a3b8;font-weight:500}.charts{margin-bottom:18px}.csect{background:#fff;border-radius:18px;padding:20px 22px;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05);margin-bottom:14px;overflow:hidden}.crow{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}@media(max-width:600px){.crow{grid-template-columns:1fr}}.days{display:flex;flex-direction:column;gap:14px}.dcard{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05)}.dhead{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap;gap:8px}.ddate{font-size:14px;font-weight:800;letter-spacing:-0.2px}.dwd{font-size:11px;color:#94a3b8;font-weight:500;margin-left:5px}.dsumm{display:flex;gap:5px;flex-wrap:wrap}.stag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px}.stag.in{background:#fef3c7;color:#d97706}.stag.ex{background:#fee2e2;color:#dc2626}.stag.net{background:#ede9fe;color:#7c3aed}.mrow{display:flex;align-items:flex-start;padding:10px 18px;border-bottom:1px solid #f8fafc;gap:10px}.mlabel{font-size:11px;font-weight:700;width:30px;flex-shrink:0;padding-top:2px}.mcontent{flex:1}.ftags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px}.ftag{font-size:12px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:2px 7px}.mtotal{font-size:11px;font-weight:700}.srow{display:flex;align-items:flex-start;padding:9px 18px;border-bottom:1px solid #f8fafc;gap:9px}.sicon{font-size:14px;padding-top:1px;flex-shrink:0}.scontent{display:flex;flex-wrap:wrap;gap:5px;align-items:center}.etag{font-size:12px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:2px 7px}.wtotal{font-size:13px;font-weight:800;color:#0ea5e9}.wtag{font-size:11px;color:#0ea5e9;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;padding:2px 6px}.empty{font-size:12px;color:#cbd5e1;padding:14px 18px;text-align:center}.section-title{font-size:16px;font-weight:800;color:#1e293b;margin-bottom:12px;padding-left:4px}';

  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>健康记录看板</title>\n<style>' + css + '</style>\n</head>\n<body>\n<div class="wrap">\n'
    + '<div class="hdr"><h1>健康记录看板</h1><p class="sub">导出时间：' + exportTime + ' &nbsp;·&nbsp; 共 ' + totalDays + ' 天记录</p></div>\n'
    + '<div class="stats"><div class="sc"><div class="sv">' + totalDays + '</div><div class="sl">记录天数</div></div><div class="sc"><div class="sv">' + avgKcal + '</div><div class="sl">日均摄入 kcal</div></div><div class="sc"><div class="sv">' + exerciseDays + '</div><div class="sl">运动天数</div></div><div class="sc"><div class="sv">' + avgWater + '</div><div class="sl">日均饮水 ml</div></div></div>\n'
    + '<div class="charts">\n'
    + '<p class="section-title">数据分析</p>'
    + '<div class="csect">' + calorieSvg + '</div>'
    + '<div class="crow"><div class="csect">' + donutSvg + '</div><div class="csect">' + exerciseSvg + '</div></div>'
    + '<div class="csect">' + waterSvg + '</div>'
    + '</div>\n'
    + '<p class="section-title">每日记录</p>'
    + '<div class="days">' + (dayCardsHtml || '<p class="empty">暂无记录</p>') + '</div>\n'
    + '</div>\n</body>\n</html>';
}

const FORMAT_CONFIGS = [
  {
    key: 'html' as ExportFormat,
    icon: LayoutDashboard,
    title: 'HTML 可视化看板',
    desc: '精美网页格式，含趋势图表与每日详情，可在浏览器中直接查看',
    color: '#6366f1',
    ext: '.html',
    mime: 'text/html;charset=utf-8',
    reimportable: false,
  },
  {
    key: 'text' as ExportFormat,
    icon: FileText,
    title: '文字摘要版',
    desc: '纯文本格式，清晰易读。可在「数据导入」中粘贴恢复',
    color: '#10b981',
    ext: '.txt',
    mime: 'text/plain;charset=utf-8',
    reimportable: true,
  },
  {
    key: 'csv' as ExportFormat,
    icon: Sheet,
    title: '表格数据 CSV',
    desc: '结构化数据，可用 Excel / Numbers 打开分析',
    color: '#f59e0b',
    ext: '.csv',
    mime: 'text/csv;charset=utf-8',
    reimportable: false,
  },
  {
    key: 'backup' as ExportFormat,
    icon: Shield,
    title: '口令加密备份',
    desc: '加密打包并上传云端，生成6位口令。下次只需输入口令即可恢复',
    color: '#8b5cf6',
    ext: '.backup',
    mime: 'text/plain;charset=utf-8',
    reimportable: true,
  },
];

export default function ExportDataModal({ open, onClose }: ExportDataModalProps) {
  const [statuses, setStatuses] = useState<Partial<Record<ExportFormat, FormatStatus>>>({});
  const [globalEmpty, setGlobalEmpty] = useState(false);
  const [backupPasscode, setBackupPasscode] = useState('');
  const [passcodeCopied, setPasscodeCopied] = useState(false);

  const setStatus = (fmt: ExportFormat, s: FormatStatus) =>
    setStatuses(prev => ({ ...prev, [fmt]: s }));

  const handleExport = async (fmt: ExportFormat) => {
    setGlobalEmpty(false);
    setStatus(fmt, 'loading');
    try {
      const records = await idbGetAllRecords();
      if (records.length === 0) {
        setGlobalEmpty(true);
        setStatus(fmt, 'empty');
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      const cfg = FORMAT_CONFIGS.find(c => c.key === fmt)!;
      let content = '';
      if (fmt === 'html') content = buildHtmlDashboard(records);
      else if (fmt === 'text') content = buildTextExport(records);
      else if (fmt === 'csv') content = buildCsvExport(records);
      else if (fmt === 'backup') {
        const json = JSON.stringify(records, null, 2);
        const passcode = generatePasscode();
        content = encryptData(json, passcode);
        setBackupPasscode(passcode);
        setPasscodeCopied(false);
        // 同时上传到 GitHub，下次只需输入口令即可恢复
        uploadBackup(content, passcode).catch(() => {});
      }
      downloadFile(content, '健康记录_' + today + cfg.ext, cfg.mime);
      setStatus(fmt, 'done');
    } catch {
      setStatus(fmt, 'error');
      setTimeout(() => setStatus(fmt, 'idle'), 3000);
    }
  };

  const handleClose = () => {
    setStatuses({});
    setGlobalEmpty(false);
    setBackupPasscode('');
    setPasscodeCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            导出健康记录
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            选择导出格式，将所有饮食、运动、饮水数据保存到本地
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {globalEmpty && (
            <div className="text-sm text-center text-muted-foreground py-2 rounded-xl bg-muted/50">
              暂无可导出的记录，请先添加一些数据
            </div>
          )}

          {FORMAT_CONFIGS.map(cfg => {
            const Icon = cfg.icon;
            const st = statuses[cfg.key] ?? 'idle';
            const isLoading = st === 'loading';
            const isDone = st === 'done';
            const isError = st === 'error';

            return (
              <div
                key={cfg.key}
                className="flex items-center gap-3 p-3.5 rounded-2xl border transition-all"
                style={{
                  borderColor: isDone ? cfg.color + '40' : 'var(--ck-border-medium)',
                  background: isDone ? cfg.color + '08' : 'var(--ck-surface-subtle)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cfg.color + '15' }}
                >
                  <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{cfg.title}</p>
                    {cfg.reimportable && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                        可重新导入
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{cfg.desc}</p>
                  {isError && (
                    <p className="text-[11px] text-destructive mt-0.5">导出失败，请重试</p>
                  )}
                </div>
                <button
                  onClick={() => handleExport(cfg.key)}
                  disabled={isLoading}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  style={{
                    backgroundColor: isDone ? cfg.color + '15' : cfg.color,
                    color: isDone ? cfg.color : '#fff',
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isDone ? (
                    <>已下载</>
                  ) : (
                    <><Download className="w-3.5 h-3.5" />下载</>
                  )}
                </button>
              </div>
            );
          })}

          {backupPasscode && (
            <div
              className="rounded-2xl p-4 text-center border-2"
              style={{
                borderColor: '#8b5cf6',
                background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
              }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Key className="w-4 h-4" style={{ color: '#7c3aed' }} />
                <p className="text-xs font-semibold" style={{ color: '#7c3aed' }}>请妥善保管此口令</p>
              </div>
              <p
                className="text-3xl font-black tracking-[0.3em] mb-2 select-all"
                style={{ color: '#6d28d9', fontFamily: 'monospace' }}
              >
                {backupPasscode}
              </p>
              <p className="text-[11px] text-muted-foreground mb-3">
                备份已上传云端。下次在「口令恢复」中输入此口令即可恢复全部数据
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(backupPasscode);
                  setPasscodeCopied(true);
                  setTimeout(() => setPasscodeCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: passcodeCopied ? '#dcfce7' : '#7c3aed',
                  color: passcodeCopied ? '#16a34a' : '#fff',
                }}
              >
                {passcodeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {passcodeCopied ? '已复制' : '复制口令'}
              </button>
            </div>
          )}

          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl text-sm text-muted-foreground border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer mt-1"
          >
            关闭
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
