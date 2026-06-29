import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/shadcn/dialog';
import { Loader2, Upload, CheckCircle, ChevronLeft, CalendarDays, Plus, RefreshCw, Key, FileText } from 'lucide-react';
import { parseMultiDateMeals } from '../../utils/deepseek';
import type { MultiDateEntry } from '../../utils/deepseek';
import { decryptData } from '../../utils/crypto';
import { parseTextExport } from '../../utils/parseTextExport';
import { fetchBackup } from '../../utils/apiDB';
import { idbGetRecord } from '../../utils/indexedDB';
import { loadRecordByDate } from '../../utils/storage';
import type { DailyRecord } from '../../types';

export type ImportMode = 'append' | 'overwrite';

interface BatchImportModalProps {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  onImport: (entries: MultiDateEntry[], mode: ImportMode) => Promise<void>;
  onImportBackup: (records: DailyRecord[]) => Promise<void>;
}

type Phase = 'input' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';
type ImportType = 'ai' | 'passcode';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export default function BatchImportModal({ open, onClose, apiKey, onImport, onImportBackup }: BatchImportModalProps) {
  const [importType, setImportType] = useState<ImportType>('ai');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState('');

  // AI 识别
  const [aiText, setAiText] = useState('');
  const [entries, setEntries] = useState<MultiDateEntry[]>([]);
  const [summary, setSummary] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [existingDates, setExistingDates] = useState<Set<string>>(new Set());

  // 口令恢复
  const [passcodeInput, setPasscodeInput] = useState('');
  const [backupRecords, setBackupRecords] = useState<DailyRecord[]>([]);

  const resetAll = () => {
    setImportType('ai');
    setPhase('input');
    setError('');
    setAiText('');
    setEntries([]);
    setSummary('');
    setImportMode('append');
    setExistingDates(new Set());
    setPasscodeInput('');
    setBackupRecords([]);
  };

  const handleClose = () => { resetAll(); onClose(); };

  // ===== AI 识别 =====
  const handleAIParse = async () => {
    const content = aiText.trim();
    if (!content) return;
    setPhase('parsing');
    setError('');

    // 先尝试 txt 直接解析
    const txtRecords = parseTextExport(content);
    if (txtRecords && txtRecords.length > 0) {
      setBackupRecords(txtRecords);
      setPhase('preview');
      return;
    }

    // 走 AI 解析
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await parseMultiDateMeals(apiKey, content, today);
      if (!result.has_data || !result.dates || result.dates.length === 0) {
        setError('未识别到有效数据，请重新描述你的饮食情况');
        setPhase('error');
        return;
      }
      const parsedEntries = result.dates;
      const existing = new Set<string>();
      for (const date of parsedEntries.map(e => e.date)) {
        try {
          const idbRec = await idbGetRecord(date);
          if (idbRec) {
            const has = Object.values(idbRec.meals).some(m => m.length > 0) || (idbRec.exercises?.length ?? 0) > 0;
            if (has) { existing.add(date); continue; }
          }
        } catch {}
        const lsRec = loadRecordByDate(date);
        if (lsRec) {
          const has = Object.values(lsRec.meals).some(m => m.length > 0) || (lsRec.exercises?.length ?? 0) > 0;
          if (has) existing.add(date);
        }
      }
      setEntries(parsedEntries);
      setExistingDates(existing);
      setSummary(result.analysis_summary);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失败，请重试');
      setPhase('error');
    }
  };

  // ===== 口令恢复 =====
  const handlePasscodeRestore = async () => {
    const code = passcodeInput.trim();
    if (!code) return;
    setPhase('parsing');
    setError('');

    try {
      // 从 GitHub 拉取加密备份
      const encrypted = await fetchBackup(code);
      if (!encrypted) {
        setError('未找到该口令对应的备份数据，请检查口令是否正确');
        setPhase('error');
        return;
      }

      // 解密
      const json = decryptData(encrypted.trim(), code);
      if (!json) {
        setError('口令错误，无法解密备份数据');
        setPhase('error');
        return;
      }

      const records: DailyRecord[] = JSON.parse(json);
      if (!Array.isArray(records) || records.length === 0) {
        setError('备份数据无效，未找到记录');
        setPhase('error');
        return;
      }

      setBackupRecords(records);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '恢复失败，请重试');
      setPhase('error');
    }
  };

  const handleImport = async () => {
    setPhase('importing');
    try {
      if (importType === 'ai' && entries.length > 0) {
        await onImport(entries, importMode);
      } else {
        await onImportBackup(backupRecords);
      }
      setPhase('done');
      setTimeout(handleClose, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败，请重试');
      setPhase('error');
    }
  };

  const hasConflict = entries.some(e => existingDates.has(e.date));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            {importType === 'ai' ? 'AI 智能识别导入' : '口令恢复'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {importType === 'ai'
              ? '粘贴自然语言描述或 .txt 导出文件，自动识别并回填数据'
              : '输入导出时生成的6位口令，自动从云端恢复全部数据'}
          </DialogDescription>
        </DialogHeader>

        {/* Tab 切换 */}
        <div className="rounded-xl bg-muted/40 p-1 flex gap-1">
          <button
            onClick={() => { setImportType('ai'); setPhase('input'); setError(''); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={importType === 'ai'
              ? { background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)', color: 'white' }
              : { color: 'var(--muted-foreground)' }}
          >
            <FileText className="w-3.5 h-3.5" />
            AI 识别
          </button>
          <button
            onClick={() => { setImportType('passcode'); setPhase('input'); setError(''); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={importType === 'passcode'
              ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', color: 'white' }
              : { color: 'var(--muted-foreground)' }}
          >
            <Key className="w-3.5 h-3.5" />
            口令恢复
          </button>
        </div>

        <div className="space-y-4 mt-2">
          {/* ===== AI 识别 ===== */}
          {importType === 'ai' && (phase === 'input' || phase === 'parsing' || phase === 'error') && (
            <>
              <textarea
                value={aiText}
                onChange={e => setAiText(e.target.value)}
                placeholder="用自然语言描述饮食运动，或粘贴 .txt 导出文件内容"
                disabled={phase === 'parsing'}
                className="w-full h-36 p-3 text-sm rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 resize-none outline-none focus:border-primary/50 transition-colors leading-relaxed disabled:opacity-60"
              />
              {phase === 'error' && (
                <p className="text-sm text-destructive bg-destructive/5 rounded-xl px-3 py-2.5 leading-relaxed">{error}</p>
              )}
              <div className="flex gap-3">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">取消</button>
                <button
                  onClick={handleAIParse}
                  disabled={!aiText.trim() || phase === 'parsing'}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)' }}
                >
                  {phase === 'parsing' ? <><Loader2 className="w-4 h-4 animate-spin" />解析中...</> : '智能识别'}
                </button>
              </div>
            </>
          )}

          {/* ===== 口令恢复 ===== */}
          {importType === 'passcode' && (phase === 'input' || phase === 'parsing' || phase === 'error') && (
            <>
              <div className="text-center py-3">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
                >
                  <Key className="w-8 h-8 text-white" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">输入恢复口令</p>
                <p className="text-xs text-muted-foreground">导出时生成的6位口令，系统自动从云端拉取数据</p>
              </div>

              <input
                type="text"
                value={passcodeInput}
                onChange={e => { setPasscodeInput(e.target.value); setError(''); }}
                placeholder="输入6位口令"
                disabled={phase === 'parsing'}
                maxLength={6}
                className="w-full p-4 text-lg rounded-xl border-2 border-purple-300 bg-purple-50/50 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-purple-500 transition-colors tracking-[0.4em] text-center font-mono font-bold disabled:opacity-60"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handlePasscodeRestore(); }}
              />

              {phase === 'error' && (
                <p className="text-sm text-destructive bg-destructive/5 rounded-xl px-3 py-2.5 leading-relaxed">{error}</p>
              )}

              <div className="flex gap-3">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">取消</button>
                <button
                  onClick={handlePasscodeRestore}
                  disabled={passcodeInput.trim().length < 6 || phase === 'parsing'}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
                >
                  {phase === 'parsing' ? <><Loader2 className="w-4 h-4 animate-spin" />恢复中...</> : '恢复数据'}
                </button>
              </div>
            </>
          )}

          {/* ===== 预览（AI 结果） ===== */}
          {phase === 'preview' && importType === 'ai' && entries.length > 0 && (
            <>
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
                <p className="text-xs text-primary/80 leading-relaxed">{summary}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-1 flex gap-1">
                <button onClick={() => setImportMode('append')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  style={importMode === 'append' ? { background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)', color: 'white' } : { color: 'var(--muted-foreground)' }}>
                  <Plus className="w-3 h-3" />追加到已有数据
                </button>
                <button onClick={() => setImportMode('overwrite')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  style={importMode === 'overwrite' ? { background: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)', color: 'white' } : { color: 'var(--muted-foreground)' }}>
                  <RefreshCw className="w-3 h-3" />覆盖已有数据
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {entries.map(entry => {
                  const d = new Date(entry.date + 'T00:00:00');
                  const totalItems = MEAL_ORDER.reduce((s, mt) => s + (entry.meals[mt]?.length ?? 0), 0);
                  const totalKcal = MEAL_ORDER.reduce((s, mt) => s + (entry.meals[mt] ?? []).reduce((ms: number, f) => ms + f.calories, 0), 0);
                  const exCount = entry.exercises?.length ?? 0;
                  const waterCount = entry.water_logs?.length ?? 0;
                  const isExisting = existingDates.has(entry.date);
                  return (
                    <div key={entry.date} className="flex items-start gap-3 p-3 rounded-2xl border bg-card/60 dark:bg-card"
                      style={{ borderColor: isExisting ? 'rgba(249,115,22,0.2)' : 'var(--border)' }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)' }}>
                        <CalendarDays className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{entry.date}<span className="text-muted-foreground font-normal text-xs ml-1.5">{WEEKDAYS[d.getDay()]}</span></p>
                          {isExisting && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={importMode === 'overwrite' ? { background: 'rgba(239,68,68,0.1)', color: '#EF4444' } : { background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>{importMode === 'overwrite' ? '将覆盖' : '将追加'}</span>}
                          {!isExisting && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">新建</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {totalItems > 0 && <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">饮食 {totalItems} 项 · {totalKcal} kcal</span>}
                          {exCount > 0 && <span className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">运动 {exCount} 项</span>}
                          {waterCount > 0 && <span className="text-[11px] text-sky-600 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">饮水 {waterCount} 项</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setPhase('input'); setEntries([]); setExistingDates(new Set()); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0"><ChevronLeft className="w-4 h-4" />修改</button>
                <button onClick={handleImport} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer active:scale-95"
                  style={importMode === 'overwrite' ? { background: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)' } : { background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)' }}>
                  {importMode === 'overwrite' ? '覆盖导入' : '追加导入'} {entries.length} 天数据
                </button>
              </div>
            </>
          )}

          {/* ===== 预览（口令恢复 / AI-txt） ===== */}
          {phase === 'preview' && (importType === 'passcode' || (importType === 'ai' && backupRecords.length > 0)) && (
            <>
              <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #c4b5fd' }}>
                <p className="text-sm font-bold" style={{ color: '#7c3aed' }}>{backupRecords.length} 天记录</p>
                <p className="text-[11px] text-muted-foreground mt-1">确认后将恢复到你的账户中</p>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {backupRecords.map(r => {
                  const d = new Date(r.date + 'T00:00:00');
                  const totalItems = MEAL_ORDER.reduce((s, mt) => s + (r.meals[mt]?.length ?? 0), 0);
                  const totalKcal = MEAL_ORDER.reduce((s, mt) => s + (r.meals[mt] ?? []).reduce((ms, f) => ms + f.calories, 0), 0);
                  const exCount = r.exercises?.length ?? 0;
                  const waterCount = r.water?.length ?? 0;
                  return (
                    <div key={r.date} className="flex items-start gap-3 p-3 rounded-2xl border bg-card/60 dark:bg-card" style={{ borderColor: 'rgba(139,92,246,0.15)' }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
                        <CalendarDays className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{r.date}<span className="text-muted-foreground font-normal text-xs ml-1.5">{WEEKDAYS[d.getDay()]}</span></p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {totalItems > 0 && <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">饮食 {totalItems} 项 · {totalKcal} kcal</span>}
                          {exCount > 0 && <span className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">运动 {exCount} 项</span>}
                          {waterCount > 0 && <span className="text-[11px] text-sky-600 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">饮水 {waterCount} 项</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setPhase('input'); setBackupRecords([]); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0"><ChevronLeft className="w-4 h-4" />返回</button>
                <button onClick={handleImport} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
                  确认导入 {backupRecords.length} 天数据
                </button>
              </div>
            </>
          )}

          {phase === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">正在导入数据...</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)' }}>
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <p className="text-sm font-semibold text-foreground">导入成功！</p>
              <p className="text-xs text-muted-foreground">数据已回填到对应日期</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
