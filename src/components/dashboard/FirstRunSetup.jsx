import { useMemo, useState } from "react";
import { isSupabaseConfigured, requireSupabase } from "../../lib/supabase";
import { navigate } from "../../routes/AppRouter";
import { readLocalAssets, readLocalLocations, readLocalUsers, saveWorkspace } from "../../lib/localData";

export default function FirstRunSetup({ organization, organizationId, onOrganizationSaved }) {
  const [name, setName] = useState(organization?.name === "منشأتي" ? "" : organization?.name || "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locations = readLocalLocations();
  const users = readLocalUsers();
  const assets = readLocalAssets();
  const steps = useMemo(() => [
    { key: "organization", label: "إعداد المنشأة", complete: Boolean(organization?.name && organization.name !== "منشأتي"), action: () => setEditing(true) },
    { key: "location", label: "إضافة فرع", complete: locations.length > 0, action: () => navigate("/locations") },
    { key: "technician", label: "إضافة فني", complete: users.some((item) => item.role === "TECHNICIAN"), action: () => navigate("/users") },
    { key: "asset", label: "إضافة جهاز", complete: assets.length > 0, action: () => navigate(locations.length ? "/assets/new" : "/locations") },
    { key: "qr", label: "إنشاء QR", complete: assets.some((item) => item.qr_token || item.qrToken) || (isSupabaseConfigured && assets.length > 0), action: () => navigate("/assets") },
  ], [organization?.name, locations.length, users.length, assets.length]);
  const completed = steps.filter((step) => step.complete).length;
  if (completed === steps.length) return null;

  async function saveName(event) {
    event.preventDefault();
    const normalized = name.trim();
    if (normalized.length < 2 || normalized.length > 120) {
      setError("اسم المنشأة يجب أن يكون بين حرفين و120 حرفًا.");
      return;
    }
    setBusy(true); setError("");
    try {
      if (isSupabaseConfigured) {
        const { error: updateError } = await requireSupabase().from("organizations").update({ name: normalized }).eq("id", organizationId);
        if (updateError) throw updateError;
      } else {
        saveWorkspace({ name: normalized, setup_completed: true });
      }
      await onOrganizationSaved?.();
      setEditing(false);
    } catch (saveError) {
      setError(saveError?.message || "تعذر حفظ اسم المنشأة.");
    } finally { setBusy(false); }
  }

  return (
    <section className="panel first-run-setup">
      <div className="panel-head"><div><h2>ابدئي إعداد منشأتك</h2><p>{completed} من {steps.length} خطوات مكتملة</p></div></div>
      <div className="setup-steps">
        {steps.map((step) => <button key={step.key} type="button" className={step.complete ? "setup-step complete" : "setup-step"} onClick={step.action}><span>{step.complete ? "✓" : "○"}</span><strong>{step.label}</strong></button>)}
      </div>
      {editing ? <form className="setup-name-form" onSubmit={saveName}><label>اسم المنشأة<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus /></label>{error ? <div className="form-error">{error}</div> : null}<div className="modal-buttons"><button className="primary" disabled={busy}>حفظ الاسم</button><button type="button" className="secondary" onClick={() => setEditing(false)}>إلغاء</button></div></form> : null}
    </section>
  );
}
