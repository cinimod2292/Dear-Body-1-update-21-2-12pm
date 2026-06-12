import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { LoadingState } from "../components/AdminState";
import { toast } from "sonner";

interface CollectionWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label?: string;
}

interface CollectionSchedule {
  windows: CollectionWindow[];
  timezone: string;
  cutoffMinutesBefore: number;
  enabled: boolean;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_SCHEDULE: CollectionSchedule = {
  windows: [],
  timezone: "Africa/Johannesburg",
  cutoffMinutesBefore: 60,
  enabled: true,
};

type Tab = "warehouse" | "pudo";

// ─── Shared schedule form ──────────────────────────────────────────────────

interface ScheduleFormProps {
  schedule: CollectionSchedule;
  onChange: (s: CollectionSchedule) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  description: string;
  howItWorks: string[];
}

function ScheduleForm({ schedule, onChange, onSave, onReset, saving, description, howItWorks }: ScheduleFormProps) {
  const [preview, setPreview] = useState<{ windowLabel: string; collectionDate: string; slaDeadline: string } | null>(null);

  const addWindow = () =>
    onChange({ ...schedule, windows: [...schedule.windows, { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }] });

  const removeWindow = (idx: number) =>
    onChange({ ...schedule, windows: schedule.windows.filter((_, i) => i !== idx) });

  const updateWindow = (idx: number, field: keyof CollectionWindow, value: string | number) =>
    onChange({ ...schedule, windows: schedule.windows.map((w, i) => (i === idx ? { ...w, [field]: value } : w)) });

  const calculatePreview = () => {
    if (schedule.windows.length === 0) { setPreview(null); return; }
    const now = new Date();
    const cutoffMs = schedule.cutoffMinutesBefore * 60 * 1000;
    const sorted = [...schedule.windows].sort((a, b) => {
      const da = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
      const db = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
      return da - db;
    });
    for (let offset = 0; offset <= 14; offset++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + offset);
      const dow = candidate.getDay();
      for (const w of sorted) {
        if (w.dayOfWeek !== dow) continue;
        const [sh, sm] = w.startTime.split(":").map(Number);
        const windowStart = new Date(candidate);
        windowStart.setHours(sh, sm, 0, 0);
        const cutoff = new Date(windowStart.getTime() - cutoffMs);
        if (now >= cutoff) continue;
        const [eh, em] = w.endTime.split(":").map(Number);
        const windowEnd = new Date(candidate);
        windowEnd.setHours(eh, em, 0, 0);
        setPreview({
          windowLabel: `${DAY_NAMES[w.dayOfWeek]} ${w.startTime}–${w.endTime}`,
          collectionDate: windowStart.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          slaDeadline: cutoff.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        });
        return;
      }
    }
    setPreview(null);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">{description}</p>

      {/* Enable toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">Enable Schedule</p>
          <p className="text-sm text-gray-500">When disabled, the system falls back to the current time</p>
        </div>
        <button
          onClick={() => onChange({ ...schedule, enabled: !schedule.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${schedule.enabled ? "bg-pink-600" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${schedule.enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* Cutoff */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Cutoff Setting</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 w-64">Minutes before window start to stop assigning orders:</label>
          <input
            type="number" min={0} max={480}
            value={schedule.cutoffMinutesBefore}
            onChange={(e) => onChange({ ...schedule, cutoffMinutesBefore: Number(e.target.value) })}
            className="w-24 border rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-sm text-gray-400">minutes</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          E.g., cutoff of 60 min with a 09:00 window means orders placed after 08:00 roll to the next window.
        </p>
      </div>

      {/* Windows */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Time Windows</h2>
          <button onClick={addWindow} className="px-3 py-1.5 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700">
            + Add Window
          </button>
        </div>
        {schedule.windows.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No windows configured. Add at least one.</p>
        )}
        <div className="space-y-3">
          {schedule.windows.map((w, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg flex-wrap">
              <select
                value={w.dayOfWeek}
                onChange={(e) => updateWindow(idx, "dayOfWeek", Number(e.target.value))}
                className="border rounded px-2 py-1.5 text-sm bg-white"
              >
                {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
              <input type="time" value={w.startTime} onChange={(e) => updateWindow(idx, "startTime", e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white" />
              <span className="text-gray-400">–</span>
              <input type="time" value={w.endTime} onChange={(e) => updateWindow(idx, "endTime", e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white" />
              <input
                type="text" value={w.label ?? ""} placeholder="Label (optional)"
                onChange={(e) => updateWindow(idx, "label", e.target.value)}
                className="border rounded px-2 py-1.5 text-sm bg-white flex-1 min-w-24"
              />
              <button onClick={() => removeWindow(idx)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Preview Next Window</h2>
          <button onClick={calculatePreview} className="px-3 py-1.5 text-sm border rounded text-gray-700 hover:bg-gray-50">
            Calculate
          </button>
        </div>
        {preview ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Next Window:</span>
              <span className="font-medium">{preview.windowLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Opens At:</span>
              <span className="font-medium">{preview.collectionDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cutoff (SLA Deadline):</span>
              <span className="font-medium text-orange-600">{preview.slaDeadline}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Click Calculate to preview the next window based on current settings.</p>
        )}
      </div>

      {/* How it works */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
        <h3 className="font-semibold text-blue-900 mb-2 text-sm">How It Works</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          {howItWorks.map((line, i) => <li key={i}>• {line}</li>)}
        </ul>
      </div>

      <div className="flex gap-3">
        <button onClick={onSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 disabled:opacity-50">
          {saving ? "Saving..." : "Save Schedule"}
        </button>
        <button onClick={onReset} disabled={saving} className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
          Reset
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Warehouse Collection ─────────────────────────────────────────────

function WarehouseCollectionTab() {
  const { session } = useAdminAuth();
  const [schedule, setSchedule] = useState<CollectionSchedule>(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ data: CollectionSchedule | null }>("/admin/fulfillment/collection-schedule", {}, session.accessToken);
      if (res.data) setSchedule(res.data);
    } catch {
      // no schedule yet — use defaults
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!session?.accessToken) return;
    setSaving(true);
    try {
      await apiRequest("/admin/fulfillment/collection-schedule", { method: "PUT", body: JSON.stringify(schedule) }, session.accessToken);
      toast.success("Warehouse collection schedule saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading schedule..." />;

  return (
    <ScheduleForm
      schedule={schedule}
      onChange={setSchedule}
      onSave={save}
      onReset={load}
      saving={saving}
      description="Define when customers can collect their orders from your warehouse. The system assigns every new paid collection order to the next available window and shows the time in the customer's confirmation email."
      howItWorks={[
        "When an order is paid, the next available window is assigned automatically",
        `The SLA deadline is set to ${schedule.cutoffMinutesBefore} minutes before window start`,
        "The collection time is shown in the customer's 'order ready' email",
        "Warehouse staff see a countdown timer and SLA indicator per order",
        "Staff can manually recalculate if a collection window is missed",
      ]}
    />
  );
}

// ─── Tab: PUDO Pickup ──────────────────────────────────────────────────────

function PudoPickupTab() {
  const { session } = useAdminAuth();
  const [schedule, setSchedule] = useState<CollectionSchedule>(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ data: CollectionSchedule | null }>("/admin/fulfillment/pudo-pickup-schedule", {}, session.accessToken);
      if (res.data) setSchedule(res.data);
    } catch {
      // no schedule yet — use defaults
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!session?.accessToken) return;
    setSaving(true);
    try {
      await apiRequest("/admin/fulfillment/pudo-pickup-schedule", { method: "PUT", body: JSON.stringify(schedule) }, session.accessToken);
      toast.success("PUDO pickup schedule saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading schedule..." />;

  return (
    <ScheduleForm
      schedule={schedule}
      onChange={setSchedule}
      onSave={save}
      onReset={load}
      saving={saving}
      description="Define when PUDO – The Courier Guy collects parcels from your warehouse. This schedule is used to calculate the SLA deadline for packing orders before the PUDO driver arrives."
      howItWorks={[
        "When an order is paid, the next PUDO pickup window is assigned as the SLA deadline",
        `Orders must be packed ${schedule.cutoffMinutesBefore} minutes before the window start`,
        "Warehouse staff see a countdown per order based on this schedule",
        "Typically set to match your agreed PUDO collection times (e.g. Mon–Fri 14:00–15:00)",
        "Staff can manually recalculate if a pickup window is missed",
      ]}
    />
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AdminCollectionSchedule() {
  const [tab, setTab] = useState<Tab>("warehouse");

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Collection Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure collection windows for warehouse customer pickups and PUDO courier pickups.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab("warehouse")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition ${tab === "warehouse" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          Warehouse Collection
        </button>
        <button
          onClick={() => setTab("pudo")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition ${tab === "pudo" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          PUDO Pickup
        </button>
      </div>

      {tab === "warehouse" && <WarehouseCollectionTab />}
      {tab === "pudo" && <PudoPickupTab />}
    </div>
  );
}
