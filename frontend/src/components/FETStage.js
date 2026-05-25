/**
 * Frozen Embryo Transfer (FET) — replaces Culture stage
 * Sub 1: Sample Validation (female details) + Annotated microscopic image (two-column)
 * Sub 2: Remark
 */
import React, { useState, useEffect } from "react";
import { api } from "../api";
import { STAGES } from "../config";
import StageCapture from "./StageCapture";
import ImageCropModal from "./ImageCropModal";
import usePermissionStore from "../store/permissionStore";


const FET_STAGE = STAGES.find(s => s.id === "culture");

const IconCamera = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
  </svg>
);
const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
);

function compressImg(file) {
  return new Promise((resolve) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas"); const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) { if (width > height) { height = Math.round(height * MAX / width); width = MAX; } else { width = Math.round(width * MAX / height); height = MAX; } }
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(new File([blob], file.name.replace(/[.][^.]+$/, ".jpg"), { type: "image/jpeg" })), "image/jpeg", 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function FETStage({ sessionId, caseData, onComplete, onViewStatus }) {
  const { canUploadImage } = usePermissionStore();
  const showUpload = canUploadImage();
  const cultureStatus = caseData?.stages?.culture?.status;
  const [validated, setValidated] = useState(cultureStatus === 'completed' || cultureStatus === 'failed');
  const [annotUploading, setAnnotUploading] = useState(false);
  const [annotProcessing, setAnnotProcessing] = useState(false);
  const [annotatedImages, setAnnotatedImages] = useState([]);
  const [pendingCropFile, setPendingCropFile] = useState(null);
  const [remark, setRemark] = useState("");
  const [existingRemark, setExistingRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [remarkSaved, setRemarkSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);

  // Cryopreservation state - multiple locations
  const emptyLoc = { cryolockId: "", cryolockColor: "", tank: "", canister: "", goblet: "", visoColor: "" };
  const [cryoForm, setCryoForm] = useState(emptyLoc);
  const [cryoLocations, setCryoLocations] = useState([]);
  const [savingCryo, setSavingCryo] = useState(false);
  const [cryoSaved, setCryoSaved] = useState(false);
  // Remaining straws/embryos
  const [remaining, setRemaining] = useState({ straws: "", embryos: "" });
  const [savingRemaining, setSavingRemaining] = useState(false);
  const [remainingSaved, setRemainingSaved] = useState(false);

  useEffect(() => {
    api.getEmbryoStageData(sessionId, "fet").then(d => {
      setRemark(d.remark || "");
      setExistingRemark(d.remark || "");
      if (d.cryoLocations) setCryoLocations(d.cryoLocations);
      if (d.remaining) setRemaining(d.remaining);
    }).catch(() => {});
    api.getAnnotatedImages(sessionId, "fet").then(d => setAnnotatedImages(d.images || [])).catch(() => {});
  }, [sessionId]);

  const handleAnnotCapture = (e) => {
    const rawFile = e.target.files[0]; if (!rawFile) return;
    setPendingCropFile(rawFile);
  };

  const handleCroppedImage = async (croppedFile) => {
    setPendingCropFile(null);
    setAnnotUploading(true); setError(null);
    try {
      const file = await compressImg(croppedFile);
      const num = annotatedImages.length + 1;
      const { uploadUrl } = await api.getPresignedUrlForAnnotatedImage(sessionId, num, "fet");
      await api.uploadImage(uploadUrl, file);
      setAnnotProcessing(true);
      // Poll for annotation
      let attempts = 0;
      const maxAttempts = 90;
      const poll = async () => {
        try {
          const data = await api.getAnnotatedImages(sessionId, "fet");
          const newImage = data.images.find(img => img.oocyte_number === num);
          if (newImage && newImage.annotation_status === 'completed') {
            setAnnotatedImages(data.images || []);
            setAnnotProcessing(false);
            return;
          }
          attempts++;
          if (attempts < maxAttempts) setTimeout(poll, 2000);
          else { setError("Annotation timeout. Please refresh."); setAnnotProcessing(false); }
        } catch (err) { setError(err.message); setAnnotProcessing(false); }
      };
      poll();
    } catch (err) { setError(err.message); setAnnotProcessing(false); } finally { setAnnotUploading(false); }
  };

  const handleSaveRemark = async () => {
    setSavingRemark(true);
    try { await api.saveEmbryoStageData(sessionId, "fet", { remark }); setExistingRemark(remark); setRemarkSaved(true); setTimeout(() => setRemarkSaved(false), 3000); }
    catch { setError("Failed to save remark."); } finally { setSavingRemark(false); }
  };

  const handleSaveCryo = async () => {
    setSavingCryo(true);
    try {
      const updated = [...cryoLocations, cryoForm];
      await api.saveEmbryoStageData(sessionId, "fet", { cryoLocations: updated });
      setCryoLocations(updated);
      setCryoForm(emptyLoc);
      setCryoSaved(true); setTimeout(() => setCryoSaved(false), 3000);
    } catch { setError("Failed to save location."); } finally { setSavingCryo(false); }
  };

  const handleRemoveLocation = async (idx) => {
    const updated = cryoLocations.filter((_, i) => i !== idx);
    setCryoLocations(updated);
    await api.saveEmbryoStageData(sessionId, "fet", { cryoLocations: updated }).catch(() => {});
  };

  const handleSaveRemaining = async () => {
    setSavingRemaining(true);
    try {
      await api.saveEmbryoStageData(sessionId, "fet", { remaining });
      setRemainingSaved(true); setTimeout(() => setRemainingSaved(false), 3000);
    } catch { setError("Failed to save remaining data."); } finally { setSavingRemaining(false); }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.saveEmbryoStageData(sessionId, "fet", { remark, cryoLocations, remaining });
      await api.completeStage(sessionId, "culture");
      onComplete();
    } catch { setError("Failed to complete."); } finally { setCompleting(false); }
  };

  const card = { background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "14px", padding: "1.5rem", marginBottom: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" };

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={onViewStatus} className="btn-secondary" style={{ padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1a202c" }}>Frozen Embryo Transfer (FET)</h2>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>Cryostraw validation · Thawed embryo images annotated with patient name and MPID</p>
          </div>
        </div>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>View All Stages
        </button>
      </div>

      {error && <div style={{ background: "#ffebee", color: "#c62828", padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.85rem", borderLeft: "4px solid #f44336" }}>{error}</div>}

      {/* Sub 1: Sample Validation + Annotated Details */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.88rem", flexShrink: 0 }}>1</div>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1a202c" }}>Sample Validation & Annotated Details</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* LEFT: Validation */}
          <div>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "0.4rem" }}>Dish Label Validation</p>
            <div style={{ fontSize: "0.75rem", color: "#374151", marginBottom: "0.6rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.4rem 0.6rem" }}>
              <strong>Female:</strong> {caseData.female_patient.name} · {caseData.female_patient.mpeid}
            </div>
            <StageCapture sessionId={sessionId} caseData={caseData} stage={FET_STAGE} onComplete={() => setValidated(true)} onViewStatus={onViewStatus} embedded={true} />
          </div>
          {/* RIGHT: Annotated */}
          <div style={{ opacity: validated ? 1 : 0.4, pointerEvents: validated ? "auto" : "none" }}>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "6px" }}>
              Annotated Patient Details
            </p>
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.6rem" }}>Upload microscopic image — patient details annotated</p>
            {!annotProcessing && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                {showUpload && (<label style={{ cursor: "pointer" }}><input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAnnotCapture} disabled={annotUploading || !validated} /><span className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}><IconUpload />{annotUploading ? "..." : "Upload"}</span></label>)}
                <label style={{ cursor: "pointer" }}><input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleAnnotCapture} disabled={annotUploading || !validated} /><span className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}><IconCamera />{annotUploading ? "..." : "Take Photo"}</span></label>
              </div>
            )}
            {annotProcessing && (<div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "0.6rem", background: "#f0f4ff", borderRadius: "6px", marginBottom: "0.6rem" }}><img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="" style={{ width: "20px", height: "20px" }} /><span style={{ fontSize: "0.8rem", color: "#667eea", fontWeight: 600 }}>Annotating...</span></div>)}
            {annotatedImages.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: "0.4rem" }}>
                {annotatedImages.map((img, i) => (
                  <div key={img.imageId || i} style={{ border: "1.5px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                    <img src={img.download_url} alt="" style={{ width: "100%", height: "70px", objectFit: "cover", display: "block" }} />
                    <div style={{ padding: "2px 4px", display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "#64748b" }}>
                      <span>{img.oocyte_number}</span>
                      <button onClick={() => window.open(img.download_url, "_blank")} style={{ background: "none", border: "none", cursor: "pointer", color: "#667eea", padding: 0, fontSize: "0.65rem" }}>↓</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub 2: Remark */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.88rem", flexShrink: 0 }}>2</div>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1a202c" }}>Remark</h3>
        </div>
        <textarea style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.88rem", outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: "75px", fontFamily: "inherit" }}
          placeholder="Enter your observations..." value={remark} onChange={(e) => { setRemark(e.target.value); setRemarkSaved(false); }} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button type="button" onClick={handleSaveRemark} disabled={savingRemark || remark === existingRemark} className="btn-secondary" style={{ fontSize: "0.85rem", opacity: remark === existingRemark ? 0.5 : 1 }}>{savingRemark ? "Saving..." : "Save Remark"}</button>
          {remarkSaved && <span style={{ fontSize: "0.8rem", color: "#16a34a" }}>✓ Saved</span>}
        </div>
      </div>

      {/* Sub 3: Cryopreservation */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.88rem", flexShrink: 0 }}>3</div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1a202c" }}>Cryopreservation</h3>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>Record embryo storage location in nitrogen tank system.</p>
          </div>
        </div>

        <p style={{ fontSize: "0.82rem", color: "#374151", marginBottom: "0.75rem" }}>Record where the embryo is stored in the nitrogen tank system.</p>

        {/* Location Form */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
          {[
            { label: "Cryolock ID", key: "cryolockId", placeholder: "e.g. CL-001", type: "text" },
            { label: "Cryolock Color", key: "cryolockColor", type: "select", options: ["Pink", "Blue", "Green", "Yellow", "Red", "White", "Orange", "Purple"] },
            { label: "Tank *", key: "tank", type: "select", options: ["Tank 1", "Tank 2", "Tank 3", "Tank 4", "Tank 5"] },
            { label: "Canister *", key: "canister", placeholder: "e.g. A, G...", type: "text" },
            { label: "Goblet *", key: "goblet", type: "select", options: ["1", "2", "3", "4", "5", "6"] },
            { label: "Viso Color *", key: "visoColor", type: "select", options: ["Pink", "Blue", "Green", "Yellow", "Red", "White", "Orange", "Purple"] },
          ].map(({ label, key, placeholder, type, options }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>{label}</label>
              {type === "select" ? (
                <select value={cryoForm[key]} onChange={e => setCryoForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "0.5rem 0.65rem", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.82rem", outline: "none", background: "#fff" }}>
                  <option value="">Select...</option>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type="text" placeholder={placeholder} value={cryoForm[key]} onChange={e => setCryoForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "0.5rem 0.65rem", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <button type="button" onClick={handleSaveCryo} disabled={savingCryo} className="btn-primary" style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {savingCryo ? "Saving..." : "+ Save Location"}
          </button>
          {cryoSaved && <span style={{ fontSize: "0.8rem", color: "#16a34a" }}>✓ Saved</span>}
        </div>

        {/* Saved Locations List */}
        {cryoLocations.length > 0 && (
          <div style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Stored Locations ({cryoLocations.length})</p>
            {cryoLocations.map((loc, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", padding: "0.5rem 0.75rem", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "8px", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
                {loc.tank && <span style={{ background: "#667eea", color: "#fff", borderRadius: "4px", padding: "2px 8px", fontWeight: 600 }}>{loc.tank}</span>}
                {loc.canister && <><span style={{ color: "#94a3b8" }}>→</span><span>Canister {loc.canister}</span></>}
                {loc.goblet && <><span style={{ color: "#94a3b8" }}>→</span><span>Goblet {loc.goblet}</span></>}
                {loc.cryolockColor && <><span style={{ color: "#94a3b8" }}>→</span><span style={{ background: "#667eea", color: "#fff", borderRadius: "4px", padding: "2px 8px" }}>{loc.cryolockColor}</span></>}
                {loc.cryolockId && <><span style={{ color: "#94a3b8" }}>→</span><span>🔒 {loc.cryolockId}</span></>}
                {loc.visoColor && <><span style={{ color: "#94a3b8" }}>→</span><span style={{ background: "#e0e7ff", color: "#3730a3", borderRadius: "4px", padding: "2px 8px" }}>CL: {loc.visoColor}</span></>}
                <button onClick={() => handleRemoveLocation(idx)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "0.75rem", padding: "0 4px" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Remaining Straws & Embryos */}
        <div style={{ borderTop: "1.5px solid #e2e8f0", paddingTop: "1rem" }}>
          <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.75rem" }}>Remaining Stock</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>Remaining Straws</label>
              <input type="number" min="0" placeholder="e.g. 3" value={remaining.straws} onChange={e => setRemaining(p => ({ ...p, straws: e.target.value }))}
                style={{ width: "100%", padding: "0.5rem 0.65rem", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>Remaining Embryos</label>
              <input type="number" min="0" placeholder="e.g. 2" value={remaining.embryos} onChange={e => setRemaining(p => ({ ...p, embryos: e.target.value }))}
                style={{ width: "100%", padding: "0.5rem 0.65rem", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          {(remaining.straws || remaining.embryos) && (
            <div style={{ display: "flex", gap: "1rem", padding: "0.5rem 0.75rem", background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: "8px", marginBottom: "0.75rem", fontSize: "0.82rem" }}>
              {remaining.straws && <span>🧊 <strong>{remaining.straws}</strong> straw(s) remaining</span>}
              {remaining.embryos && <span>🔬 <strong>{remaining.embryos}</strong> embryo(s) remaining</span>}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button type="button" onClick={handleSaveRemaining} disabled={savingRemaining} className="btn-secondary" style={{ fontSize: "0.85rem" }}>
              {savingRemaining ? "Saving..." : "Save Remaining"}
            </button>
            {remainingSaved && <span style={{ fontSize: "0.8rem", color: "#16a34a" }}>✓ Saved</span>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={handleComplete} disabled={completing} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          {completing ? "Completing..." : <><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Complete FET</>}
        </button>
        <button onClick={onViewStatus} className="btn-secondary">View All Stages</button>
      </div>

      {pendingCropFile && (
        <ImageCropModal
          imageFile={pendingCropFile}
          onCrop={handleCroppedImage}
          onCancel={() => setPendingCropFile(null)}
        />
      )}
    </div>
  );
}

export default FETStage;
