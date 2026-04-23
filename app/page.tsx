"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Profile types ─────────────────────────────────────────────────────────────

interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  website: string;
  city: string;
  country: string;
  salary: string;
  yearsOfExperience: string;
  workAuthorized: string;       // "yes" | "no" | ""
  requiresSponsorship: string;  // "yes" | "no" | ""
  builtLlmInterfaces: string;   // "yes" | "no" | ""
  aiProjectDescription: string;
  coverLetter: string;
}

const DEFAULT_PROFILE: Profile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedin: "",
  github: "",
  website: "",
  city: "",
  country: "",
  salary: "",
  yearsOfExperience: "",
  workAuthorized: "",
  requiresSponsorship: "",
  builtLlmInterfaces: "",
  aiProjectDescription: "",
  coverLetter: "",
};

// ── Content script (injected into target tab) ─────────────────────────────────
// Must be fully self-contained — no closures, no imports.

function fillFormOnPage(profile: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  website: string;
  city: string;
  country: string;
  salary: string;
  yearsOfExperience: string;
  workAuthorized: string;
  requiresSponsorship: string;
  builtLlmInterfaces: string;
  aiProjectDescription: string;
  coverLetter: string;
}): { filled: number } {

  // ── Label resolution ─────────────────────────────────────────────────────

  function getLabelText(el: Element): string {
    // 1. Standard <label for="id">
    const id = el.getAttribute("id");
    if (id) {
      try {
        const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lbl) return stripInputText(lbl);
      } catch {}
    }

    // 2. Input nested inside <label>
    const parentLabel = el.closest("label");
    if (parentLabel) return stripInputText(parentLabel);

    // 3. Preceding sibling <label> (same parent)
    let sib = el.previousElementSibling;
    while (sib) {
      if (sib.tagName === "LABEL") return (sib.textContent ?? "").trim().toLowerCase();
      // also accept div/p/span that looks like a label (no inputs inside)
      if (!sib.querySelector("input,select,textarea")) {
        const t = (sib.textContent ?? "").trim();
        if (t.length > 0 && t.length < 120) return t.toLowerCase();
      }
      sib = sib.previousElementSibling;
    }

    // 4. label/legend/p inside the nearest container (up to 4 levels)
    let ancestor: Element | null = el.parentElement;
    for (let depth = 0; depth < 4 && ancestor; depth++) {
      // Prefer <legend> (fieldset pattern)
      const legend = ancestor.querySelector("legend");
      if (legend) return (legend.textContent ?? "").trim().toLowerCase();

      // Prefer <label> that isn't for one of the radio/checkbox options
      const labels = ancestor.querySelectorAll("label");
      for (const lbl of labels) {
        // Skip labels that are direct wrappers for inputs within this ancestor
        if (lbl.querySelector("input,select,textarea")) continue;
        // Skip labels whose `for` points to a child of this ancestor
        const forId = lbl.getAttribute("for");
        if (forId && ancestor.querySelector(`#${CSS.escape(forId)}`)) continue;
        const t = (lbl.textContent ?? "").trim();
        if (t.length > 0) return t.toLowerCase();
      }

      // Fall back: a preceding sibling of the current ancestor
      const prevSib = ancestor.previousElementSibling;
      if (prevSib && !prevSib.querySelector("input,select,textarea")) {
        const t = (prevSib.textContent ?? "").trim();
        if (t.length > 0 && t.length < 200) return t.toLowerCase();
      }

      ancestor = ancestor.parentElement;
    }

    return "";
  }

  function stripInputText(el: Element): string {
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll("input,select,textarea").forEach((c) => c.remove());
    return (clone.textContent ?? "").trim().toLowerCase();
  }

  // ── Attribute string for an element ──────────────────────────────────────

  function getAttrs(el: Element): string {
    return [
      el.getAttribute("id") ?? "",
      el.getAttribute("name") ?? "",
      el.getAttribute("placeholder") ?? "",
      el.getAttribute("aria-label") ?? "",
      el.getAttribute("autocomplete") ?? "",
      el.getAttribute("data-field") ?? "",
      getLabelText(el),
    ]
      .join(" ")
      .toLowerCase();
  }

  // ── Field detection ───────────────────────────────────────────────────────

  type FieldKey = keyof typeof profile;

  function detectTextField(el: Element): FieldKey | null {
    const a = getAttrs(el);
    if (/first[-_\s]?name|fname|given[-_\s]?name/.test(a)) return "firstName";
    if (/last[-_\s]?name|lname|surname|family[-_\s]?name/.test(a)) return "lastName";
    // email: no trailing \b so email_id / email_address all match
    if (/email/.test(a)) return "email";
    if (/phone|mobile|telephone|cell\b/.test(a)) return "phone";
    if (/\btel\b/.test(a) && !/hotel/.test(a)) return "phone";
    if (/linkedin/.test(a)) return "linkedin";
    if (/github/.test(a)) return "github";
    if (/website|portfolio|personal[-_\s]?url|personal[-_\s]?site/.test(a)) return "website";
    if (/cover[-_\s]?letter/.test(a)) return "coverLetter";
    if (/\bcity\b|\blocality\b/.test(a)) return "city";
    if (/\bcountry\b/.test(a)) return "country";
    if (/salary|compensation|\bpay\b|wage|rate|hourly/.test(a)) return "salary";
    if (/years.*experience|experience.*years|yrs.*exp/.test(a)) return "yearsOfExperience";
    if (/ai.{0,30}tool|cursor.*copilot|copilot.*claude|describe.*project.*ai|ai.*project.*describe|how did ai change/.test(a)) return "aiProjectDescription";
    return null;
  }

  function detectYesNoField(questionText: string): FieldKey | null {
    const q = questionText.toLowerCase();
    if (/authoriz|legally.*work|eligible.*work|right.*work|work.*permit/.test(q)) return "workAuthorized";
    if (/sponsor|visa|immigration/.test(q)) return "requiresSponsorship";
    if (/llm\s*api|streaming\s*response|chat\s*ui/.test(q)) return "builtLlmInterfaces";
    return null;
  }

  // ── Value setters ─────────────────────────────────────────────────────────

  function setInputValue(el: Element, value: string): boolean {
    if (!value) return false;

    if (el.tagName === "SELECT") {
      const select = el as HTMLSelectElement;
      const opts = Array.from(select.options);
      const match =
        opts.find((o) => o.text.toLowerCase() === value.toLowerCase()) ??
        opts.find((o) => o.text.toLowerCase().startsWith(value.toLowerCase())) ??
        opts.find((o) => o.text.toLowerCase().includes(value.toLowerCase())) ??
        opts.find((o) => o.value.toLowerCase() === value.toLowerCase());
      if (!match) return false;
      select.value = match.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    const isTextarea = el.tagName === "TEXTAREA";
    const proto = isTextarea
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) {
      descriptor.set.call(el, value);
    } else {
      (el as HTMLInputElement).value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // ── Fill text / select / textarea inputs ─────────────────────────────────

  let filled = 0;

  const textInputs = document.querySelectorAll(
    "input:not([type=hidden]):not([type=submit]):not([type=button])" +
    ":not([type=file]):not([type=checkbox]):not([type=radio])," +
    "textarea, select"
  );

  textInputs.forEach((el) => {
    const field = detectTextField(el);
    if (field && profile[field] && setInputValue(el, profile[field])) {
      filled++;
    }
  });

  // ── Fill radio button groups (yes/no questions) ───────────────────────────

  // Group all radio inputs by their `name` attribute
  const radioGroups = new Map<string, HTMLInputElement[]>();
  document.querySelectorAll("input[type=radio]").forEach((el) => {
    const name = el.getAttribute("name");
    if (!name) return;
    if (!radioGroups.has(name)) radioGroups.set(name, []);
    radioGroups.get(name)!.push(el as HTMLInputElement);
  });

  radioGroups.forEach((radios) => {
    // Find the question text: look for a label/heading near the radio group's
    // common ancestor that isn't one of the per-option labels
    const optionIds = new Set(radios.map((r) => r.getAttribute("id")).filter(Boolean));

    function findGroupQuestion(): string {
      if (!radios.length) return "";
      let ancestor: Element | null = radios[0].parentElement;
      for (let depth = 0; depth < 6 && ancestor; depth++) {
        // <legend> is the canonical pattern for radio group labels
        const legend = ancestor.querySelector("legend");
        if (legend) return (legend.textContent ?? "").trim().toLowerCase();

        // Find labels that are NOT per-option labels
        const allLabels = ancestor.querySelectorAll("label");
        for (const lbl of allLabels) {
          const forId = lbl.getAttribute("for") ?? "";
          if (optionIds.has(forId)) continue;           // skip option labels
          if (lbl.querySelector("input,select,textarea")) continue;
          const t = (lbl.textContent ?? "").trim();
          if (t.length > 4) return t.toLowerCase();
        }

        // A preceding sibling of the current ancestor
        const prevSib = ancestor.previousElementSibling;
        if (prevSib && !prevSib.querySelector("input,select,textarea")) {
          const t = (prevSib.textContent ?? "").trim();
          if (t.length > 4 && t.length < 300) return t.toLowerCase();
        }

        ancestor = ancestor.parentElement;
      }
      return "";
    }

    const questionText = findGroupQuestion();
    const field = detectYesNoField(questionText);
    if (!field || !profile[field]) return;

    const target = profile[field].toLowerCase().trim(); // "yes" or "no"
    const radio = radios.find((r) => {
      const val = (r.getAttribute("value") ?? "").toLowerCase();
      const labelText = getLabelText(r).toLowerCase();
      return val === target || labelText === target || labelText.startsWith(target);
    });

    if (radio && !radio.checked) {
      radio.click();
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      filled++;
    }
  });

  return { filled };
}

// ── Field definitions (popup form) ───────────────────────────────────────────

type FieldDef =
  | { key: keyof Profile; label: string; type?: string }
  | { key: keyof Profile; label: string; select: true; options: string[]; emptyLabel: string }
  | { key: keyof Profile; label: string; textarea: true; rows: number };

// Default select options — overridable from config.json > selectOptions
const DEFAULT_SELECT_OPTIONS: Record<string, { options: string[]; emptyLabel: string }> = {
  workAuthorized:      { options: ["Yes", "No"],          emptyLabel: "---" },
  requiresSponsorship: { options: ["Yes", "No"],          emptyLabel: "---" },
  builtLlmInterfaces:  { options: ["Yes", "No"],          emptyLabel: "---" },
};

function buildFields(
  selectOptions: Record<string, { options?: string[]; emptyLabel?: string }>
): FieldDef[] {
  function sel(
    key: keyof Profile,
    label: string
  ): FieldDef {
    const base = DEFAULT_SELECT_OPTIONS[key] ?? { options: ["Yes", "No"], emptyLabel: "---" };
    const cfg  = selectOptions[key] ?? {};
    return {
      key,
      label,
      select: true,
      options:    cfg.options    ?? base.options,
      emptyLabel: cfg.emptyLabel ?? base.emptyLabel,
    };
  }

  return [
    { key: "firstName",        label: "First name" },
    { key: "lastName",         label: "Last name" },
    { key: "email",            label: "Email",                 type: "email" },
    { key: "phone",            label: "Phone",                 type: "tel" },
    { key: "linkedin",         label: "LinkedIn URL",          type: "url" },
    { key: "github",           label: "GitHub URL",            type: "url" },
    { key: "website",          label: "Website / Portfolio",   type: "url" },
    { key: "city",             label: "City" },
    { key: "country",          label: "Country" },
    { key: "salary",           label: "Expected salary / rate" },
    { key: "yearsOfExperience",label: "Years of experience",   type: "number" },
    sel("workAuthorized",      "Authorized to work?"),
    sel("requiresSponsorship", "Requires visa sponsorship?"),
    sel("builtLlmInterfaces",  "Built LLM API interfaces?"),
    { key: "aiProjectDescription", label: "AI tools project description", textarea: true, rows: 5 },
    { key: "coverLetter",      label: "Cover letter",          textarea: true, rows: 5 },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

type FillStatus = { filled: number } | null;

interface LoadedConfig {
  profileDefaults: Partial<Profile>;
  selectOptions: Record<string, { options?: string[]; emptyLabel?: string }>;
}

async function loadConfig(): Promise<LoadedConfig> {
  try {
    const url = chrome.runtime.getURL("config.json");
    const json = await fetch(url).then((r) => r.json());

    // Extract profile field defaults
    const profileDefaults: Partial<Profile> = {};
    for (const key of Object.keys(DEFAULT_PROFILE) as (keyof Profile)[]) {
      if (typeof json[key] === "string") profileDefaults[key] = json[key];
    }

    // Extract per-field select options (optional section in config.json)
    const selectOptions: Record<string, { options?: string[]; emptyLabel?: string }> = {};
    const raw = json.selectOptions ?? {};
    for (const key of Object.keys(raw)) {
      const entry = raw[key];
      if (entry && typeof entry === "object") {
        selectOptions[key] = {
          options:    Array.isArray(entry.options)    ? entry.options    : undefined,
          emptyLabel: typeof entry.emptyLabel === "string" ? entry.emptyLabel : undefined,
        };
      }
    }

    return { profileDefaults, selectOptions };
  } catch {
    return { profileDefaults: {}, selectOptions: {} };
  }
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [profileDefaults, setProfileDefaults] = useState<Partial<Profile>>({});
  const [fields, setFields] = useState<FieldDef[]>(() => buildFields({}));
  const [saved, setSaved] = useState(false);
  const [fillStatus, setFillStatus] = useState<FillStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load config.json + chrome.storage on mount
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome?.storage) {
      setLoading(false);
      return;
    }
    (async () => {
      const [config, stored] = await Promise.all([
        loadConfig(),
        new Promise<{ profile?: Partial<Profile> }>((resolve) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (chrome.storage.sync.get as any)("profile", resolve)
        ),
      ]);
      setProfileDefaults(config.profileDefaults);
      setFields(buildFields(config.selectOptions));
      // Priority: storage > config.json > hardcoded defaults
      setProfile({ ...DEFAULT_PROFILE, ...config.profileDefaults, ...(stored.profile ?? {}) });
      setLoading(false);
    })();
  }, []);

  const updateField = useCallback((key: keyof Profile, value: string) => {
    setProfile((prev) => {
      const next = { ...prev, [key]: value };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (typeof chrome !== "undefined" && chrome?.storage) {
          chrome.storage.sync.set({ profile: next }, () => {
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
          });
        }
      }, 600);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    const next = { ...DEFAULT_PROFILE, ...profileDefaults };
    setProfile(next);
    if (typeof chrome !== "undefined" && chrome?.storage) {
      chrome.storage.sync.remove("profile", () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      });
    }
  }, [profileDefaults]);

  const handleFill = useCallback(async () => {
    setError(null);
    setFillStatus(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab found.");
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillFormOnPage,
        args: [profile],
      });
      setFillStatus(injection.result as FillStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [profile]);

  if (loading) {
    return (
      <main style={s.main}>
        <p style={{ color: "#aaa", fontSize: 13 }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={s.main}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.title}>JP Filler</span>
        {saved && <span style={s.savedPill}>Saved</span>}
      </div>

      {/* Fill button */}
      <button style={s.fillBtn} onClick={handleFill}>
        Fill page
      </button>

      {/* Reset link */}
      <button style={s.resetBtn} onClick={handleReset}>
        Reset to config defaults
      </button>

      {/* Status / error */}
      {fillStatus !== null && (
        <div
          style={{
            ...s.statusBox,
            borderColor: fillStatus.filled > 0 ? "#22c55e" : "#f59e0b",
            background: fillStatus.filled > 0 ? "#f0fdf4" : "#fffbeb",
            color: fillStatus.filled > 0 ? "#15803d" : "#92400e",
          }}
        >
          {fillStatus.filled > 0
            ? `${fillStatus.filled} field${fillStatus.filled !== 1 ? "s" : ""} filled`
            : "No matching fields found on this page"}
        </div>
      )}
      {error && (
        <div
          style={{
            ...s.statusBox,
            borderColor: "#ef4444",
            background: "#fef2f2",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      <hr style={s.divider} />
      <p style={s.sectionLabel}>Your profile</p>

      <div style={s.form}>
        {fields.map((def) => {
          if ("textarea" in def) {
            return (
              <label key={def.key} style={s.field}>
                <span style={s.fieldLabel}>{def.label}</span>
                <textarea
                  style={{ ...s.input, height: def.rows * 22 }}
                  value={profile[def.key]}
                  onChange={(e) => updateField(def.key, e.target.value)}
                  placeholder={def.label}
                  spellCheck={false}
                />
              </label>
            );
          }

          if ("select" in def) {
            return (
              <label key={def.key} style={s.field}>
                <span style={s.fieldLabel}>{def.label}</span>
                <select
                  style={{ ...s.input, cursor: "pointer" }}
                  value={profile[def.key]}
                  onChange={(e) => updateField(def.key, e.target.value)}
                >
                  {/* empty option */}
                  <option value="">{def.emptyLabel}</option>
                  {def.options.map((o) => (
                    <option key={o} value={o.toLowerCase()}>{o}</option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <label key={def.key} style={s.field}>
              <span style={s.fieldLabel}>{def.label}</span>
              <input
                style={s.input}
                type={def.type ?? "text"}
                value={profile[def.key]}
                onChange={(e) => updateField(def.key, e.target.value)}
                placeholder={def.label}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
          );
        })}
      </div>
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  main: {
    padding: "14px 16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111",
    letterSpacing: "-0.01em",
  },
  savedPill: {
    fontSize: 11,
    color: "#16a34a",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 4,
    padding: "2px 7px",
    fontWeight: 500,
  },
  fillBtn: {
    width: "100%",
    padding: "10px 0",
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "-0.01em",
  },
  resetBtn: {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 11,
    color: "#aaa",
    cursor: "pointer",
    textAlign: "left" as const,
    textDecoration: "underline",
    marginTop: -4,
  },
  statusBox: {
    borderRadius: 6,
    border: "1.5px solid",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 500,
  },
  divider: {
    border: "none",
    borderTop: "1px solid #f0f0f0",
    margin: "2px 0",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#aaa",
    marginBottom: 2,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    cursor: "default",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: "#555",
  },
  input: {
    border: "1.5px solid #e5e7eb",
    borderRadius: 6,
    padding: "7px 9px",
    fontSize: 13,
    color: "#111",
    background: "#fafafa",
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical",
    width: "100%",
  },
};
