import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/shadcn/dialog';
import { Loader2, Upload, CheckCircle, ChevronLeft, CalendarDays, Plus, RefreshCw, Key, FileText, Database } from 'lucide-react';
import { parseMultiDateMeals } from '../../utils/deepseek';
import type { MultiDateEntry } from '../../utils/deepseek';
import { decryptData } from '../../utils/crypto';
import { parseTextExport } from '../../utils/parseTextExport';
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
type ImportType = 'ai' | 'file';
type DetectedFormat = 'json' | 'txt' | 'encrypted' | null;

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/** 检测粘贴内容的格式 */
function detectFormat(content: string): DetectedFormat {
  const trimmed = content.trim();
  if (!trimmed) return null;
  // 1. 是否看起来像 Base64 密文（不含中文，长度较长，无换行或单行）
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.replace(/\s/g, '').length > 40) {
    // 大概率是加密备份
    return 'encrypted';
  }
  // 2. 是否是 JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.date) return 'json';
  } catch {}
  // 3. 是否包含 txt 导出特征（日期行 + 分隔线）
  if (/\[\s*\d{4}-\d{2}-\d{2}\s/.test(trimmed) && /[─━]+/.test(trimmed)) return 'txt';
  // 4. 无法确定，默认尝试
  return null;
}

export default function BatchImportModal({ open, onClose, apiKey, onImport, onImportBackup }: BatchImportModalProps) {
  const [importType, setImportType] = useState<ImportType>('ai');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState('');

  // AI 识别状态
  const [aiText, setAiText] = useState('');
  const [entries, setEntries] = useState<MultiDateEntry[]>([]);
  const [summary, setSummary] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [existingDates, setExistingDates] = useState<Set<string>>(new Set());

  // 数据导入状态
  const [fileContent, setFileContent] = useState('');
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat>(null);
  const [needPasscode, setNeedPasscode] = useState(false);
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
    setFileContent('');
    setDetectedFormat(null);
    setNeedPasscode(false);
    setPasscodeInput('');
    setBackupRecords([]);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // 数据导入：内容变化时自动检测格式
  const onFileContentChange = useCallback((val: string) => {
    setFileContent(val);
    setError('');
    if (phase !== 'input') return;
    const fmt = detectFormat(val);
    setDetectedFormat(fmt);
    setNeedPasscode(fmt === 'encrypted');
  }, [phase]);

  const checkExistingDates = async (dates: string[]): Promise<Set<string>> => {
    const existing = new Set<string>();
    for (const date of dates) {
      try {
        const idbRec = await idbGetRecord(date);
        if (idbRec) {
          const hasData = Object.values(idbRec.meals).some(m => m.length > 0) ||
            (idbRec.exercises?.length ?? 0) > 0;
          if (hasData) { existing.add(date); continue; }
        }
      } catch {}
      const lsRec = loadRecordByDate(date);
      if (lsRec) {
        const hasData = Object.values(lsRec.meals).some(m => m.length > 0) ||
          (lsRec.exercises?.length ?? 0) > 0;
        if (hasData) existing.add(date);
      }
    }
    return existing;
  };

  // ===== AI 识别 =====
  const handleAIParse = async () => {
    if (!aiText.trim()) return;
    setPhase('parsing');
    setError('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await parseMultiDateMeals(apiKey, aiText.trim(), today);
      if (!result.has_data || !result.dates || result.dates.length === 0) {
        setError('未识别到有效数据，请重新描述你的饮食情况');
        setPhase('error');
        return;
      }
      const parsedEntries = result.dates;
      const existing = await checkExistingDates(parsedEntries.map(e => e.date));
      setEntries(parsedEntries);
      setExistingDates(existing);
      setSummary(result.analysis_summary);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失败，请重试');
      setPhase('error');
    }
  };

  const handleAIImport = async () => {
    setPhase('importing');
    try {
      await onImport(entries, importMode);
      setPhase('done');
      setTimeout(handleClose, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败，请重试');
      setPhase('error');
    }
  };

  // ===== 数据导入 =====
  const handleFileDecrypt = () => {
    const content = fileContent.trim();
    if (!content) return;
    setPhase('parsing');
    setError('');

    try {
      // 1. JSON
      try {
        const directRecords: DailyRecord[] = JSON.parse(content);
        if (Array.isArray(directRecords) && directRecords.length > 0 && directRecords[0]?.date) {
          setBackupRecords(directRecords);
          setPhase('preview');
          return;
        }
      } catch {}

      // 2. TXT 文字摘要
      const txtRecords = parseTextExport(content);
      if (txtRecords && txtRecords.length > 0) {
        setBackupRecords(txtRecords);
        setPhase('preview');
        return;
      }

      // 3. 加密备份（需要口令）
      if (!passcodeInput.trim()) {
        setError('检测到加密备份格式，请输入恢复口令');
        setNeedPasscode(true);
        setPhase('error');
        return;
      }

      const json = decryptData(content, passcodeInput.trim());
      if (!json) {
        setError('口令错误，请检查后重试');
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
      setError(e instanceof Error ? e.message : '解析失败，请检查数据格式');
      setPhase('error');
    }
  };

  const handleFileImport = async () => {
    setPhase('importing');
    try {
      await onImportBackup(backupRecords);
      setPhase('done');
      setTimeout(handleClose, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败，请重试');
      setPhase('error');
    }
  };

  // 数据导入按钮是否可用
  const fileCanSubmit = fileContent.trim().length > 0 && (!needPasscode || passcodeInput.trim().length > 0);

  const AI_PLACEHOLDER = '例如：\n昨天早餐吃了两个鸡蛋和一杯牛奶，午餐吃了红烧肉饭，下午跑步40分钟消耗300kcal。\n今天早上喝了拿铁，中午吃了沙拉和鸡胸肉200kcal，晚上吃了寿司。';

  const hasConflict = entries.some(e => existingDates.has(e.date));

  // ===== 日期卡片组件（AI 和 文件导入 共用） =====
  const DateCardRow = ({ date, totalMeals, totalKcal, exCount, waterCount, isExisting }: {
    date: string; totalMeals: number; totalKcal: number; exCount: number; waterCount: number; isExisting?: boolean;
  }) => (
    <div
      className="flex items-start gap-3 p-3 rounded-2xl border bg-white/60"
      style={{ borderColor: isExisting ? 'rgba(249,115,22,0.2)' : 'rgba(0,0,0,0.06)' }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: isExisting != null ? 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)' : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
      >
        <CalendarDays className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">
            {date}
            <span className="text-muted-foreground font-normal text-xs ml-1.5">
              {WEEKDAYS[new Date(date + 'T00:00:00').getDay()]}
            </span>
          </p>
          {isExisting != null && (
            isExisting ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={importMode === 'overwrite' ? { background: 'rgba(239,68,68,0.1)', color: '#EF4444' } : { background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>
                {importMode === 'overwrite' ? '将覆盖' : '将追加'}
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">新建</span>
            )
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {totalMeals > 0 && (
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              饮食 {totalMeals} 项 · {totalKcal} kcal
            </span>
          )}
          {exCount > 0 && (
            <span className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
              运动 {exCount} 项
            </span>
          )}
          {waterCount > 0 && (
            <span className="text-[11px] text-sky-600 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
              饮水 {waterCount} 项
            </span>
          )}
          {totalMeals === 0 && exCount === 0 && waterCount === 0 && (
            <span className="text-[11px] text-muted-foreground">无有效数据</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            {importType === 'ai' ? 'AI 智能识别导入' : '从文件导入数据'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {importType === 'ai'
              ? '用自然语言描述多天的饮食和运动，AI 自动识别日期并回填'
              : '粘贴导出的备份文件内容，自动识别格式并恢复数据'}
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
            onClick={() => { setImportType('file'); setPhase('input'); setError(''); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={importType === 'file'
              ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', color: 'white' }
              : { color: 'var(--muted-foreground)' }}
          >
            <Database className="w-3.5 h-3.5" />
            数据导入
          </button>
        </div>

        <div className="space-y-4 mt-2">
          {/* ===== AI 识别：输入 ===== */}
          {importType === 'ai' && (phase === 'input' || phase === 'parsing' || phase === 'error') && (
            <>
              <textarea
                value={aiText}
                onChange={e => setAiText(e.target.value)}
                placeholder={AI_PLACEHOLDER}
                disabled={phase === 'parsing'}
                className="w-full h-36 p-3 text-sm rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 resize-none outline-none focus:border-primary/50 transition-colors leading-relaxed disabled:opacity-60"
              />
              {phase === 'error' && (
                <p className="text-sm text-destructive bg-destructive/5 rounded-xl px-3 py-2.5 leading-relaxed">{error}</p>
              )}
              <div className="flex gap-3">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                  取消
                </button>
                <button
                  onClick={handleAIParse}
                  disabled={!aiText.trim() || phase === 'parsing'}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)' }}
                >
                  {phase === 'parsing' ? <><Loader2 className="w-4 h-4 animate-spin" />AI 解析中...</> : 'AI 智能识别'}
                </button>
              </div>
            </>
          )}

          {/* ===== 数据导入：输入 ===== */}
          {importType === 'file' && (phase === 'input' || phase === 'parsing' || phase === 'error') && (
            <>
              {/* 格式检测提示 */}
              {detectedFormat && !error && (
                <div className="rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-semibold"
                  style={{ background: detectedFormat === 'encrypted' ? '#fef3c7' : '#dcfce7', border: `1px solid ${detectedFormat === 'encrypted' ? '#fcd34d' : '#86efac'}` }}>
                  <span>{detectedFormat === 'json' ? '📋' : detectedFormat === 'txt' ? '📝' : '🔐'}</span>
                  <span style={{ color: detectedFormat === 'encrypted' ? '#92400e' : '#166534' }}>
                    {detectedFormat === 'json' ? '检测到 JSON 格式，无需口令直接导入'
                      : detectedFormat === 'txt' ? '检测到文字摘要(.txt)格式，无需口令直接导入'
                      : '检测到加密备份格式，需要输入口令解密'}
                  </span>
                </div>
              )}

              {/* 口令输入（仅加密格式时显示） */}
              {needPasscode && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Key className="w-3 h-3" />恢复口令
                  </label>
                  <input
                    type="text"
                    value={passcodeInput}
                    onChange={e => setPasscodeInput(e.target.value)}
                    placeholder="输入6位口令"
                    disabled={phase === 'parsing'}
                    maxLength={6}
                    className="w-full p-3 text-sm rounded-xl border-2 border-amber-300 bg-amber-50/50 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-amber-400 transition-colors tracking-[0.3em] text-center font-mono text-lg disabled:opacity-60"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  粘贴文件内容
                </label>
                <textarea
                  value={fileContent}
                  onChange={e => onFileContentChange(e.target.value)}
                  placeholder="粘贴 .backup / .txt / JSON 文件内容"
                  disabled={phase === 'parsing'}
                  className="w-full h-32 p-3 text-xs rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 resize-none outline-none focus:border-purple-500/50 transition-colors font-mono leading-relaxed disabled:opacity-60"
                />
              </div>

              {phase === 'error' && (
                <p className="text-sm text-destructive bg-destructive/5 rounded-xl px-3 py-2.5 leading-relaxed">{error}</p>
              )}

              <div className="flex gap-3">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                  取消
                </button>
                <button
                  onClick={handleFileDecrypt}
                  disabled={!fileCanSubmit || phase === 'parsing'}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
                >
                  {phase === 'parsing' ? <><Loader2 className="w-4 h-4 animate-spin" />解析中...</> : '解析并预览'}
                </button>
              </div>
            </>
          )}

          {/* ===== AI 识别：预览 ===== */}
          {phase === 'preview' && importType === 'ai' && (
            <>
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
                <p className="text-xs text-primary/80 leading-relaxed">{summary}</p>
              </div>

              {hasConflict && (
                <div className="rounded-xl border border-border bg-muted/20 p-1 flex gap-1">
                  <button
                    onClick={() => setImportMode('append')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    style={importMode === 'append' ? { background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)', color: 'white' } : { color: 'var(--muted-foreground)' }}
                  >
                    <Plus className="w-3 h-3" />追加到已有数据
                  </button>
                  <button
                    onClick={() => setImportMode('overwrite')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    style={importMode === 'overwrite' ? { background: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)', color: 'white' } : { color: 'var(--muted-foreground)' }}
                  >
                    <RefreshCw className="w-3 h-3" />覆盖已有数据
                  </button>
                </div>
              )}

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {entries.map(entry => {
                  const totalMeals = MEAL_ORDER.reduce((s, mt) => s + (entry.meals[mt]?.length ?? 0), 0);
                  const totalKcal = MEAL_ORDER.reduce((s, mt) => s + (entry.meals[mt] ?? []).reduce((ms: number, f) => ms + f.calories, 0), 0);
                  const exCount = entry.exercises?.length ?? 0;
                  const waterCount = entry.water_logs?.length ?? 0;
                  return (
                    <DateCardRow key={entry.date} date={entry.date}
                      totalMeals={totalMeals} totalKcal={totalKcal} exCount={exCount} waterCount={waterCount}
                      isExisting={existingDates.has(entry.date)} />
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setPhase('input'); setEntries([]); setExistingDates(new Set()); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0">
                  <ChevronLeft className="w-4 h-4" />修改
                </button>
                <button onClick={handleAIImport}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer active:scale-95"
                  style={importMode === 'overwrite' && hasConflict ? { background: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)' } : { background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)' }}>
                  {importMode === 'overwrite' && hasConflict ? '覆盖导入' : '确认导入'} {entries.length} 天数据
                </button>
              </div>
            </>
          )}

          {/* ===== 数据导入：预览 ===== */}
          {phase === 'preview' && importType === 'file' && (
            <>
              <div className="rounded-xl p-3 text-center"
                style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #c4b5fd' }}>
                <p className="text-sm font-bold" style={{ color: '#7c3aed' }}>
                  识别成功 · {backupRecords.length} 天记录
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">确认后将恢复到你的账户中</p>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {backupRecords.map(r => {
                  const totalKcal = MEAL_ORDER.reduce((s, mt) => s + (r.meals[mt] ?? []).reduce((ms, f) => ms + f.calories, 0), 0);
                  const totalItems = MEAL_ORDER.reduce((s, mt) => s + (r.meals[mt]?.length ?? 0), 0);
                  const exCount = r.exercises?.length ?? 0;
                  const waterCount = r.water?.length ?? 0;
                  return (
                    <DateCardRow key={r.date} date={r.date}
                      totalMeals={totalItems} totalKcal={totalKcal} exCount={exCount} waterCount={waterCount} />
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setPhase('input'); setBackupRecords([]); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0">
                  <ChevronLeft className="w-4 h-4" />返回
                </button>
                <button onClick={handleFileImport}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer active:scale-95"
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
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)' }}>
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
