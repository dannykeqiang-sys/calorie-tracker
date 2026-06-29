import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/shadcn/dialog';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Label } from '@/components/shadcn/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select';
import { Badge } from '@/components/shadcn/badge';
import { calcBMI, calcBMR, calcTDEE, calcTargetCalories } from '../../utils/calculations';
import { saveProfile } from '../../utils/storage';
import { syncProfileToCloud } from '../../utils/apiDB';
import type { UserProfile, Gender, GoalType, ActivityLevel } from '../../types';
import { Activity, Target, Zap } from 'lucide-react';

interface UserProfilePanelProps {
  open: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
}

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '久坐（几乎不运动）',
  light: '轻度（每周1-3天）',
  moderate: '中度（每周3-5天）',
  active: '活跃（每周6-7天）',
  very_active: '高强度（每天运动）',
};

const GOAL_LABELS: Record<GoalType, string> = {
  lose: '减脂',
  maintain: '维持体重',
  gain: '增肌',
};

export default function UserProfilePanel({ open, profile, onClose, onSave }: UserProfilePanelProps) {
  const [form, setForm] = useState<UserProfile>({
    name: profile?.name ?? '',
    height: profile?.height ?? 170,
    weight: profile?.weight ?? 65,
    age: profile?.age ?? 25,
    gender: profile?.gender ?? 'male',
    goal: profile?.goal ?? 'maintain',
    activityLevel: profile?.activityLevel ?? 'moderate',
  });

  // 当 profile prop 变化时同步更新表单（例如从云端同步后）
  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        height: profile.height,
        weight: profile.weight,
        age: profile.age,
        gender: profile.gender,
        goal: profile.goal,
        activityLevel: profile.activityLevel,
      });
    }
  }, [profile]);

  const bmi = calcBMI(form.weight, form.height);
  const bmr = calcBMR(form);
  const tdee = calcTDEE(form);
  const target = calcTargetCalories(form);

  const handleSave = () => {
    saveProfile(form);
    onSave(form);
    syncProfileToCloud(form).catch(() => {});
    onClose();
  };

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">个人信息设置</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">填写信息越准确，建议越专业</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div className="space-y-1">
            <Label className="text-foreground">昵称</Label>
            <Input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="你的名字"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-foreground">性别</Label>
            <Select value={form.gender} onValueChange={v => update('gender', v as Gender)}>
              <SelectTrigger className="bg-muted border-border text-foreground cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="male" className="text-foreground cursor-pointer">男</SelectItem>
                <SelectItem value="female" className="text-foreground cursor-pointer">女</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-foreground">年龄（岁）</Label>
            <Input
              type="number"
              value={form.age}
              onChange={e => update('age', Number(e.target.value))}
              min={10}
              max={100}
              className="bg-muted border-border text-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-foreground">身高（cm）</Label>
            <Input
              type="number"
              value={form.height}
              onChange={e => update('height', Number(e.target.value))}
              min={100}
              max={250}
              className="bg-muted border-border text-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-foreground">体重（kg）</Label>
            <Input
              type="number"
              value={form.weight}
              onChange={e => update('weight', Number(e.target.value))}
              min={30}
              max={300}
              step={0.1}
              className="bg-muted border-border text-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-foreground">健康目标</Label>
            <Select value={form.goal} onValueChange={v => update('goal', v as GoalType)}>
              <SelectTrigger className="bg-muted border-border text-foreground cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(Object.keys(GOAL_LABELS) as GoalType[]).map(g => (
                  <SelectItem key={g} value={g} className="text-foreground cursor-pointer">
                    {GOAL_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label className="text-foreground">活动水平</Label>
            <Select value={form.activityLevel} onValueChange={v => update('activityLevel', v as ActivityLevel)}>
              <SelectTrigger className="bg-muted border-border text-foreground cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(a => (
                  <SelectItem key={a} value={a} className="text-foreground cursor-pointer">
                    {ACTIVITY_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
          <p className="text-sm font-semibold text-foreground mb-3">实时计算结果</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Activity className="w-3 h-3 text-accent" />
                <span className="text-xs text-muted-foreground">BMI</span>
              </div>
              <p className="text-lg font-bold" style={{ color: bmi.color }}>{bmi.value}</p>
              <Badge variant="secondary" className="text-xs px-1 py-0" style={{ color: bmi.color }}>
                {bmi.category}
              </Badge>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-xs text-muted-foreground">静息代谢</span>
              </div>
              <p className="text-lg font-bold text-primary">{bmr}</p>
              <span className="text-xs text-muted-foreground">kcal/天</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Activity className="w-3 h-3 text-secondary" />
                <span className="text-xs text-muted-foreground">总消耗TDEE</span>
              </div>
              <p className="text-lg font-bold text-secondary">{tdee}</p>
              <span className="text-xs text-muted-foreground">kcal/天</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="w-3 h-3 text-yellow-400" />
                <span className="text-xs text-muted-foreground">目标摄入</span>
              </div>
              <p className="text-lg font-bold text-yellow-400">{target}</p>
              <span className="text-xs text-muted-foreground">kcal/天</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">{bmi.description}</p>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 border-border cursor-pointer">
            取消
          </Button>
          <Button onClick={handleSave} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer">
            保存信息
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
