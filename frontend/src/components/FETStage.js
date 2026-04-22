/**
 * Frozen Embryo Transfer (FET) — replaces Culture stage
 * Sub 1: Sample Validation (female details) + Annotated microscopic image (two-column)
 * Sub 2: Remark
 */
import React, { useState, useEffect } from "react";
import { api } from "../api";
import { STAGES } from "../config";
import StageCapture from "./StageCapture";
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
      const canvas = document.createElement("canvas"); const MAX = 1920;
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
  const [remark, setRemark] = useState("");
  const [existingRemark, setExistingRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [remarkSaved, setRemarkSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getEmbryoStageData(sessionId, "fet").then(d => { setRemark(d.remark || ""); setExistingRemark(d.remark || ""); }).catch(() => {});
    api.getAnnotatedImages(sessionId, "fet").then(d => setAnnotatedImages(d.images || [])).catch(() => {});
  }, [sessionId]);

  const handleAnnotUpload = async (e) => {
    const rawFile = e.target.files[0]; if (!rawFile) return;
    setAnnotUploading(true); setError(null);
    try {
      const file = await compressImg(rawFile);
      const num = annotatedImages.length + 1;
      const { uploadUrl } = await api.getPresignedUrlForAnnotatedImage(sessionId, num, "fet");
      await api.uploadImage(uploadUrl, file);
      setAnnotProcessing(true);
      let attempts = 0;
      const poll = async () => {
        try {
          const data = await api.getAnnotatedImages(sessionId, "fet");
          const img = data.images.find(i => i.oocyte_number === num);
          if (img && img.annotation_status === "completed") { setAnnotatedImages(data.images); setAnnotProcessing(false); return; }
          attempts++; if (attempts < 45) setTimeout(poll, 2000); else { setError("Annotation timeout."); setAnnotProcessing(false); }
        } catch (err) { setError(err.message); setAnnotProcessing(false); }
      };
      poll();
    } catch (err) { setError(err.message); } finally { setAnnotUploading(false); }
  };

  const handleSaveRemark = async () => {
    setSavingRemark(true);
    try { await api.saveEmbryoStageData(sessionId, "fet", { remark }); setExistingRemark(remark); setRemarkSaved(true); setTimeout(() => setRemarkSaved(false), 3000); }
    catch { setError("Failed to save remark."); } finally { setSavingRemark(false); }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.saveEmbryoStageData(sessionId, "fet", { remark });
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
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>Validate sample, capture annotated microscopic image</p>
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
                {showUpload && (<label style={{ cursor: "pointer" }}><input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAnnotUpload} disabled={annotUploading || !validated} /><span className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}><IconUpload />{annotUploading ? "..." : "Upload"}</span></label>)}
                <label style={{ cursor: "pointer" }}><input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleAnnotUpload} disabled={annotUploading || !validated} /><span className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}><IconCamera />{annotUploading ? "..." : "Take Photo"}</span></label>
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

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={handleComplete} disabled={completing} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          {completing ? "Completing..." : <><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Complete FET</>}
        </button>
        <button onClick={onViewStatus} className="btn-secondary">View All Stages</button>
      </div>
    </div>
  );
}

export default FETStage;
