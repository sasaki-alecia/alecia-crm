import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const STATUS_CONFIG = {
  new:         { label: "新規反響", color: "#6366f1", bg: "#eef2ff", icon: "✨" },
  contacted:   { label: "初回接触", color: "#0ea5e9", bg: "#f0f9ff", icon: "📞" },
  negotiating: { label: "商談中",   color: "#f59e0b", bg: "#fffbeb", icon: "💬" },
  viewing:     { label: "内見済",   color: "#ec4899", bg: "#fdf2f8", icon: "🏠" },
  applied:     { label: "申込済",   color: "#10b981", bg: "#ecfdf5", icon: "📝" },
  closed:      { label: "成約",     color: "#059669", bg: "#d1fae5", icon: "🎉" },
  lost:        { label: "失注",     color: "#9ca3af", bg: "#f3f4f6", icon: "❌" },
};
const SOURCES = ["SUUMO", "ホームズ", "アットホーム", "紹介", "HP", "その他"];
const PRIORITIES = ["高", "中", "低"];
const PRIORITY_COLOR = { 高: "#ef4444", 中: "#f59e0b", 低: "#10b981" };

const TABS = [
  { id: "today",     icon: "⚡", label: "今日" },
  { id: "leads",     icon: "👥", label: "リード" },
  { id: "properties",icon: "🏢", label: "物件" },
  { id: "kpi",       icon: "📊", label: "分析" },
  { id: "templates", icon: "💬", label: "テンプレ" },
];

const STORAGE_KEYS = {
  leads: "recrm_leads_v2",
  properties: "recrm_properties_v2",
  templates: "recrm_templates_v2",
};

const EMPTY_LEAD = {
  id: null, name: "", phone: "", email: "", line: "",
  status: "new", source: "SUUMO", priority: "中",
  budget: "", area: "", conditions: "", propertyId: "",
  nextAction: "", nextActionDate: "", notes: "",
  checklist: [], activities: [], createdAt: "", updatedAt: "",
};

const EMPTY_PROPERTY = {
  id: null, name: "", address: "", rent: "", layout: "",
  area: "", floor: "", pet: false, parking: false,
  nearStation: "", vacant: true, notes: "",
};

const DEFAULT_TEMPLATES = [
  {
    id: "t1", category: "初回返信",
    name: "SUUMO反響・初回LINE",
    body: `{{name}}様\n\nこの度はお問い合わせいただきありがとうございます。\n株式会社Aleciaの佐々木と申します。\n\n{{property}}についてご興味をお持ちいただき、誠にありがとうございます。\n\nご希望のご予算・エリア・間取りなど、もう少し詳しくお聞かせいただけますでしょうか？\nお客様にぴったりの物件をご提案させていただきます！\n\nお気軽にご返信ください😊`,
  },
  {
    id: "t2", category: "内見後",
    name: "内見後フォロー",
    body: `{{name}}様\n\n本日はお忙しい中、内見にお越しいただきありがとうございました！\n\n{{property}}はいかがでしたでしょうか？\nご不明な点やご質問がございましたら、何でもお気軽にご連絡ください。\n\n他にもご希望に沿った物件をご案内できますので、\nお気軽にお申し付けください！`,
  },
  {
    id: "t3", category: "追客",
    name: "しばらく連絡なし・再アプローチ",
    body: `{{name}}様\n\nお久しぶりです！株式会社Aleciaの佐々木です。\n\nその後、お部屋探しはいかがでしょうか？\n\n最近、{{name}}様のご条件に合いそうな新着物件が出てまいりましたので、\nよろしければご紹介させてください😊\n\nご都合のよいタイミングでお気軽にご返信いただければ幸いです。`,
  },
  {
    id: "t4", category: "申込促進",
    name: "申込検討中・背中を押す",
    body: `{{name}}様\n\nいつもありがとうございます！佐々木です。\n\n{{property}}についてですが、\n現在他にもお問い合わせが入っており、人気の物件となっております。\n\nご検討状況はいかがでしょうか？\nご不安な点がございましたら、一度お電話かオンラインでお話しできればと思います。\n\nどうぞお気軽にご連絡ください！`,
  },
];

const CONTRACT_CHECKLIST_ITEMS = [
  "本人確認書類（免許証・マイナンバー等）受領",
  "収入証明書（源泉徴収票・確定申告書）受領",
  "緊急連絡先の確認",
  "保証人・保証会社の選定",
  "審査申込書の提出",
  "審査通過の確認",
  "重要事項説明の実施",
  "賃貸借契約書の締結",
  "初期費用の入金確認",
  "鍵の引き渡し",
  "入居後アフターフォロー連絡",
];

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().split("T")[0];
const fmtDate = (s) => { if (!s) return "—"; const d = new Date(s); return `${d.getMonth()+1}/${d.getDate()}`; };
const fmtDateTime = (s) => { if (!s) return ""; const d = new Date(s); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const isOverdue = (date) => date && date < todayStr();
const isDueToday = (date) => date === todayStr();

async function load(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function save(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ─────────────────────────────────────────────
// SMALL UI PARTS
// ─────────────────────────────────────────────
function Badge({ status }) {
  const c = STATUS_CONFIG[status];
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, color: c.color, background: c.bg, border: `1px solid ${c.color}30`, whiteSpace: "nowrap" }}>{c.icon} {c.label}</span>;
}

function PriBadge({ p }) {
  return <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 20, color: "#fff", background: PRIORITY_COLOR[p] }}>{p}</span>;
}

function Toast({ msg, type }) {
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700,
      background: type === "error" ? "#ef4444" : type === "info" ? "#6366f1" : "#10b981",
      color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      animation: "slideIn 0.25s ease",
    }}>{msg}</div>
  );
}

function Spinner() {
  return <div style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

function FieldLabel({ children, required }) {
  return <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{children}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</label>;
}

function Field({ label, required, children }) {
  return <div style={{ marginBottom: 14 }}><FieldLabel required={required}>{label}</FieldLabel>{children}</div>;
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "8px 11px", borderRadius: 8,
  border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", background: "#fff",
  fontFamily: "inherit", transition: "border-color 0.15s",
};

function Inp({ value, onChange, placeholder, type = "text", required }) {
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
    style={inputStyle}
    onFocus={e => e.target.style.borderColor = "#6366f1"}
    onBlur={e => e.target.style.borderColor = "#e2e8f0"} />;
}

function Sel({ value, onChange, options }) {
  return <select value={value} onChange={onChange} style={{ ...inputStyle, cursor: "pointer" }}>
    {options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
  </select>;
}

function Txt({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
    style={{ ...inputStyle, resize: "vertical" }}
    onFocus={e => e.target.style.borderColor = "#6366f1"}
    onBlur={e => e.target.style.borderColor = "#e2e8f0"} />;
}

function SectionHead({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid #eef2ff", paddingBottom: 6, marginBottom: 12, marginTop: 4 }}>{children}</div>;
}

function Btn({ onClick, variant = "primary", children, disabled, small, style: extraStyle }) {
  const base = { padding: small ? "5px 12px" : "9px 18px", borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "opacity 0.15s", opacity: disabled ? 0.5 : 1, ...extraStyle };
  const variants = {
    primary: { background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" },
    secondary: { background: "#f1f5f9", color: "#475569", border: "1.5px solid #e2e8f0" },
    danger: { background: "#fff", color: "#ef4444", border: "1.5px solid #fca5a5" },
    success: { background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

// ─────────────────────────────────────────────
// MODAL WRAPPER
// ─────────────────────────────────────────────
function Modal({ onClose, children, width = 620 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: width, maxHeight: "92vh", overflowY: "auto", padding: 28, boxShadow: "0 30px 80px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{title}</h2>
      <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", lineHeight: 1, padding: 2 }}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// LEAD MODAL (full form)
// ─────────────────────────────────────────────
function LeadModal({ lead, properties, templates, onSave, onClose, showToast }) {
  const [f, setF] = useState({ ...EMPTY_LEAD, ...lead });
  const [activity, setActivity] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiCopied, setAiCopied] = useState(false);
  const [activeSection, setActiveSection] = useState("basic");

  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const setVal = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!f.name.trim()) { showToast("氏名は必須です", "error"); return; }
    const n = now();
    onSave({ ...f, id: f.id || genId(), createdAt: f.createdAt || n, updatedAt: n });
  };

  const addActivity = () => {
    if (!activity.trim()) return;
    setF(p => ({ ...p, activities: [...(p.activities || []), { id: genId(), text: activity.trim(), createdAt: now() }] }));
    setActivity("");
  };

  const toggleChecklist = (item) => {
    const cl = f.checklist || [];
    setF(p => ({ ...p, checklist: cl.includes(item) ? cl.filter(x => x !== item) : [...cl, item] }));
  };

  const property = properties.find(p => p.id === f.propertyId);

  // AI initial message generation
  const generateAI = async () => {
    setAiLoading(true);
    setAiMessage("");
    const prompt = `あなたは不動産仲介会社の営業担当です。以下のリード情報をもとに、初回の返信メッセージ（LINE/メール用）を日本語で作成してください。

リード情報:
- 氏名: ${f.name || "（未入力）"}
- 流入元: ${f.source}
- 希望予算: ${f.budget || "未確認"}
- 希望エリア: ${f.area || "未確認"}
- 希望条件: ${f.conditions || "未確認"}
- 提案物件: ${property ? property.name : (f.propertyId || "未選択")}

条件:
- 親しみやすく丁寧なトーン
- 会社名は「株式会社Alecia」、担当者名は「佐々木」
- 次のアクション（オンライン面談や詳細確認など）への誘導を含める
- 300文字以内でコンパクトに
- メッセージ本文のみ出力（説明不要）`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "生成に失敗しました";
      setAiMessage(text);
    } catch {
      setAiMessage("生成に失敗しました。再度お試しください。");
    }
    setAiLoading(false);
  };

  const copyAI = () => {
    navigator.clipboard.writeText(aiMessage).then(() => { setAiCopied(true); setTimeout(() => setAiCopied(false), 2000); });
  };

  const sections = [
    { id: "basic", label: "基本情報" },
    { id: "status", label: "進捗" },
    { id: "conditions", label: "希望条件" },
    { id: "checklist", label: "契約チェック" },
    { id: "ai", label: "✨ AI文章" },
    { id: "history", label: "活動履歴" },
  ];

  return (
    <Modal onClose={onClose} width={660}>
      <ModalHeader title={f.id ? `${f.name} を編集` : "新規リード登録"} onClose={onClose} />

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: activeSection === s.id ? "#6366f1" : "#f1f5f9",
            color: activeSection === s.id ? "#fff" : "#64748b",
            transition: "all 0.15s",
          }}>{s.label}</button>
        ))}
      </div>

      {/* BASIC */}
      {activeSection === "basic" && (
        <>
          <SectionHead>基本情報</SectionHead>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Field label="氏名" required><Inp value={f.name} onChange={set("name")} placeholder="佐々木 太郎" required /></Field>
            <Field label="電話番号"><Inp value={f.phone} onChange={set("phone")} placeholder="090-0000-0000" /></Field>
            <Field label="メールアドレス"><Inp value={f.email} onChange={set("email")} placeholder="example@email.com" /></Field>
            <Field label="LINE名"><Inp value={f.line} onChange={set("line")} placeholder="LINE表示名" /></Field>
          </div>
          <Field label="備考・メモ"><Txt value={f.notes} onChange={set("notes")} placeholder="特記事項、前回の連絡内容など…" rows={4} /></Field>
        </>
      )}

      {/* STATUS */}
      {activeSection === "status" && (
        <>
          <SectionHead>進捗・管理</SectionHead>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
            <Field label="ステータス"><Sel value={f.status} onChange={set("status")} options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: `${c.icon} ${c.label}` }))} /></Field>
            <Field label="優先度"><Sel value={f.priority} onChange={set("priority")} options={PRIORITIES} /></Field>
            <Field label="流入元"><Sel value={f.source} onChange={set("source")} options={SOURCES} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Field label="次回アクション"><Inp value={f.nextAction} onChange={set("nextAction")} placeholder="内見アポ確認" /></Field>
            <Field label="期日"><Inp value={f.nextActionDate} onChange={set("nextActionDate")} type="date" /></Field>
          </div>
          <Field label="提案物件">
            <Sel value={f.propertyId} onChange={set("propertyId")}
              options={[{ value: "", label: "未選択" }, ...properties.filter(p => p.vacant).map(p => ({ value: p.id, label: `${p.name}（${p.rent}・${p.layout}）` }))]} />
          </Field>
        </>
      )}

      {/* CONDITIONS */}
      {activeSection === "conditions" && (
        <>
          <SectionHead>希望条件</SectionHead>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Field label="予算（家賃上限）"><Inp value={f.budget} onChange={set("budget")} placeholder="¥120,000" /></Field>
            <Field label="希望エリア"><Inp value={f.area} onChange={set("area")} placeholder="新宿・渋谷 20分圏内" /></Field>
          </div>
          <Field label="その他条件"><Txt value={f.conditions} onChange={set("conditions")} placeholder="ペット可・1LDK以上・駅徒歩10分以内・非木造…" rows={4} /></Field>
        </>
      )}

      {/* CHECKLIST */}
      {activeSection === "checklist" && (
        <>
          <SectionHead>申込〜契約チェックリスト</SectionHead>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CONTRACT_CHECKLIST_ITEMS.map(item => {
              const done = (f.checklist || []).includes(item);
              return (
                <div key={item} onClick={() => toggleChecklist(item)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, cursor: "pointer", border: "1.5px solid",
                  borderColor: done ? "#10b981" : "#e2e8f0",
                  background: done ? "#f0fdf4" : "#fff",
                  transition: "all 0.15s",
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, border: `2px solid ${done ? "#10b981" : "#cbd5e1"}`,
                    background: done ? "#10b981" : "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: 12,
                  }}>{done ? "✓" : ""}</div>
                  <span style={{ fontSize: 13, color: done ? "#059669" : "#334155", fontWeight: done ? 700 : 400, textDecoration: done ? "line-through" : "none" }}>{item}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "#eef2ff", color: "#4f46e5", fontSize: 12, fontWeight: 700 }}>
            進捗: {(f.checklist || []).length} / {CONTRACT_CHECKLIST_ITEMS.length} 完了
          </div>
        </>
      )}

      {/* AI MESSAGE */}
      {activeSection === "ai" && (
        <>
          <SectionHead>✨ AI初回メッセージ生成</SectionHead>
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "#eef2ff", marginBottom: 16, fontSize: 13, color: "#4f46e5", lineHeight: 1.6 }}>
            基本情報・希望条件・提案物件をもとに、<strong>LINE/メール用の初回返信文</strong>を自動生成します。
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12, fontSize: 12 }}>
              {[["氏名", f.name || "—"], ["流入元", f.source], ["予算", f.budget || "未確認"], ["提案物件", property?.name || "未選択"]].map(([k, v]) => (
                <div key={k} style={{ padding: "8px 12px", borderRadius: 8, background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
                  <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 700 }}>{k}: </span>
                  <span style={{ color: "#334155", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <Btn onClick={generateAI} disabled={aiLoading} variant="primary">
              {aiLoading ? <><Spinner /> 生成中…</> : "✨ メッセージを生成する"}
            </Btn>
          </div>
          {aiMessage && (
            <div style={{ marginTop: 12 }}>
              <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1.5px solid #e2e8f0", fontSize: 13, lineHeight: 1.8, color: "#334155", whiteSpace: "pre-wrap", marginBottom: 10 }}>
                {aiMessage}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={copyAI} variant="success" small>{aiCopied ? "✅ コピー完了！" : "📋 コピー"}</Btn>
                <Btn onClick={() => setF(p => ({ ...p, notes: (p.notes ? p.notes + "\n\n" : "") + "[AI生成メッセージ]\n" + aiMessage }))} variant="secondary" small>メモに追加</Btn>
                <Btn onClick={generateAI} variant="secondary" small>🔄 再生成</Btn>
              </div>
            </div>
          )}
        </>
      )}

      {/* HISTORY */}
      {activeSection === "history" && (
        <>
          <SectionHead>活動履歴</SectionHead>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={activity} onChange={e => setActivity(e.target.value)} onKeyDown={e => e.key === "Enter" && addActivity()}
              placeholder="例：LINE送信・内見実施・電話対応…"
              style={{ ...inputStyle, flex: 1 }} />
            <Btn onClick={addActivity} small>追加</Btn>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {(f.activities || []).slice().reverse().map(a => (
              <div key={a.id} style={{ display: "flex", gap: 12, padding: "8px 12px", borderRadius: 8, background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
                <span style={{ color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap", paddingTop: 1 }}>{fmtDateTime(a.createdAt)}</span>
                <span style={{ fontSize: 13, color: "#334155" }}>{a.text}</span>
              </div>
            ))}
            {(f.activities || []).length === 0 && <div style={{ color: "#cbd5e1", fontSize: 13, padding: 16, textAlign: "center" }}>履歴なし</div>}
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 16, borderTop: "1.5px solid #f1f5f9" }}>
        <Btn onClick={onClose} variant="secondary">キャンセル</Btn>
        <Btn onClick={handleSave} variant="primary">💾 保存する</Btn>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// PROPERTY MODAL
// ─────────────────────────────────────────────
function PropertyModal({ property, onSave, onClose }) {
  const [f, setF] = useState({ ...EMPTY_PROPERTY, ...property });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const setB = k => e => setF(p => ({ ...p, [k]: e.target.checked }));

  return (
    <Modal onClose={onClose} width={540}>
      <ModalHeader title={f.id ? "物件を編集" : "新規物件登録"} onClose={onClose} />
      <SectionHead>物件情報</SectionHead>
      <Field label="物件名" required><Inp value={f.name} onChange={set("name")} placeholder="エフローレ日本橋" required /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="家賃"><Inp value={f.rent} onChange={set("rent")} placeholder="¥85,000" /></Field>
        <Field label="間取り"><Inp value={f.layout} onChange={set("layout")} placeholder="1K / 1LDK" /></Field>
        <Field label="専有面積"><Inp value={f.area} onChange={set("area")} placeholder="30㎡" /></Field>
        <Field label="階数"><Inp value={f.floor} onChange={set("floor")} placeholder="6階 / 8階建" /></Field>
        <Field label="最寄り駅・徒歩"><Inp value={f.nearStation} onChange={set("nearStation")} placeholder="人形町駅 徒歩5分" /></Field>
      </div>
      <Field label="住所"><Inp value={f.address} onChange={set("address")} placeholder="東京都中央区日本橋…" /></Field>
      <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
        {[["pet", "ペット可"], ["parking", "駐車場あり"], ["vacant", "空室"]].map(([k, l]) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#334155" }}>
            <input type="checkbox" checked={!!f[k]} onChange={setB(k)} style={{ width: 16, height: 16 }} />
            {l}
          </label>
        ))}
      </div>
      <Field label="備考"><Txt value={f.notes} onChange={set("notes")} placeholder="築年数・設備など" rows={2} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <Btn onClick={onClose} variant="secondary">キャンセル</Btn>
        <Btn onClick={() => { if (!f.name.trim()) return; onSave({ ...f, id: f.id || genId() }); }} variant="primary">💾 保存</Btn>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// TEMPLATE MODAL
// ─────────────────────────────────────────────
function TemplateModal({ template, onSave, onClose }) {
  const [f, setF] = useState(template || { id: null, category: "初回返信", name: "", body: "" });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <Modal onClose={onClose} width={540}>
      <ModalHeader title={f.id ? "テンプレを編集" : "新規テンプレ"} onClose={onClose} />
      <Field label="カテゴリ"><Inp value={f.category} onChange={set("category")} placeholder="初回返信・追客…" /></Field>
      <Field label="テンプレ名"><Inp value={f.name} onChange={set("name")} placeholder="SUUMO反響・初回LINE" /></Field>
      <Field label="本文（{{name}}・{{property}}は自動置換）"><Txt value={f.body} onChange={set("body")} rows={8} placeholder="{{name}}様、お問い合わせありがとうございます…" /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <Btn onClick={onClose} variant="secondary">キャンセル</Btn>
        <Btn onClick={() => { if (!f.name.trim() || !f.body.trim()) return; onSave({ ...f, id: f.id || genId() }); }} variant="primary">💾 保存</Btn>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// TODAY TAB
// ─────────────────────────────────────────────
function TodayTab({ leads, onLeadClick }) {
  const overdue = leads.filter(l => isOverdue(l.nextActionDate) && !["closed","lost"].includes(l.status));
  const dueToday = leads.filter(l => isDueToday(l.nextActionDate));
  const highPri = leads.filter(l => l.priority === "高" && !["closed","lost"].includes(l.status) && !isDueToday(l.nextActionDate) && !isOverdue(l.nextActionDate));

  const LeadRow = ({ lead, accent }) => (
    <div onClick={() => onLeadClick(lead)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
      borderRadius: 10, border: `1.5px solid ${accent}30`, background: `${accent}08`,
      cursor: "pointer", transition: "all 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = `${accent}15`}
      onMouseLeave={e => e.currentTarget.style.background = `${accent}08`}
    >
      <PriBadge p={lead.priority} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{lead.name}</div>
        {lead.nextAction && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>📌 {lead.nextAction}</div>}
      </div>
      <Badge status={lead.status} />
      {lead.nextActionDate && <span style={{ fontSize: 11, color: accent, fontWeight: 700, whiteSpace: "nowrap" }}>{fmtDate(lead.nextActionDate)}</span>}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Left */}
      <div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>🚨</span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#ef4444" }}>期日超過 ({overdue.length}件)</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overdue.length === 0 ? <Empty text="期日超過なし ✅" /> : overdue.map(l => <LeadRow key={l.id} lead={l} accent="#ef4444" />)}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#6366f1" }}>今日のタスク ({dueToday.length}件)</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dueToday.length === 0 ? <Empty text="今日のタスクなし" /> : dueToday.map(l => <LeadRow key={l.id} lead={l} accent="#6366f1" />)}
          </div>
        </div>
      </div>
      {/* Right */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>🔥</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#f59e0b" }}>高優先度リード ({highPri.length}件)</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {highPri.length === 0 ? <Empty text="高優先度リードなし" /> : highPri.map(l => <LeadRow key={l.id} lead={l} accent="#f59e0b" />)}
        </div>
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0ea5e9" }}>本日の概況</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "全リード", value: leads.length, color: "#6366f1" },
              { label: "追客中", value: leads.filter(l => !["closed","lost"].includes(l.status)).length, color: "#f59e0b" },
              { label: "今月成約", value: leads.filter(l => l.status === "closed" && l.updatedAt?.startsWith(new Date().toISOString().slice(0,7))).length, color: "#10b981" },
              { label: "今月失注", value: leads.filter(l => l.status === "lost" && l.updatedAt?.startsWith(new Date().toISOString().slice(0,7))).length, color: "#ef4444" },
            ].map(s => (
              <div key={s.label} style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1.5px solid #e2e8f0", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ textAlign: "center", padding: "20px 0", color: "#cbd5e1", fontSize: 13 }}>{text}</div>;
}

// ─────────────────────────────────────────────
// KPI TAB
// ─────────────────────────────────────────────
function KpiTab({ leads }) {
  const total = leads.length;
  const closed = leads.filter(l => l.status === "closed").length;
  const lost = leads.filter(l => l.status === "lost").length;
  const convRate = total > 0 ? Math.round((closed / total) * 100) : 0;

  // Source breakdown
  const sourceData = SOURCES.map(s => ({
    source: s,
    total: leads.filter(l => l.source === s).length,
    closed: leads.filter(l => l.source === s && l.status === "closed").length,
  })).filter(s => s.total > 0);

  // Status breakdown
  const statusData = Object.entries(STATUS_CONFIG).map(([k, c]) => ({
    key: k, label: c.label, color: c.color, count: leads.filter(l => l.status === k).length,
  }));

  const maxSource = Math.max(...sourceData.map(s => s.total), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Left */}
      <div>
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>全体KPI</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "総リード", value: total, color: "#6366f1", icon: "👥" },
            { label: "成約率", value: `${convRate}%`, color: "#10b981", icon: "📈" },
            { label: "成約数", value: closed, color: "#059669", icon: "🎉" },
            { label: "失注数", value: lost, color: "#ef4444", icon: "❌" },
          ].map(s => (
            <div key={s.label} style={{ padding: "16px", borderRadius: 12, background: "#fff", border: "1.5px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>流入元別</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sourceData.length === 0 ? <Empty text="データなし" /> : sourceData.map(s => (
            <div key={s.source} style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1.5px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{s.source}</span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.closed}/{s.total}件成約</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(s.total / maxSource) * 100}%`, background: "linear-gradient(90deg, #6366f1, #818cf8)", borderRadius: 3, transition: "width 0.5s ease" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right */}
      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>ステータス別件数</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {statusData.map(s => {
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
            return (
              <div key={s.key} style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", border: `1.5px solid ${s.color}20` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{STATUS_CONFIG[s.key].icon} {s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>{s.count}<span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: s.color, borderRadius: 3, transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TEMPLATES TAB
// ─────────────────────────────────────────────
function TemplatesTab({ templates, leads, properties, onEdit, onDelete }) {
  const [selected, setSelected] = useState(null);
  const [leadId, setLeadId] = useState("");
  const [copied, setCopied] = useState(false);

  const lead = leads.find(l => l.id === leadId);
  const property = lead ? properties.find(p => p.id === lead.propertyId) : null;

  const preview = selected
    ? selected.body
        .replace(/{{name}}/g, lead?.name || "{{name}}")
        .replace(/{{property}}/g, property?.name || lead?.assignedProperty || "{{property}}")
    : "";

  const copy = () => {
    navigator.clipboard.writeText(preview).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const categories = [...new Set(templates.map(t => t.category))];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>テンプレ一覧</h3>
        </div>
        {categories.map(cat => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", marginBottom: 8 }}>{cat}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {templates.filter(t => t.category === cat).map(t => (
                <div key={t.id} onClick={() => setSelected(t)} style={{
                  padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${selected?.id === t.id ? "#6366f1" : "#e2e8f0"}`,
                  background: selected?.id === t.id ? "#eef2ff" : "#fff",
                  transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{t.name}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); onEdit(t); }} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, color: "#94a3b8" }}>✏️</button>
                      <button onClick={e => { e.stopPropagation(); onDelete(t.id); }} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, color: "#94a3b8" }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div>
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>プレビュー & 差し込み</h3>
        {selected ? (
          <>
            <Field label="顧客を選択（差し込み）">
              <Sel value={leadId} onChange={e => setLeadId(e.target.value)}
                options={[{ value: "", label: "顧客を選択…" }, ...leads.map(l => ({ value: l.id, label: l.name }))]} />
            </Field>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1.5px solid #e2e8f0", fontSize: 13, lineHeight: 1.9, color: "#334155", whiteSpace: "pre-wrap", minHeight: 160, marginBottom: 12 }}>
              {preview}
            </div>
            <Btn onClick={copy} variant="success">{copied ? "✅ コピー完了！" : "📋 コピーする"}</Btn>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#cbd5e1", fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            テンプレを選択してください
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LEADS TAB
// ─────────────────────────────────────────────
function LeadsTab({ leads, properties, onLeadClick, onNew, onDelete }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState("updatedAt");

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    return (!q || l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.area?.toLowerCase().includes(q) || l.assignedProperty?.toLowerCase().includes(q))
      && (filterStatus === "all" || l.status === filterStatus)
      && (filterPriority === "all" || l.priority === filterPriority);
  }).sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
    if (sortBy === "nextActionDate") return (a.nextActionDate || "9999") > (b.nextActionDate || "9999") ? 1 : -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return (
    <>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 名前・物件・エリアで検索"
          style={{ ...inputStyle, flex: "1 1 180px", width: "auto" }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
          <option value="all">全ステータス</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.icon} {c.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
          <option value="all">全優先度</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inputStyle, width: "auto", cursor: "pointer" }}>
          <option value="updatedAt">更新順</option>
          <option value="nextActionDate">期日順</option>
          <option value="name">名前順</option>
        </select>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{filtered.length}件</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              {["","氏名","ステータス","流入元","予算","提案物件","次回アクション","更新",""].map((h, i) => (
                <th key={i} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 48, color: "#cbd5e1" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>リードなし
              </td></tr>
            ) : filtered.map((l, i) => {
              const prop = properties.find(p => p.id === l.propertyId);
              const overdue = isOverdue(l.nextActionDate);
              const due = isDueToday(l.nextActionDate);
              return (
                <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9", background: overdue ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#fafbfc", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#eef2ff"}
                  onMouseLeave={e => e.currentTarget.style.background = overdue ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#fafbfc"}
                >
                  <td style={{ padding: "10px 12px" }}><PriBadge p={l.priority} /></td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#0f172a", cursor: "pointer" }} onClick={() => onLeadClick(l)}>{l.name}</td>
                  <td style={{ padding: "10px 12px" }}><Badge status={l.status} /></td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>{l.source || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>{l.budget || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prop?.name || l.assignedProperty || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {l.nextAction ? (
                      <div>
                        <div style={{ color: overdue ? "#ef4444" : due ? "#6366f1" : "#334155", fontWeight: overdue || due ? 700 : 400 }}>{l.nextAction}</div>
                        {l.nextActionDate && <div style={{ fontSize: 11, color: overdue ? "#ef4444" : "#94a3b8", fontWeight: overdue ? 700 : 400 }}>{overdue ? "⚠️ " : due ? "📅 " : ""}{fmtDate(l.nextActionDate)}</div>}
                      </div>
                    ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>{fmtDate(l.updatedAt)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn onClick={() => onLeadClick(l)} variant="secondary" small>編集</Btn>
                      <Btn onClick={() => onDelete(l)} variant="danger" small>削除</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// PROPERTIES TAB
// ─────────────────────────────────────────────
function PropertiesTab({ properties, leads, onEdit, onDelete }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
      {properties.length === 0 && <Empty text="物件が登録されていません" />}
      {properties.map(p => {
        const inquiries = leads.filter(l => l.propertyId === p.id).length;
        return (
          <div key={p.id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "16px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: p.vacant ? "linear-gradient(90deg, #10b981, #34d399)" : "#e2e8f0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, marginTop: 4 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 2 }}>{p.name}</div>
                {p.address && <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.address}</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: p.vacant ? "#d1fae5" : "#f3f4f6", color: p.vacant ? "#059669" : "#9ca3af" }}>
                {p.vacant ? "空室" : "埋まり"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              {[["家賃", p.rent], ["間取り", p.layout], ["面積", p.area], ["最寄り", p.nearStation]].map(([k, v]) => v ? (
                <div key={k} style={{ fontSize: 12, color: "#64748b" }}><span style={{ color: "#94a3b8", fontSize: 10 }}>{k} </span>{v}</div>
              ) : null)}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {p.pet && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: "#fef3c7", color: "#92400e" }}>🐾 ペット可</span>}
              {p.parking && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: "#eff6ff", color: "#1d4ed8" }}>🚗 駐車場</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>問い合わせ {inquiries}件</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn onClick={() => onEdit(p)} variant="secondary" small>編集</Btn>
                <Btn onClick={() => onDelete(p.id)} variant="danger" small>削除</Btn>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// CONFIRM DELETE MODAL
// ─────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 320, textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>削除の確認</div>
        <div style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Btn onClick={onCancel} variant="secondary">キャンセル</Btn>
          <Btn onClick={onConfirm} variant="danger">削除する</Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const [leadModal, setLeadModal] = useState(null);
  const [propModal, setPropModal] = useState(null);
  const [tmplModal, setTmplModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    Promise.all([load(STORAGE_KEYS.leads), load(STORAGE_KEYS.properties), load(STORAGE_KEYS.templates)]).then(([l, p, t]) => {
      if (l) setLeads(l);
      if (p) setProperties(p);
      if (t) setTemplates(t);
      setLoading(false);
    });
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Lead ops
  const saveLead = async (lead) => {
    const next = lead.id && leads.find(l => l.id === lead.id)
      ? leads.map(l => l.id === lead.id ? lead : l)
      : [...leads, lead];
    setLeads(next); await save(STORAGE_KEYS.leads, next);
    setLeadModal(null); showToast("リードを保存しました");
  };
  const deleteLead = async (id) => {
    const next = leads.filter(l => l.id !== id);
    setLeads(next); await save(STORAGE_KEYS.leads, next);
    showToast("削除しました", "error");
  };

  // Property ops
  const saveProp = async (prop) => {
    const next = prop.id && properties.find(p => p.id === prop.id)
      ? properties.map(p => p.id === prop.id ? prop : p)
      : [...properties, prop];
    setProperties(next); await save(STORAGE_KEYS.properties, next);
    setPropModal(null); showToast("物件を保存しました");
  };
  const deleteProp = async (id) => {
    const next = properties.filter(p => p.id !== id);
    setProperties(next); await save(STORAGE_KEYS.properties, next);
    showToast("削除しました", "error");
  };

  // Template ops
  const saveTmpl = async (t) => {
    const next = t.id && templates.find(x => x.id === t.id)
      ? templates.map(x => x.id === t.id ? t : x)
      : [...templates, t];
    setTemplates(next); await save(STORAGE_KEYS.templates, next);
    setTmplModal(null); showToast("テンプレを保存しました");
  };
  const deleteTmpl = async (id) => {
    const next = templates.filter(t => t.id !== id);
    setTemplates(next); await save(STORAGE_KEYS.templates, next);
    showToast("削除しました", "error");
  };

  const todayOverdue = leads.filter(l => (isOverdue(l.nextActionDate) || isDueToday(l.nextActionDate)) && !["closed","lost"].includes(l.status)).length;

  const actionButton = {
    leads: { label: "＋ 新規リード", onClick: () => setLeadModal({ ...EMPTY_LEAD }) },
    properties: { label: "＋ 新規物件", onClick: () => setPropModal({ ...EMPTY_PROPERTY }) },
    templates: { label: "＋ 新規テンプレ", onClick: () => setTmplModal(null) },
  }[activeTab];

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif", color: "#0f172a" }}>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:none; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:#f1f5f9; border-radius:3px; }
        ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {confirmDel && (
        <ConfirmModal
          message={confirmDel.message}
          onConfirm={() => { confirmDel.action(); setConfirmDel(null); }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      {leadModal !== null && (
        <LeadModal lead={leadModal} properties={properties} templates={templates}
          onSave={saveLead} onClose={() => setLeadModal(null)} showToast={showToast} />
      )}
      {propModal !== null && (
        <PropertyModal property={propModal} onSave={saveProp} onClose={() => setPropModal(null)} />
      )}
      {tmplModal !== undefined && tmplModal !== null && (
        <TemplateModal template={tmplModal} onSave={saveTmpl} onClose={() => setTmplModal(undefined)} />
      )}
      {tmplModal === null && activeTab === "templates" && (
        <TemplateModal template={null} onSave={saveTmpl} onClose={() => setTmplModal(undefined)} />
      )}

      {/* Header */}
      <header style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "0 16px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 20px rgba(0,0,0,0.25)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🏢</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>不動産CRM</span>
        </div>
        <nav style={{ display: "flex", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: activeTab === t.id ? "rgba(99,102,241,0.9)" : "rgba(255,255,255,0.08)",
              color: activeTab === t.id ? "#fff" : "#94a3b8",
              transition: "all 0.15s", position: "relative",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 44,
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontSize: 10 }}>{t.label}</span>
              {t.id === "today" && todayOverdue > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{todayOverdue}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Floating Action Button */}
      <button
        onClick={() => setLeadModal({ ...EMPTY_LEAD })}
        style={{
          position: "fixed", bottom: 24, right: 20, zIndex: 200,
          width: 56, height: 56, borderRadius: "50%", border: "none",
          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          color: "#fff", fontSize: 28, fontWeight: 300, cursor: "pointer",
          boxShadow: "0 6px 20px rgba(99,102,241,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(99,102,241,0.65)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(99,102,241,0.5)"; }}
        title="新規リード登録"
      >＋</button>

      {/* Main */}
      <main style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}>読み込み中…</div>
        ) : (
          <>
            {activeTab === "today" && <TodayTab leads={leads} onLeadClick={setLeadModal} />}
            {activeTab === "leads" && (
              <LeadsTab leads={leads} properties={properties}
                onLeadClick={setLeadModal}
                onNew={() => setLeadModal({ ...EMPTY_LEAD })}
                onDelete={l => setConfirmDel({ message: `「${l.name}」を削除します。`, action: () => deleteLead(l.id) })}
              />
            )}
            {activeTab === "properties" && (
              <PropertiesTab properties={properties} leads={leads}
                onEdit={setPropModal}
                onDelete={id => setConfirmDel({ message: "この物件を削除します。", action: () => deleteProp(id) })}
              />
            )}
            {activeTab === "kpi" && <KpiTab leads={leads} />}
            {activeTab === "templates" && (
              <TemplatesTab
                templates={templates} leads={leads} properties={properties}
                onEdit={t => setTmplModal(t)}
                onDelete={id => setConfirmDel({ message: "このテンプレを削除します。", action: () => deleteTmpl(id) })}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
