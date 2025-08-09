'use client';
import React, { useMemo, useState } from "react";

// --- Utility helpers ---
const clamp = (x: number, lo = 0, hi = 10) => Math.min(hi, Math.max(lo, x));

function percentToScore(p?: number) {
  if (p === undefined || Number.isNaN(p)) return undefined;
  // Piecewise linear mapping (50->5, 60->7, 70->9, 85->10)
  if (p <= 50) return 5;
  if (p <= 60) return 5 + 0.2 * (p - 50);
  if (p <= 70) return 7 + 0.2 * (p - 60);
  if (p <= 85) return 9 + (p - 70) * (1 / 15);
  return 10;
}

const UG_CLASS_TO_SCORE: Record<string, number> = {
  first: 9.2, // 可理解为 75 左右
  upper: 8.0, // 2:1
  lower: 6.5, // 2:2
  third: 5.0,
  other: 4.5,
};

const PG_CLASS_TO_SCORE: Record<string, number> = {
  distinction: 9.0,
  merit: 8.0,
  pass: 6.5,
  other: 5.0,
};

// Scheme options (typed, no any)
const schemeOptions = [
  { id: "default", label: "默认（理工/CS）" },
  { id: "engineering", label: "工程应用型" },
  { id: "humanities", label: "人文社科" },
] as const;

// Derive the union type from options

type Scheme = typeof schemeOptions[number]["id"];

// --- Institution prestige options (typed) ---
const QS_OPTIONS = [
  { id: "qs_top10", label: "QS Top 10", s: 10.0 },
  { id: "qs_11_20", label: "QS 11–20", s: 9.5 },
  { id: "qs_21_50", label: "QS 21–50", s: 9.0 },
  { id: "qs_51_100", label: "QS 51–100", s: 8.5 },
  { id: "qs_101_200", label: "QS 101–200", s: 8.0 },
  { id: "qs_201_300", label: "QS 201–300", s: 7.5 },
  { id: "qs_301_500", label: "QS 301–500", s: 7.0 },
  { id: "qs_501_800", label: "QS 501–800", s: 6.5 },
  { id: "qs_800_plus", label: "QS 800+ / 无", s: 6.0 },
] as const;

type QSId = typeof QS_OPTIONS[number]["id"];

const CN_OPTIONS = [
  { id: "cn_c9", label: "C9 / 顶尖985", s: 9.2 },
  { id: "cn_985", label: "其他 985", s: 8.0 },
  { id: "cn_211", label: "211 / 双一流", s: 7.2 },
  { id: "cn_1ben", label: "双非一本", s: 6.5 },
  { id: "cn_below", label: "一本以下", s: 5.0 },
] as const;

type CNId = typeof CN_OPTIONS[number]["id"];

function prestigeFrom(qsId: QSId | "", cnId: CNId | ""): number | undefined {
  const qs = QS_OPTIONS.find((o) => o.id === qsId)?.s;
  const cn = CN_OPTIONS.find((o) => o.id === cnId)?.s;
  if (qs === undefined && cn === undefined) return undefined;
  return Math.max(qs ?? -Infinity, cn ?? -Infinity);
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function LabelRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 py-2">
      <div className="md:w-64 shrink-0">
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {hint && <div className="text-xs text-gray-500">{hint}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Slider({ value, onChange, min = 0, max = 10, step = 0.5 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-black"
      />
      <div className="w-14 text-right text-sm font-semibold tabular-nums">{value.toFixed(1)}</div>
    </div>
  );
}

function NumberInput({ value, onChange, placeholder, min, max, step = 1, disabled = false }: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string; min?: number; max?: number; step?: number; disabled?: boolean }) {
  return (
    <input
      type="number"
      className={`w-full md:w-48 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${disabled ? "bg-gray-50 text-gray-400" : "bg-white"}`}
      value={value ?? ""}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") onChange(undefined);
        else onChange(Number(v));
      }}
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${checked ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${checked ? "bg-white" : "bg-gray-400"}`} />
      {label ?? (checked ? "是" : "否")}
    </button>
  );
}

export default function PhDEvalCalculator() {
  // --- Weight scheme ---
  const [scheme, setScheme] = useState<Scheme>("default");

  const weights = useMemo(() => {
    if (scheme === "humanities") return { AG: 0.30, RP: 0.35, RE: 0.15, RL: 0.12, PI: 0.08 };
    if (scheme === "engineering") return { AG: 0.30, RP: 0.25, RE: 0.25, RL: 0.12, PI: 0.08 };
    return { AG: 0.30, RP: 0.30, RE: 0.20, RL: 0.12, PI: 0.08 };
  }, [scheme]);

  // --- English Gate ---
  const [meetsEnglish, setMeetsEnglish] = useState(true);

  // --- AG': UG & PG ---
  const [ugMethod, setUgMethod] = useState<"class" | "percent">("class");
  const [ugClass, setUgClass] = useState<keyof typeof UG_CLASS_TO_SCORE | "">("");
  const [ugPercent, setUgPercent] = useState<number | undefined>(undefined);

  const [pgMethod, setPgMethod] = useState<"class" | "percent">("class");
  const [pgClass, setPgClass] = useState<keyof typeof PG_CLASS_TO_SCORE | "">("");
  const [pgPercent, setPgPercent] = useState<number | undefined>(undefined);

  // --- Institution prestige selections & rigor ---
  const [ugQs, setUgQs] = useState<QSId | "">("");
  const [ugCn, setUgCn] = useState<CNId | "">("");
  const [pgQs, setPgQs] = useState<QSId | "">("");
  const [pgCn, setPgCn] = useState<CNId | "">("");
  const [tgtQs, setTgtQs] = useState<QSId | "">("");
  const [tgtCn, setTgtCn] = useState<CNId | "">("");
  const [rigor, setRigor] = useState<number>(7);

  // --- RP' sub-scores ---
  const [rpInnovation, setRpInnovation] = useState(8);
  const [rpFeasible, setRpFeasible] = useState(8);
  const [rpFit, setRpFit] = useState(8);
  const [rpWriting, setRpWriting] = useState(8);

  // --- RE' items ---
  const [reTopFA, setReTopFA] = useState(0); // count * 4
  const [reTopCo, setReTopCo] = useState(0); // count * 2
  const [reGoodFA, setReGoodFA] = useState(0); // count * 3
  const [reGoodCo, setReGoodCo] = useState(0); // count * 1
  const [reThesis, setReThesis] = useState(false); // +1
  const [reRaMonths, setReRaMonths] = useState(0); // 0, 3-5 => +1, 6+ => +2
  const [reAwards, setReAwards] = useState(0); // +1 each, cap +2

  // --- RL' ---
  const [rl1, setRl1] = useState(8);
  const [rl2, setRl2] = useState(8);

  // --- PI' ---
  const [pi, setPi] = useState(8);

  // --- delta ---
  const [deltaFunding, setDeltaFunding] = useState(false); // +0.5
  const [deltaSupervisor, setDeltaSupervisor] = useState(false); // +0.5 if RP' >= 8

  // --- AG' compute ---
  const ugScore = useMemo(() => {
    if (ugMethod === "percent") return percentToScore(ugPercent);
    if (!ugClass) return undefined;
    return UG_CLASS_TO_SCORE[ugClass];
  }, [ugMethod, ugPercent, ugClass]);

  const pgScore = useMemo(() => {
    if (pgMethod === "percent") return percentToScore(pgPercent);
    if (!pgClass) return undefined;
    return PG_CLASS_TO_SCORE[pgClass];
  }, [pgMethod, pgPercent, pgClass]);

  const agPrime = useMemo(() => {
    if (ugScore !== undefined && pgScore !== undefined) return clamp(0.4 * ugScore + 0.6 * pgScore);
    if (ugScore !== undefined) return clamp(ugScore);
    if (pgScore !== undefined) return clamp(pgScore);
    return 0;
  }, [ugScore, pgScore]);

  // --- Prestige scores & AG* ---
  const S_UG = useMemo(() => prestigeFrom(ugQs, ugCn), [ugQs, ugCn]);
  const S_PG = useMemo(() => prestigeFrom(pgQs, pgCn), [pgQs, pgCn]);
  const S_src = useMemo(() => {
    if (S_UG !== undefined && S_PG !== undefined) return 0.65 * S_UG + 0.35 * S_PG; // 本科和硕士加权
    if (S_UG !== undefined) return S_UG;
    if (S_PG !== undefined) return S_PG;
    return undefined;
  }, [S_UG, S_PG]);
  const S_tgt = useMemo(() => prestigeFrom(tgtQs, tgtCn), [tgtQs, tgtCn]);

  const A_rel = useMemo(() => {
    // deadzone eps=0.3, cap a_max=1.2
    if (S_src === undefined || S_tgt === undefined) return 0;
    const d = S_src - S_tgt;
    const EPS = 0.3;
    const AMAX = 1.2;
    if (Math.abs(d) <= EPS) return 0;
    const adj = d > 0 ? d - EPS : d + EPS;
    return clamp(adj, -AMAX, AMAX);
  }, [S_src, S_tgt]);

  const P_src = S_src ?? 0; // fallback when not selected
  const agStar = useMemo(
    () => clamp((0.55 * agPrime + 0.25 * P_src + 0.10 * rigor + A_rel) * 1.30, 0, 10),
    [agPrime, P_src, rigor, A_rel]
  );
  // --- RP' compute ---
  const rpPrime = useMemo(() => clamp((rpInnovation + rpFeasible + rpFit + rpWriting) / 4), [rpInnovation, rpFeasible, rpFit, rpWriting]);

  // --- RE' compute ---
  const rePrime = useMemo(() => {
    let pts = 0;
    pts += reTopFA * 4;
    pts += reTopCo * 2;
    pts += reGoodFA * 3;
    pts += reGoodCo * 1;
    if (reThesis) pts += 1;
    if (reRaMonths >= 6) pts += 2; else if (reRaMonths >= 3) pts += 1;
    pts += Math.min(2, reAwards);
    return clamp(pts, 0, 10);
  }, [reTopFA, reTopCo, reGoodFA, reGoodCo, reThesis, reRaMonths, reAwards]);

  // --- RL' compute ---
  const rlPrime = useMemo(() => clamp((rl1 + rl2) / 2), [rl1, rl2]);

  // --- delta compute ---
  const delta = useMemo(() => {
    let d = 0;
    if (deltaFunding) d += 0.5;
    if (deltaSupervisor && rpPrime >= 8) d += 0.5; // 契合度足够时生效
    return d;
  }, [deltaFunding, deltaSupervisor, rpPrime]);

  // --- TS compute ---
  const ts = useMemo(() => {
    if (!meetsEnglish) return NaN; // Gate failed
    return clamp(weights.AG * agStar + weights.RP * rpPrime + weights.RE * rePrime + weights.RL * rlPrime + weights.PI * pi + delta, 0, 10);
  }, [agStar, rpPrime, rePrime, rlPrime, pi, delta, meetsEnglish, weights]);

  const verdict = useMemo(() => {
    if (!meetsEnglish) return { label: "未达英语门槛", color: "bg-rose-500" };
    if (ts >= 8.4) return { label: "竞争力极强", color: "bg-emerald-600" };
    if (ts >= 7.4) return { label: "具有竞争力", color: "bg-amber-500" };
    if (ts >= 6.9) return { label: "边缘/看匹配", color: "bg-yellow-500" };
    return { label: "建议补强背景", color: "bg-rose-500" };
  }, [ts, meetsEnglish]);

  // --- Improvement suggestions ---
  const improvementHints = useMemo(() => {
    if (!meetsEnglish) return ["先满足英语要求（如 IELTS/TOEFL 单项与总分）—未达标通常不会进入学术评审。"]; 
    const items = [
      { key: "AG*", w: weights.AG, val: agStar, tip: "学术背景：完善成绩、提升课程强度并选择匹配目标的院校组合" },
      { key: "RP'", w: weights.RP, val: rpPrime, tip: "优化研究计划：突出创新点、细化方法与数据、明确与导师课题的契合" },
      { key: "RE'", w: weights.RE, val: rePrime, tip: "积累实证成果：RA ≥6个月、投稿优质会议/期刊、强化一作贡献" },
      { key: "RL'", w: weights.RL, val: rlPrime, tip: "争取强力推荐：让推荐人写明你在同侪中的分位与独立贡献" },
      { key: "PI'", w: weights.PI, val: pi, tip: "准备面试：研究深度提问、结构化表达、现场推理演练" },
    ];
    // 计算每项到 8 分的边际提升（乘以权重）
    const goals = 8; // 目标线
    items.sort((a, b) => (goals - a.val) * a.w < (goals - b.val) * b.w ? 1 : -1);
    return items.slice(0, 3).map((it) => `${it.key}: 若提升到 ${goals} 分，增益约 ${(Math.max(0, goals - it.val) * it.w).toFixed(2)}。建议：${it.tip}`);
  }, [meetsEnglish, agStar, rpPrime, rePrime, rlPrime, pi, weights]);

  const weightedBreakdown = useMemo(() => {
    return [
      { name: "AG* 学术背景", w: weights.AG, v: agStar },
      { name: "RP' 研究计划", w: weights.RP, v: rpPrime },
      { name: "RE' 研究经历", w: weights.RE, v: rePrime },
      { name: "RL' 推荐信", w: weights.RL, v: rlPrime },
      { name: "PI' 面试", w: weights.PI, v: pi },
    ].map((x) => ({ ...x, contrib: (x.w * x.v).toFixed(2) }));
  }, [agStar, rpPrime, rePrime, rlPrime, pi, weights]);

  const resetAll = () => {
    setScheme("default");
    setMeetsEnglish(true);
    setUgMethod("class"); setUgClass(""); setUgPercent(undefined);
    setPgMethod("class"); setPgClass(""); setPgPercent(undefined);
    setRpInnovation(8); setRpFeasible(8); setRpFit(8); setRpWriting(8);
    setReTopFA(0); setReTopCo(0); setReGoodFA(0); setReGoodCo(0); setReThesis(false); setReRaMonths(0); setReAwards(0);
    setRl1(8); setRl2(8);
    setPi(8);
    setDeltaFunding(false); setDeltaSupervisor(false);
    setUgQs(""); setUgCn(""); setPgQs(""); setPgCn(""); setTgtQs(""); setTgtCn(""); setRigor(7);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">英国博士申请自评计算器</h1>
          <p className="text-gray-600 mt-2">量纲统一、可解释的自评工具。EF 为门槛；TS≥8.4 竞争力极强，7.4–8.3 具有竞争力，6.9–7.3 边缘；&lt;6.9 建议补强。</p>
        </header>

        {/* Controls Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Section title="评估方案">
            <div className="flex flex-wrap gap-2">
              {schemeOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setScheme(opt.id)}
                  className={`rounded-xl px-3 py-2 text-sm border transition ${scheme === opt.id ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 hover:bg-gray-50"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-gray-600">英语达标（EF Gate）</span>
              <Toggle checked={meetsEnglish} onChange={setMeetsEnglish} />
            </div>
          </Section>

          <Section title="当前总评 (TS)">
            {!meetsEnglish ? (
              <div className="text-rose-600 font-semibold">未达英语门槛：请先满足语言要求后再评估。</div>
            ) : (
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-5xl font-black tabular-nums">{Number.isNaN(ts) ? "--" : ts.toFixed(2)}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${verdict.color}`}></span>
                    <span className="text-sm text-gray-700 font-medium">{verdict.label}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">（权重：AG {weights.AG}, RP {weights.RP}, RE {weights.RE}, RL {weights.RL}, PI {weights.PI}；调节 δ = {delta.toFixed(2)}）</div>
                </div>
                <button onClick={resetAll} className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">重置</button>
              </div>
            )}
          </Section>

          <Section title="建议与短板" subtitle="按提升到 8 分的边际增益排序（仅作参考）">
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {improvementHints.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </Section>
        </div>

        {/* Academic Achievement */}
        <Section title="A. 学术背景 AG*（0–10）" subtitle="AG* = 0.55·G + 0.25·生源声誉 + 0.10·课程强度 + 相对差异；其中 G = 0.4·UG + 0.6·PG">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold mb-2">本科 UG</div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <button className={`rounded-lg border px-3 py-1 text-sm ${ugMethod === "class" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`} onClick={() => setUgMethod("class")}>按学位等级</button>
                  <button className={`rounded-lg border px-3 py-1 text-sm ${ugMethod === "percent" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`} onClick={() => setUgMethod("percent")}>按百分制</button>
                </div>
                {ugMethod === "class" ? (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "first", label: "一等 First" },
                      { id: "upper", label: "二等一 2:1" },
                      { id: "lower", label: "二等二 2:2" },
                      { id: "third", label: "Third" },
                      { id: "other", label: "其他" },
                    ].map((opt) => (
                      <button key={opt.id} onClick={() => setUgClass(opt.id)} className={`rounded-xl px-3 py-2 text-sm border ${ugClass === opt.id ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 hover:bg-gray-50"}`}>{opt.label}</button>
                    ))}
                  </div>
                ) : (
                  <LabelRow label="本科均分 %" hint="50→5，60→7，70→9，85→10">
                    <NumberInput value={ugPercent} onChange={setUgPercent} min={0} max={100} step={0.1} placeholder="如 78" />
                  </LabelRow>
                )}
                <div className="text-xs text-gray-500">当前 UG 换算：<span className="font-semibold text-gray-800">{ugScore ? ugScore.toFixed(2) : "--"}</span></div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">硕士 PG</div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <button className={`rounded-lg border px-3 py-1 text-sm ${pgMethod === "class" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`} onClick={() => setPgMethod("class")}>按学位等级</button>
                  <button className={`rounded-lg border px-3 py-1 text-sm ${pgMethod === "percent" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`} onClick={() => setPgMethod("percent")}>按百分制</button>
                </div>
                {pgMethod === "class" ? (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "distinction", label: "Distinction" },
                      { id: "merit", label: "Merit" },
                      { id: "pass", label: "Pass" },
                      { id: "other", label: "其他" },
                    ].map((opt) => (
                      <button key={opt.id} onClick={() => setPgClass(opt.id)} className={`rounded-xl px-3 py-2 text-sm border ${pgClass === opt.id ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 hover:bg-gray-50"}`}>{opt.label}</button>
                    ))}
                  </div>
                ) : (
                  <LabelRow label="硕士均分 %" hint="50→5，60→7，70→9，85→10">
                    <NumberInput value={pgPercent} onChange={setPgPercent} min={0} max={100} step={0.1} placeholder="如 71" />
                  </LabelRow>
                )}
                <div className="text-xs text-gray-500">当前 PG 换算：<span className="font-semibold text-gray-800">{pgScore ? pgScore.toFixed(2) : "--"}</span></div>
              </div>
            </div>
          </div>

          {/* Institution prestige selectors */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* UG group */}
            <div className="space-y-3">
              <div className="text-sm font-semibold">本科院校（任选其一或都选，取较高）</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">QS 段位</div>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    value={ugQs}
                    onChange={(e) => setUgQs(e.target.value as QSId)}
                  >
                    <option value="">未选择</option>
                    {QS_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">中国层级</div>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    value={ugCn}
                    onChange={(e) => setUgCn(e.target.value as CNId)}
                  >
                    <option value="">未选择</option>
                    {CN_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* PG group */}
            <div className="space-y-3">
              <div className="text-sm font-semibold">硕士院校（可选）</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">QS 段位</div>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    value={pgQs}
                    onChange={(e) => setPgQs(e.target.value as QSId)}
                  >
                    <option value="">未选择</option>
                    {QS_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">中国层级</div>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    value={pgCn}
                    onChange={(e) => setPgCn(e.target.value as CNId)}
                  >
                    <option value="">未选择</option>
                    {CN_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Target group */}
            <div className="space-y-3">
              <div className="text-sm font-semibold">目标院校</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">QS 段位</div>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    value={tgtQs}
                    onChange={(e) => setTgtQs(e.target.value as QSId)}
                  >
                    <option value="">未选择</option>
                    {QS_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">中国层级</div>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    value={tgtCn}
                    onChange={(e) => setTgtCn(e.target.value as CNId)}
                  >
                    <option value="">未选择</option>
                    {CN_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Rigor */}
          <div className="mt-4">
            <LabelRow label="课程/培养强度（R）" hint="一般=5，中=7，高=9">
              <div className="flex gap-2">
                {[{v:5,l:"一般"},{v:7,l:"中"},{v:9,l:"高"}].map((opt) => (
                  <button key={opt.v} onClick={() => setRigor(opt.v)} className={`rounded-xl px-3 py-2 text-sm border ${rigor === opt.v ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 hover:bg-gray-50"}`}>{opt.l}（{opt.v}）</button>
                ))}
              </div>
            </LabelRow>
          </div>

          {/* Calculations display */}
          <div className="mt-4 text-sm text-gray-700 space-y-1">
            <div>G = {ugScore !== undefined && pgScore !== undefined ? `0.4×${ugScore.toFixed(2)} + 0.6×${pgScore.toFixed(2)} = ${agPrime.toFixed(2)}` : `${(ugScore ?? pgScore ?? 0).toFixed(2)}`}</div>
            <div>P_src = {S_src !== undefined ? S_src.toFixed(2) : "--"}; S_tgt = {S_tgt !== undefined ? S_tgt.toFixed(2) : "--"}; A_rel = {A_rel.toFixed(2)}</div>
            <div>AG* = (0.55×{agPrime.toFixed(2)} + 0.25×{P_src.toFixed(2)} + 0.10×{rigor.toFixed(2)} + {A_rel.toFixed(2)}) ×1.30 = <span className="font-semibold">{agStar.toFixed(2)}</span></div>
          </div>
        </Section>

        {/* Research Proposal */}
        <Section title="B. 研究计划 RP′（0–10）" subtitle="四要素各 25%：创新性、可行性、与导师契合、写作质量">
          <LabelRow label="创新性"><Slider value={rpInnovation} onChange={setRpInnovation} /></LabelRow>
          <LabelRow label="可行性"><Slider value={rpFeasible} onChange={setRpFeasible} /></LabelRow>
          <LabelRow label="与导师/课题契合"><Slider value={rpFit} onChange={setRpFit} /></LabelRow>
          <LabelRow label="写作质量"><Slider value={rpWriting} onChange={setRpWriting} /></LabelRow>
          <div className="mt-2 text-sm text-gray-700">RP′ = <span className="font-semibold">{rpPrime.toFixed(2)}</span></div>
        </Section>

        {/* Research Experience */}
        <Section title="C. 研究经历 RE′（0–10，累计封顶）" subtitle="避免重复计分；分值累加并封顶 10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <LabelRow label="顶会/顶刊 一作（每篇 +4）">
                <NumberInput value={reTopFA} onChange={(v) => setReTopFA(Math.max(0, v ?? 0))} min={0} step={1} />
              </LabelRow>
              <LabelRow label="顶会/顶刊 合作（每篇 +2)">
                <NumberInput value={reTopCo} onChange={(v) => setReTopCo(Math.max(0, v ?? 0))} min={0} step={1} />
              </LabelRow>
              <LabelRow label="优质会/刊 一作（每篇 +3)">
                <NumberInput value={reGoodFA} onChange={(v) => setReGoodFA(Math.max(0, v ?? 0))} min={0} step={1} />
              </LabelRow>
              <LabelRow label="优质会/刊 合作（每篇 +1)">
                <NumberInput value={reGoodCo} onChange={(v) => setReGoodCo(Math.max(0, v ?? 0))} min={0} step={1} />
              </LabelRow>
            </div>
            <div className="space-y-3">
              <LabelRow label="硕士论文优秀/Distinction (+1)">
                <Toggle checked={reThesis} onChange={setReThesis} />
              </LabelRow>
              <LabelRow label="RA / 科研实习（月数）" hint="3–5 月 +1；≥6 月 +2">
                <NumberInput value={reRaMonths} onChange={(v) => setReRaMonths(Math.max(0, v ?? 0))} min={0} step={1} />
              </LabelRow>
              <LabelRow label="获奖 / 专利（每项 +1，最多 +2)">
                <NumberInput value={reAwards} onChange={(v) => setReAwards(Math.max(0, v ?? 0))} min={0} step={1} />
              </LabelRow>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-700">RE′ = <span className="font-semibold">{rePrime.toFixed(2)}</span>（已封顶 10）</div>
        </Section>

        {/* Recommendation Letters */}
        <Section title="D. 推荐信 RL′（0–10）" subtitle="取两封平均：7–8=扎实；9–10=强推并给出同侪比较">
          <LabelRow label="推荐信 A 强度"><Slider value={rl1} onChange={setRl1} /></LabelRow>
          <LabelRow label="推荐信 B 强度"><Slider value={rl2} onChange={setRl2} /></LabelRow>
          <div className="mt-2 text-sm text-gray-700">RL′ = <span className="font-semibold">{rlPrime.toFixed(2)}</span></div>
        </Section>

        {/* Interview */}
        <Section title="E. 面试表现 PI′（0–10）" subtitle="6=合格；8=表现好；9–10=非常出色">
          <LabelRow label="总体面试表现"><Slider value={pi} onChange={setPi} /></LabelRow>
        </Section>

        {/* Delta */}
        <Section title="F. 调节项 δ（0～+1.0）" subtitle="仅在确有外部条件优势时使用，避免与其它维度重复">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LabelRow label="已落实外部奖学金/自带经费（CSC 等）"><Toggle checked={deltaFunding} onChange={setDeltaFunding} /></LabelRow>
            <LabelRow label="导师明确接收意向（RP′≥8 时计 +0.5）">
              <Toggle checked={deltaSupervisor} onChange={setDeltaSupervisor} />
            </LabelRow>
          </div>
          <div className="mt-2 text-sm text-gray-700">当前 δ = <span className="font-semibold">{delta.toFixed(2)}</span></div>
        </Section>

        {/* Breakdown */}
        <Section title="贡献拆解与权重">
          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">维度</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">分值 (0–10)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">权重</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">贡献 (w×v)</th>
                </tr>
              </thead>
              <tbody>
                {weightedBreakdown.map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3 tabular-nums">{row.v.toFixed(2)}</td>
                    <td className="px-4 py-3 tabular-nums">{row.w.toFixed(2)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{row.contrib}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-4 py-3 font-semibold">调节 δ</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3 tabular-nums font-semibold">{delta.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-100 border-t border-gray-200">
                  <td className="px-4 py-3 font-semibold">总评 TS</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3 tabular-nums font-black">{Number.isNaN(ts) ? "--" : ts.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">提示：TS 为自评指标，实际录取强依赖于导师意愿、经费与具体研究方向匹配。该工具仅用于自我诊断与改进规划。</p>
        </Section>

        <footer className="text-center text-xs text-gray-400 mt-10">© {new Date().getFullYear()} PhD Self-Evaluation Calculator · 统一量表模型 by Easkwon</footer>
      </div>
    </div>
  );
}
