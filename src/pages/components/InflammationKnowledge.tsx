import { useState } from 'react';
import { ChevronDown, AlertCircle, Flame, Leaf, Activity, Moon } from 'lucide-react';

interface Topic {
  id: string;
  icon: typeof AlertCircle;
  color: string;
  title: string;
  brief: string;
  content: React.ReactNode;
}

const topics: Topic[] = [
  {
    id: 'what',
    icon: AlertCircle,
    color: '#8B5CF6',
    title: '什么是慢性炎症',
    brief: '急性炎症是保护，慢性炎症是破坏',
    content: (
      <div className="space-y-3">
        <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.07)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#7C3AED' }}>急性炎症 vs 慢性炎症</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg p-2" style={{ background: 'rgba(34,197,94,0.09)' }}>
              <p className="text-[11px] font-bold mb-1" style={{ color: '#15803D' }}>急性炎症（有益）</p>
              <p className="text-[10px] leading-relaxed" style={{ color: '#6B7280' }}>伤口愈合、抵抗感染，持续数小时到数天，是身体的自我保护机制</p>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.09)' }}>
              <p className="text-[11px] font-bold mb-1" style={{ color: '#B91C1C' }}>慢性炎症（有害）</p>
              <p className="text-[10px] leading-relaxed" style={{ color: '#6B7280' }}>持续数月到数年，低度炎症悄悄侵蚀全身，是多种慢性病的根源</p>
            </div>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold mb-2" style={{ color: '#374151' }}>与慢性炎症相关的疾病</p>
          <div className="flex flex-wrap gap-1.5">
            {['心血管疾病', '2型糖尿病', '肥胖症', '阿尔茨海默症', '癌症风险↑', '关节炎', '抑郁症', '肠易激综合征'].map(d => (
              <span key={d} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>{d}</span>
            ))}
          </div>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: '#9CA3AF' }}>
          研究表明，超过90%的慢性疾病都与长期低度炎症有关。好消息是：饮食和生活方式可以显著影响体内炎症水平。
        </p>
      </div>
    ),
  },
  {
    id: 'pro',
    icon: Flame,
    color: '#EF4444',
    title: '促炎食物',
    brief: '这些食物会悄悄点燃身体的"火焰"',
    content: (
      <div className="space-y-2.5">
        {[
          {
            name: '精制糖 & 含糖饮料',
            detail: '可乐、果汁、糕点、糖果 — 促进AGEs生成，激活NF-κB炎症通路',
            level: '高度促炎',
            color: '#DC2626',
          },
          {
            name: '反式脂肪',
            detail: '氢化植物油、人造奶油、部分饼干薯片 — 直接升高CRP和IL-6炎症因子',
            level: '高度促炎',
            color: '#DC2626',
          },
          {
            name: '过量Omega-6脂肪酸',
            detail: '大豆油、玉米油、葵花籽油过多 — 与Omega-3比例失衡时促进炎症',
            level: '中度促炎',
            color: '#F97316',
          },
          {
            name: '精制碳水化合物',
            detail: '白面包、白米饭、精制面条 — 高血糖波动触发氧化应激和炎症',
            level: '中度促炎',
            color: '#F97316',
          },
          {
            name: '加工肉类',
            detail: '香肠、热狗、培根 — 亚硝酸盐和饱和脂肪协同促炎',
            level: '中度促炎',
            color: '#F97316',
          },
          {
            name: '过量酒精',
            detail: '长期大量饮酒 — 损伤肠道屏障，引发系统性炎症',
            level: '促炎',
            color: '#EAB308',
          },
        ].map(item => (
          <div key={item.name} className="flex items-start gap-2.5 rounded-xl p-2.5" style={{ background: `${item.color}09` }}>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold mt-0.5 shrink-0 whitespace-nowrap" style={{ background: `${item.color}18`, color: item.color }}>{item.level}</span>
            <div>
              <p className="text-[11px] font-semibold leading-tight mb-0.5" style={{ color: '#374151' }}>{item.name}</p>
              <p className="text-[10px] leading-relaxed" style={{ color: '#9CA3AF' }}>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'anti',
    icon: Leaf,
    color: '#22C55E',
    title: '抗炎食物',
    brief: '让每一口都成为身体的守护力量',
    content: (
      <div className="space-y-2.5">
        {[
          {
            name: '深海鱼',
            sub: '三文鱼、沙丁鱼、鲭鱼',
            detail: '富含EPA和DHA（Omega-3），直接抑制炎症因子合成',
            badge: '明星抗炎',
            color: '#16A34A',
          },
          {
            name: '浆果类',
            sub: '蓝莓、草莓、黑莓、石榴',
            detail: '花青素和白藜芦醇，强效抗氧化，中和自由基',
            badge: '强效',
            color: '#7C3AED',
          },
          {
            name: '深绿色蔬菜',
            sub: '菠菜、羽衣甘蓝、西兰花',
            detail: '维生素K、镁和多种植化素，调节免疫炎症反应',
            badge: '推荐每日',
            color: '#15803D',
          },
          {
            name: '坚果',
            sub: '核桃、杏仁、澳洲坚果',
            detail: '单不饱和脂肪和维生素E，降低CRP水平',
            badge: '每日一小把',
            color: '#92400E',
          },
          {
            name: '橄榄油',
            sub: '特级初榨橄榄油',
            detail: '油酸和多酚类物质，类似低剂量布洛芬的抗炎效果',
            badge: '地中海精华',
            color: '#CA8A04',
          },
          {
            name: '姜黄',
            sub: '搭配黑胡椒效果加倍',
            detail: '姜黄素是已知最强的天然抗炎成分之一',
            badge: '超级香料',
            color: '#EA580C',
          },
          {
            name: '绿茶',
            sub: 'EGCG表没食子儿茶素没食子酸酯',
            detail: '强效多酚，抑制NF-κB通路，降低炎症标志物',
            badge: '每日饮用',
            color: '#16A34A',
          },
        ].map(item => (
          <div key={item.name} className="flex items-start gap-2.5 rounded-xl p-2.5" style={{ background: `${item.color}09` }}>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold mt-0.5 shrink-0 whitespace-nowrap" style={{ background: `${item.color}18`, color: item.color }}>{item.badge}</span>
            <div>
              <p className="text-[11px] font-semibold leading-tight" style={{ color: '#374151' }}>{item.name}</p>
              <p className="text-[10px] mb-0.5" style={{ color: item.color }}>{item.sub}</p>
              <p className="text-[10px] leading-relaxed" style={{ color: '#9CA3AF' }}>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'exercise',
    icon: Activity,
    color: '#0EA5E9',
    title: '运动与炎症',
    brief: '适量运动是最强的天然抗炎药',
    content: (
      <div className="space-y-3">
        <div className="rounded-xl p-3" style={{ background: 'rgba(14,165,233,0.07)' }}>
          <p className="text-[11px] font-semibold mb-2" style={{ color: '#0369A1' }}>运动如何降低炎症？</p>
          <div className="space-y-1.5">
            {[
              '每次运动后，肌肉释放 IL-6（肌肉因子版本），触发抗炎级联反应',
              '规律运动使基础CRP（C反应蛋白）水平下降 30~40%',
              '运动改善胰岛素敏感性，间接减少代谢性炎症',
              '有氧运动促进BDNF分泌，对抗神经炎症',
            ].map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#0EA5E9' }} />
                <p className="text-[10px] leading-relaxed" style={{ color: '#6B7280' }}>{p}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold mb-2" style={{ color: '#374151' }}>推荐运动量</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(34,197,94,0.08)' }}>
              <p className="text-xl font-black" style={{ color: '#16A34A' }}>150</p>
              <p className="text-[10px] font-semibold" style={{ color: '#15803D' }}>分钟/周</p>
              <p className="text-[9px] mt-0.5" style={{ color: '#9CA3AF' }}>中等强度有氧</p>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(14,165,233,0.08)' }}>
              <p className="text-xl font-black" style={{ color: '#0EA5E9' }}>2~3</p>
              <p className="text-[10px] font-semibold" style={{ color: '#0369A1' }}>次/周</p>
              <p className="text-[9px] mt-0.5" style={{ color: '#9CA3AF' }}>力量训练</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-3" style={{ background: 'rgba(251,146,60,0.08)' }}>
          <p className="text-[11px] font-semibold mb-1.5" style={{ color: '#C2410C' }}>过量运动适得其反</p>
          <p className="text-[10px] leading-relaxed" style={{ color: '#9CA3AF' }}>
            极高强度训练（如马拉松赛后）会短暂升高炎症因子。关键是让身体有充分恢复时间——运动与休息的平衡，才是真正的抗炎策略。
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'lifestyle',
    icon: Moon,
    color: '#A855F7',
    title: '生活方式因素',
    brief: '睡眠、压力、饮水，隐形的炎症开关',
    content: (
      <div className="space-y-2.5">
        {[
          {
            icon: '🌙',
            title: '睡眠不足',
            content: '每晚少于6小时睡眠，炎症因子IL-6和TNF-α显著升高。睡眠是身体修复的黄金时间，目标7~9小时。',
            color: '#7C3AED',
          },
          {
            icon: '😰',
            title: '慢性心理压力',
            content: '持续压力导致皮质醇水平长期偏高，皮质醇过多会使免疫系统对炎症信号脱敏，炎症得不到有效控制。冥想、呼吸练习可有效降低压力炎症。',
            color: '#DC2626',
          },
          {
            icon: '💧',
            title: '充足饮水',
            content: '充足水分帮助肾脏排出炎症代谢废物，维持血液流动性。脱水会浓缩炎症介质，加重炎症反应。每日1500~2500ml是基础目标。',
            color: '#0EA5E9',
          },
          {
            icon: '🚭',
            title: '吸烟',
            content: '香烟中的化学物质直接激活炎症通路，吸烟者的CRP水平平均比不吸烟者高60%。戒烟后炎症水平在数月内可显著改善。',
            color: '#6B7280',
          },
          {
            icon: '🦠',
            title: '肠道健康',
            content: '70%的免疫细胞居住在肠道。高纤维饮食、益生菌（酸奶、泡菜、纳豆）能维持肠道菌群多样性，是抵抗系统性炎症的重要防线。',
            color: '#16A34A',
          },
        ].map(item => (
          <div key={item.title} className="rounded-xl p-3" style={{ background: `${item.color}08` }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">{item.icon}</span>
              <p className="text-[11px] font-semibold" style={{ color: item.color }}>{item.title}</p>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: '#6B7280' }}>{item.content}</p>
          </div>
        ))}
      </div>
    ),
  },
];

interface InflammationKnowledgeProps {
  defaultOpen?: string;
}

export default function InflammationKnowledge({ defaultOpen }: InflammationKnowledgeProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpen ?? null);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold px-1" style={{ color: '#9CA3AF' }}>炎症健康知识</p>
      {topics.map(topic => {
        const Icon = topic.icon;
        const isOpen = openId === topic.id;
        return (
          <div
            key={topic.id}
            className="rounded-2xl overflow-hidden transition-all"
            style={{ border: `1.5px solid ${isOpen ? topic.color + '40' : 'var(--ck-border-subtle)'}` }}
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors"
              style={{ background: isOpen ? `${topic.color}08` : 'var(--card)' }}
              onClick={() => setOpenId(isOpen ? null : topic.id)}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${topic.color}15` }}
              >
                <Icon className="w-4 h-4" style={{ color: topic.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-tight" style={{ color: '#1F2937' }}>{topic.title}</p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{topic.brief}</p>
              </div>
              <ChevronDown
                className="w-4 h-4 shrink-0 transition-transform duration-300"
                style={{ color: topic.color, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-1" style={{ background: 'var(--card)' }}>
                {topic.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
