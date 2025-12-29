import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import "./GAPStudioHome.css"; // styles séparés
import gapstudioApi from "../services/gapstudio.api";
import { api } from '@/services/api.js';

const GAPStudioHome = () => {
  // STATES
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("photoreal");
  const [culture, setCulture] = useState("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [variants, setVariants] = useState(1);
  const [imageUrl, setImageUrl] = useState(null);
  const [recent, setRecent] = useState(() => JSON.parse(localStorage.getItem('gap_recent')||'[]'));
  const [gallery, setGallery] = useState(() => JSON.parse(localStorage.getItem('gap_gallery')||'[]'));
  const [seedImage, setSeedImage] = useState(null); // base64 or url
  const [requests, setRequests] = useState(0);
  const [audioPrompt, setAudioPrompt] = useState("");
  const [audioPreview, setAudioPreview] = useState(null);
  const [textSeed, setTextSeed] = useState("");
  const [textType, setTextType] = useState("description");
  const [textResult, setTextResult] = useState("");
  const [mintMessage, setMintMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdNFT, setCreatedNFT] = useState(null);

  // ARTC balance and library/history
  const [artcBalance, setArtcBalance] = useState(null);
  const [piBalance, setPiBalance] = useState(null);
  const [usdBalance, setUsdBalance] = useState(null);
  const [library, setLibrary] = useState(() => JSON.parse(localStorage.getItem('gap_library')||'[]'));
  const [previewItem, setPreviewItem] = useState(null);

  // Passes state
  const [passes, setPasses] = useState([]);
  const [showPassModal, setShowPassModal] = useState(false);

  useEffect(() => {
    const loadPasses = async () => {
      try {
        const stored = localStorage.getItem('currentUser');
        const user = stored ? JSON.parse(stored) : null;
        if (user?.id) {
          const res = await api.getPasses(String(user.id));
          setPasses(res?.passes || []);
        }
      } catch (e) { console.error('failed to fetch passes', e); }
    };
    loadPasses();
  }, []);

  const refreshBalancesAndPasses = async () => {
    try {
      const stored = localStorage.getItem('currentUser');
      const user = stored ? JSON.parse(stored) : null;
      if (user?.id) {
        const wb = await api.getWalletBalance(String(user.id));
        setArtcBalance(wb?.balances?.ARTC ?? artcBalance);
        setPiBalance(wb?.balances?.PI ?? piBalance);
        setUsdBalance(wb?.usdNet ?? wb?.usdGross ?? usdBalance);
        const res = await api.getPasses(String(user.id));
        setPasses(res?.passes || []);
      }
    } catch (e) { console.error('refresh balances error', e); }
  };

  const handleBuyPass = async (type, period = 'monthly') => {
    try {
      setLoading(true);
      const stored = localStorage.getItem('currentUser');
      const user = stored ? JSON.parse(stored) : null;
      if (!user?.id) return alert('Connecte-toi pour acheter un pass');
      const res = await api.buyPass(String(user.id), type, period, 'USD');
      if (res?.ok) {
        alert(`Pass ${res.pass.name} activé`);
        await refreshBalancesAndPasses();
        setShowPassModal(false);
      } else {
        alert(res?.error || 'Achat échoué');
      }
    } catch (e) {
      console.error('buy pass error', e);
      alert(e?.response?.data?.error || e?.message || 'Erreur lors de l achat');
    } finally { setLoading(false); }
  };

  // Theme (light/dark)
  const [darkMode, _setDarkMode] = useState(false);
  useEffect(() => {
    if (darkMode) document.body.classList.add('gap-dark');
    else document.body.classList.remove('gap-dark');
  }, [darkMode]);

  // Recharge modal state
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(5);

  // Confirmation modal for ARTC debit
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingCost, setPendingCost] = useState(0);
  const [pendingLabel, setPendingLabel] = useState('');

  // navigation helper (GAP Studio : pas de bouton "Connect" visible)
  const navigate = useNavigate();

  // Fetch wallet balances (ARTC, PI, USD) for current user
  useEffect(() => {
    const loadBalance = async () => {
      try {
        const stored = localStorage.getItem('currentUser');
        const user = stored ? JSON.parse(stored) : null;
        if (user?.id) {
          const res = await api.getWalletBalance(String(user.id));
          setArtcBalance(res?.balances?.ARTC ?? 0);
          setPiBalance(res?.balances?.PI ?? 0);
          setUsdBalance(res?.usdNet ?? res?.usdGross ?? 0);
        }
      } catch (e) {
        console.error('failed to fetch wallet balance', e);
      }
    };
    loadBalance();
  }, []);

  const PRESETS = [
    { id: 'portrait', label: 'Portrait traditionnel', prompt: 'Portrait of a wise elder, detailed, warm tones, cultural attire' },
    { id: 'landscape', label: 'Paysage mystique', prompt: 'Dreamlike landscape with dramatic light, floating islands, cinematic' },
    { id: 'abstract', label: 'Abstrait vibrant', prompt: 'Vibrant abstract composition, bold colors, textured brush strokes' },
  ];

  // Costs for quick validation (display only; actual billing/debit should be handled server-side)
  const COSTS = { image: 1, nft: 2, audio: 0, text: 0 };
  // voice recording
  const [recording, setRecording] = useState(false);
  const [recAudioUrl, setRecAudioUrl] = useState(null);
  const mediaRef = React.useRef(null);

  // GENERATE IMAGE
  const handleGenerateImage = async () => {
    if (!prompt.trim()) return alert("Écris un prompt.");

    setRequests((r) => r + 1);
    setLoading(true);
    setImageUrl(null);

    try {
      const payload = {
        prompt,
        width: Number(width) || 1024,
        height: Number(height) || 1024,
        style,
        culture,
        n: Number(variants) || 1,
      };
      if (seedImage) payload.seed = seedImage;

      // Use gapstudioApi which provides fallbacks and consistent API base
      const data = await gapstudioApi.generateImage(payload);
      const url = data.url || data.image || data.images?.[0] || null;

      if (!url) {
        alert('Aucune image renvoyée (backend indisponible)');
      } else {
        setImageUrl(url);
        const entry = { type: 'image', url, prompt, style, createdAt: new Date().toISOString() };
        // add to library and recent history
        addToLibrary(entry);
        // refresh ARTC balance after server-side charge
        try {
          const stored = localStorage.getItem('currentUser');
          const user = stored ? JSON.parse(stored) : null;
          if (user?.id) {
            const b = await api.getWalletBalance(String(user.id));
            setArtcBalance(b?.balances?.ARTC ?? artcBalance);
            setPiBalance(b?.balances?.PI ?? piBalance);
            setUsdBalance(b?.usdNet ?? b?.usdGross ?? usdBalance);
          }
        } catch (e) { console.error('failed to refresh wallet balance', e); }
      }
    } catch (err) {
      console.error(err);
      const message = (err.message || '').toLowerCase();
      if (message.includes('402') || message.includes('insufficient funds')) {
        alert('Solde insuffisant: recharger ARTC/IA depuis votre Wallet.');
      } else {
        alert('Erreur lors de la génération.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handler unifié : choisit l'action en fonction de l'entrée (image importée, audio, texte)
  const handleUnifiedGenerate = async () => {
    // Priorités : image importée → génération NFT ; audio présent → génération audio ; texte → image
    const balance = Number(artcBalance) || 0;

    if (seedImage && !createdNFT) {
      if (balance < COSTS.nft) return alert('Solde ARTC insuffisant pour générer un NFT (coût: ' + COSTS.nft + ' ARTC)');
      // confirm debit
      setPendingCost(COSTS.nft);
      setPendingLabel('Génération NFT — débit ' + COSTS.nft + ' ARTC');
      setPendingAction(() => async () => {
        await handleGenerateNFT();
      });
      setConfirmModalVisible(true);
      return;
    }

    if (recAudioUrl || audioPrompt.trim()) {
      if (balance < COSTS.audio) return alert('Solde ARTC insuffisant pour la génération audio (coût: ' + COSTS.audio + ' ARTC)');
      // audio currently free — execute directly
      await handleGenerateAudio();
      return;
    }

    if (prompt && prompt.trim()) {
      if (balance < COSTS.image) return alert('Solde ARTC insuffisant pour la génération image (coût: ' + COSTS.image + ' ARTC)');
      setPendingCost(COSTS.image);
      setPendingLabel('Génération image — débit ' + COSTS.image + ' ARTC');
      setPendingAction(() => async () => {
        await handleGenerateImage();
      });
      setConfirmModalVisible(true);
      return;
    }

    alert('Fournis du texte, un enregistrement audio ou une image à importer.');
  };

  // DOWNLOAD
  const downloadImage = () => {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = "gap-image";
    a.click();
  };

  // ADD TO GALLERY
  const addToGallery = () => {
    if (!imageUrl) return alert('Aucune image à ajouter');
    const entry = { type: 'image', url: imageUrl, prompt, createdAt: new Date().toISOString() };
    const next = [entry, ...gallery].slice(0, 100);
    setGallery(next);
    localStorage.setItem('gap_gallery', JSON.stringify(next));
    alert('Image ajoutée à votre GAP Gallery locale');
  };

  // ADD TO LIBRARY (centralized storage for images/audio/text/nfts)
  const addToLibrary = (item) => {
    const entry = { ...item, createdAt: new Date().toISOString() };
    const next = [entry, ...library].slice(0, 200);
    setLibrary(next);
    localStorage.setItem('gap_library', JSON.stringify(next));
    // also push to recent history
    const rnext = [{ url: item.url || item.preview || '', type: item.type || 'item', createdAt: entry.createdAt, meta: item }, ...recent].slice(0, 200);
    setRecent(rnext);
    localStorage.setItem('gap_recent', JSON.stringify(rnext));
  };

  // GENERATE TEXT
  const handleGenerateText = async () => {
    if (!textSeed.trim()) return alert('Écris un sujet.');
    setRequests((r) => r + 1);
    setLoading(true);
    try {
      // Backend text endpoint may not be implemented — provide local simulated generation
      const simulated = `Génération simulée (${textType}) pour "${textSeed}":\n- Idée 1: Une courte description artistique inspirée de ${textSeed}.\n- Idée 2: Variante alternative et titre possible.`;
      await new Promise((res) => setTimeout(res, 700));
      setTextResult(simulated);
      addToLibrary({ type: 'text', content: simulated, prompt: textSeed });
    } catch (err) {
      console.error(err);
      alert('Erreur génération texte');
    } finally {
      setLoading(false);
    }
  };

  // GENERATE AUDIO
  const handleGenerateAudio = async () => {
    if (!audioPrompt.trim() && !recAudioUrl) return alert('Écris un prompt audio ou enregistre un message.');
    setRequests((r) => r + 1);
    setLoading(true);
    try {
      // If user recorded audio, prefer playback of that recording as preview
      if (recAudioUrl) {
        setAudioPreview(recAudioUrl);
        addToLibrary({ type: 'audio', url: recAudioUrl, prompt: audioPrompt });
      } else {
        // Backend audio may be unavailable — use a small simulated audio URL (placeholder)
        await new Promise((res) => setTimeout(res, 900));
        const sample = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
        setAudioPreview(sample);
        addToLibrary({ type: 'audio', url: sample, prompt: audioPrompt });
      }
    } catch (err) {
      console.error(err);
      alert('Erreur génération audio');
    } finally {
      setLoading(false);
    }
  };

  // FILE UPLOAD for seed image
  const handleUploadFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      // simplified UX: show imported image immediately and hide other action buttons
      setSeedImage(e.target.result);
      setImageUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Import -> Generate NFT (server-side internal NFT, no blockchain)
  const handleGenerateNFT = async () => {
    const stored = localStorage.getItem('currentUser');
    const user = stored ? JSON.parse(stored) : null;
    const userId = user?.id || 'guest';
    if (!seedImage && !imageUrl) return alert('Importez d’abord une image.');
    try {
      setLoading(true);
      // 1) upload/import image to backend
      const imp = await gapstudioApi.importImage({ userId, imageData: seedImage || imageUrl });
      if (!imp || !imp.image || !imp.image.id) throw new Error('Import failed');
      // 2) generate internal NFT
      try {
        const g = await gapstudioApi.generateNFT({ userId, imageId: imp.image.id, title: prompt || 'GAP Studio NFT', description: prompt || '' });
        if (!g || !g.nft) throw new Error('NFT generation failed');
        // Add NFT to local gallery state for immediate UX
        const nft = g.nft;
        const next = [ { id: nft.id, url: nft.image, title: nft.title, date: nft.date, status: nft.status }, ...gallery].slice(0, 100);
        setGallery(next);
        localStorage.setItem('gap_gallery', JSON.stringify(next));
        setCreatedNFT(nft);
        // add to centralized library
        addToLibrary({ type: 'nft', id: nft.id, url: nft.image, title: nft.title, status: nft.status });
        alert('NFT généré et ajouté à votre galerie (statut: ' + nft.status + ')');
        // automatically set imageUrl to the NFT image
        setImageUrl(nft.image);

        // update ARTC balance if server charged
        if (g.charged) {
          setArtcBalance((b) => (typeof b === 'number' ? b - (g.charged.amount || 0) : b));
        } else {
          // fallback refresh
          const stored2 = localStorage.getItem('currentUser');
          const user2 = stored2 ? JSON.parse(stored2) : null;
          if (user2?.id) {
            const b2 = await api.getWalletBalance(String(user2.id));
            setArtcBalance(b2?.balances?.ARTC ?? artcBalance);
            setPiBalance(b2?.balances?.PI ?? piBalance);
            setUsdBalance(b2?.usdNet ?? b2?.usdGross ?? usdBalance);
          }
        }
      } catch (e) {
        if (e.status === 402 || (e.body && e.body.error && e.body.error.includes('insufficient'))) {
          alert('Solde ARTC insuffisant pour créer un NFT. Veuillez recharger votre portefeuille.');
        } else throw e;
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la génération NFT: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Sell NFT (navigate to marketplace with pre-fill)
  const handleSell = (nft) => {
    try {
      const prefill = { title: nft.title || '', description: nft.description || '', media: nft.image, nftId: nft.id };
      localStorage.setItem('prefillListing', JSON.stringify(prefill));
      navigate('/marketplace');
    } catch (e) { console.error(e); }
  }; 

  // copy prompt
  // removed copyPrompt per request

  const applyPreset = (p) => {
    setPrompt(p.prompt);
    setStyle('digital');
  };

  // Recording helpers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecAudioUrl(url);
        // set as audioPreview for playback
        setAudioPreview(url);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err) {
      console.error('microphone error', err);
      alert('Impossible d\'accéder au microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
      setRecording(false);
    }
  };

  const handleMintNFT = async () => {
    if (!imageUrl) return alert("Génère d'abord une image");
    setMintMessage("Minting...");
    try {
      const data = await gapstudioApi.mintNFT(imageUrl, prompt);
      setMintMessage(data?.message || `Mint simulé — id: ${data?.nftId || 'sim-' + Date.now()}`);
    } catch (err) {
      console.error(err);
      setMintMessage("Erreur mint");
    }
    setTimeout(() => setMintMessage(''), 4000);
  };

  // CONFIRMATION HANDLERS
  const handleConfirmAction = async () => {
    // Close modal and perform the pending action
    setConfirmModalVisible(false);
    if (!pendingAction) return;
    try {
      setLoading(true);
      await pendingAction();
    } catch (e) {
      console.error('confirm action error', e);
      alert("Erreur lors de l'action");
    } finally {
      setLoading(false);
      setPendingAction(null);
      setPendingCost(0);
      setPendingLabel('');
      // refresh balance
      try {
        const stored = localStorage.getItem('currentUser');
        const user = stored ? JSON.parse(stored) : null;
        if (user?.id) {
          const b = await api.getWalletBalance(String(user.id));
          setArtcBalance(b?.balances?.ARTC ?? artcBalance);
          setPiBalance(b?.balances?.PI ?? piBalance);
          setUsdBalance(b?.usdNet ?? b?.usdGross ?? usdBalance);
        }
      } catch (e) { console.error('balance refresh error', e); }
    }
  };

  const handleRecharge = async () => {
    const amt = Number(rechargeAmount);
    if (!amt || amt <= 0) return alert('Montant invalide');
    try {
      setLoading(true);
      const stored = localStorage.getItem('currentUser');
      const user = stored ? JSON.parse(stored) : null;
      if (!user?.id) return alert('Connectez-vous pour recharger votre portefeuille.');
      const r = await api.rechargeARTC(String(user.id), amt);
      if (r?.ok) {
        alert(`Portefeuille rechargé: +${amt} ARTC`);
        setShowRechargeModal(false);
        const b = await api.getWalletBalance(String(user.id));
        setArtcBalance(b?.balances?.ARTC ?? artcBalance);
        setPiBalance(b?.balances?.PI ?? piBalance);
        setUsdBalance(b?.usdNet ?? b?.usdGross ?? usdBalance);
      } else if (r?.balance !== undefined) {
        setArtcBalance(r.balance);
        setShowRechargeModal(false);
      } else {
        alert('Recharge effectuée');
        setShowRechargeModal(false);
      }
    } catch (e) {
      console.error('recharge error', e);
      alert('Erreur lors de la recharge');
    } finally { setLoading(false); }
  };

  return (
    <div className="wrap">
      <header>
        <div className="logo">GAP</div>
        <div>
          <h1 className="brand-title">STUDIO—IA</h1>
          <p>Image · Son · Texte · NFT — Studio IA orienté art & culture mondiale</p>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: "12px", alignItems: 'center' }}>
          <div className="badge">USD <strong>${usdBalance ?? '—'}</strong></div>
          <div className="badge">PI <strong>{piBalance ?? '—'}</strong></div>
          <div className="badge">ARTC <strong>{artcBalance ?? '—'}</strong></div>
          <button className="ghost" onClick={() => setShowPassModal(true)}>Pass</button>
          <button className="ghost" onClick={() => setShowRechargeModal(true)}>Recharger</button>
          <button className="ghost" onClick={() => navigate('/gapstudio/docs')}>Documentation</button>
        </div>
      </header>

      {/* Modals: confirmation and recharge */}
      {confirmModalVisible && (
        <div className="modal-overlay" onClick={() => { setConfirmModalVisible(false); setPendingAction(null); setPendingCost(0); setPendingLabel(''); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{pendingLabel || "Confirmer l'opération"}</h3>
            <p>Coût: <strong>{pendingCost} ARTC</strong></p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="ghost" onClick={() => { setConfirmModalVisible(false); setPendingAction(null); setPendingCost(0); setPendingLabel(''); }}>Annuler</button>
              <button className="btn gold" onClick={handleConfirmAction} disabled={loading}>{loading ? 'Traitement…' : 'Confirmer'}</button>
            </div>
          </div>
        </div>
      )}

      {showRechargeModal && (
        <div className="modal-overlay" onClick={() => setShowRechargeModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Recharger ARTC</h3>
            <div style={{ marginTop: 8 }}>
              <label>Montant ARTC</label>
              <input className="field" type="number" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} min="1" />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="ghost" onClick={() => setShowRechargeModal(false)}>Annuler</button>
              <button className="btn gold" onClick={handleRecharge} disabled={loading}>{loading ? 'Traitement…' : 'Recharger'}</button>
            </div>
          </div>
        </div>
      )}

      {showPassModal && (
        <div className="modal-overlay" onClick={() => setShowPassModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Pass GAP Studio</h3>
            <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
              <div className="card">
                <strong>Genesis Pass</strong>
                <div className="muted">Le commencement créatif — 3 NFT gratuits / période, génération texte.</div>
                <div style={{ marginTop: 8 }}><button className="btn" onClick={() => handleBuyPass('genesis')}>Activer (Gratuit)</button></div>
              </div>

              <div className="card">
                <strong>Aurum Pass</strong>
                <div className="muted">L'or artistique — génération NFT, outils avancés, visibilité.</div>
                <div style={{ marginTop: 8 }}><button className="btn" onClick={() => handleBuyPass('aurum', 'monthly')}>10 USD / mois</button> <button className="ghost" onClick={() => handleBuyPass('aurum', 'annual')}>100 USD / an</button></div>
              </div>

              <div className="card">
                <strong>Eternum Pass</strong>
                <div className="muted">Reconnaissance durable — ventes premium, accès avancé, visibilité mondiale.</div>
                <div style={{ marginTop: 8 }}><button className="btn" onClick={() => handleBuyPass('eternum', 'monthly')}>50 USD / mois</button> <button className="ghost" onClick={() => handleBuyPass('eternum', 'annual')}>500 USD / an</button></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="ghost" onClick={() => setShowPassModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
      <main className="grid">
        <section className="leftCol">

          {/* CANAL UNIQUE : Texte · Audio · Image */}
          <div className="card section unified-channel">
            <div className="title">
              <h2>Canal unique — Texte · Audio · Image</h2>
              <div className="muted">Un seul espace pour écrire, importer une image ou enregistrer de l'audio. Le bouton <strong>Générer</strong> choisira l'action appropriée.</div>
            </div>

            <textarea className="field" placeholder="Écris ton prompt, importe une image ou enregistre un message audio" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />

            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <label className="ghost gold" style={{ cursor: 'pointer' }}>
                📷 Importer
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleUploadFile(e.target.files && e.target.files[0])} />
              </label>

              <button className="ghost" onClick={() => { if (recording) stopRecording(); else startRecording(); }}>{recording ? 'Stop' : '🎙️ Enregistrer'}</button>

              <button className="btn gold" onClick={handleUnifiedGenerate} disabled={loading}>{loading ? 'Génération…' : 'Générer'}</button>

              <div style={{ marginLeft: 'auto' }} className="muted-block small">{seedImage ? 'Image importée' : recAudioUrl ? 'Audio prêt' : (!prompt.trim() ? 'Entrée requise' : 'Texte prêt')}</div>
            </div>
          </div>

          {/* Unified Studio — Centralisé (Image · Audio · Texte · NFT) */}
          <div className="card section unified-expanded">
            <div className="title">
              <h2>Studio unifié — Génération & NFT</h2>
              <div className="muted">Un flux unique pour créer, générer et tokeniser — vos créations sont stockées dans votre bibliothèque personnelle.</div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="field small" value={style} onChange={(e) => setStyle(e.target.value)}>
                  <option value="photoreal">Photo réaliste</option>
                  <option value="traditional">Traditionnel</option>
                  <option value="surreal">Surréaliste</option>
                  <option value="futuristic">Futuriste</option>
                  <option value="digital">Art numérique</option>
                </select>

                <select className="field small" value={culture} onChange={(e) => setCulture(e.target.value)}>
                  <option value="">Any culture</option>
                  <option value="african">African motifs</option>
                  <option value="asian">Asian motifs</option>
                  <option value="latin">Latin American</option>
                </select>

                <select className="field small" defaultValue="" onChange={(e) => { const id = e.target.value; if (!id) return; const p = PRESETS.find(x => x.id === id); if (p) applyPreset(p); }}>
                  <option value="">Presets...</option>
                  {PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="muted">Coût estimé: Image <strong>1 ARTC</strong> · NFT <strong>2 ARTC</strong></div>
                <div className="badge">ARTC <strong>{artcBalance ?? '—'}</strong></div>
              </div>
            </div>

            <textarea className="field" placeholder="Écris ton prompt, importe une image ou enregistre un message audio" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} />

            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <label className="ghost gold" style={{ cursor: 'pointer' }}>
                📷 Importer
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleUploadFile(e.target.files && e.target.files[0])} />
              </label>

              <button className="ghost" onClick={() => { if (recording) stopRecording(); else startRecording(); }}>{recording ? 'Stop' : '🎙️ Enregistrer'}</button>

              <button className="btn gold" onClick={handleUnifiedGenerate} disabled={loading}>{loading ? 'Génération…' : 'Générer'}</button>

              <button className="ghost" onClick={() => { if (library.length) window.scrollTo({ top: 0, behavior: 'smooth' }); else alert('Bibliothèque vide'); }}>Aller à la bibliothèque</button>

              <div style={{ marginLeft: 'auto' }} className="muted-block small">{seedImage ? 'Image importée' : recAudioUrl ? 'Audio prêt' : (!prompt.trim() ? 'Entrée requise' : 'Texte prêt')}</div>
            </div>

            <div className="section" style={{ marginTop: 12 }}>
              <div className="preview card">
                {loading && <div className="muted-block">Génération en cours…</div>}

                {/* IMAGE */}
                {imageUrl && !loading && (
                  <div>
                    <img src={imageUrl} alt="preview" />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button className="ghost" onClick={downloadImage}>Télécharger</button>
                      <button className="ghost" onClick={() => addToLibrary({ type: 'image', url: imageUrl, prompt })}>Ajouter à la bibliothèque</button>
                      <button className="btn" onClick={handleMintNFT}>Mint (NFT)</button>
                    </div>
                  </div>
                )}

                {/* AUDIO */}
                {!imageUrl && audioPreview && !loading && (
                  <div>
                    <audio controls src={audioPreview} />
                    <div style={{ marginTop: 8 }}>
                      <button className="ghost" onClick={() => addToLibrary({ type: 'audio', url: audioPreview, prompt: audioPrompt || prompt })}>Ajouter à la bibliothèque</button>
                    </div>
                  </div>
                )}

                {/* TEXT */}
                {!imageUrl && !audioPreview && textResult && !loading && (
                  <div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{textResult}</pre>
                    <div style={{ marginTop: 8 }}>
                      <button className="ghost" onClick={() => addToLibrary({ type: 'text', content: textResult, prompt: textSeed || prompt })}>Ajouter à la bibliothèque</button>
                    </div>
                  </div>
                )}

                {/* FALLBACK */}
                {!imageUrl && !audioPreview && !textResult && !loading && (
                  <div className="muted-block">Aucune création récente</div>
                )}

              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <aside className="rightCol">

          {/* Preview modal */}
          {previewItem && (
            <div className="preview-modal" onClick={() => setPreviewItem(null)}>
              <div className="preview-card" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{previewItem.title || previewItem.type}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {previewItem.type === 'image' && <button className="ghost" onClick={() => downloadImage()}>Télécharger</button>}
                    {previewItem.type === 'nft' && <button className="btn" onClick={() => handleSell(previewItem)}>Vendre</button>}
                    <button className="ghost" onClick={() => setPreviewItem(null)}>Fermer</button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  {previewItem.type === 'image' || previewItem.type === 'nft' ? (
                    <img src={previewItem.url} alt="preview" style={{ width: '100%', maxHeight: 420, objectFit: 'contain' }} />
                  ) : previewItem.type === 'audio' ? (
                    <audio controls src={previewItem.url} />
                  ) : previewItem.type === 'text' ? (
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{previewItem.content}</pre>
                  ) : null}
                </div>
              </div>
            </div>
          )}
          <div className="card section">
            <div className="title"><h2>Studio quick stats</h2></div>
            <div className="stat"><div>Requests today</div><strong>{requests}</strong></div>
          </div>

          <div className="card section">
            <h2>À propos — GAP Studio (officiel)</h2>
            <div className="muted">Direction artistique, sécurité et principes d'usage</div>
            <div className="muted-block" style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
              <strong>Stellar Noir — studio élégant, palette sombre et accents dorés.</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>GAP Studio est un atelier de création numérique conçu pour offrir une expérience fluide, immersive et prestigieuse. Importation, génération et transformation en NFT se font dans un flux unique et sécurisé.</p>
              <p style={{ marginTop: 6, marginBottom: 0 }}><em>Principes clés :</em> importation immédiate, bouton principal <strong>Générer</strong> pour création NFT, vérification & authentification intégrée, interaction audio et UX épurée.</p>
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="ghost" onClick={() => navigate('/gapstudio/docs')}>Lire la documentation complète</button>
            </div>

            <div style={{ marginTop: 12 }} className="muted-block">
              <div style={{ fontWeight: 700 }}>Pass actif</div>
              {passes && passes.length ? (
                <div style={{ marginTop: 8 }}>
                  {passes.map((p, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <div style={{ fontWeight: 600 }}>{p.name} <span className="muted" style={{ fontSize: 12 }}>({p.period})</span></div>
                      <div className="muted" style={{ fontSize: 12 }}>Expire: {new Date(p.end).toLocaleDateString()}</div>
                      {p.limits && p.limits.freeNFT !== undefined && <div className="muted" style={{ fontSize: 12 }}>NFT gratuits restants: {p.limits.freeNFT}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted">Aucun pass actif</div>
              )}
            </div>

          </div>

          <div className="card section">
            <h2>Bibliothèque</h2>
            <div className="muted">Toutes vos créations (images, audio, textes, NFT)</div>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {library.length === 0 && <div className="muted-block">Bibliothèque vide</div>}
              {library.map((item, i) => (
                <div key={i} className="gapstudio-card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {item.type === 'image' || item.type === 'nft' ? (
                    <img src={item.url} alt="" style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }} onClick={() => setPreviewItem(item)} />
                  ) : item.type === 'audio' ? (
                    <div style={{ width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button className="ghost" onClick={() => setPreviewItem(item)}>▶️</button>
                    </div>
                  ) : item.type === 'text' ? (
                    <div style={{ width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setPreviewItem(item)}>📝</div>
                  ) : null}

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{item.title || (item.type === 'text' ? (item.content || '').slice(0, 48) : item.prompt || item.id || item.type)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{new Date(item.createdAt).toLocaleString()}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {item.type !== 'text' && <button className="ghost" onClick={() => addToLibrary(item)}>⭐</button>}
                    {item.type === 'image' && <button className="ghost" onClick={() => downloadImage()}>Télécharger</button>}
                    {item.type === 'nft' && <button className="btn" onClick={() => handleSell(item)}>Vendre</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card section">
            <h2>Historique</h2>
            <div className="muted">Actions récentes et générations</div>
            <div style={{ marginTop: 8 }}>
              {recent.length === 0 && <div className="muted-block">Aucun historique</div>}
              {recent.map((r, i) => (
                <div key={i} style={{ padding: 8, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: 13 }}>{r.prompt || r.type || 'création'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{new Date(r.createdAt || Date.now()).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default GAPStudioHome;