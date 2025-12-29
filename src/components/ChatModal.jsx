import React, { useEffect, useState } from 'react';
import { chat as chatApi } from '@/services/api.js';

export default function ChatModal({ open, onClose }) {
  const [toUserId, setToUserId] = useState('');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const currentUser = (() => {
    try { const u = JSON.parse(localStorage.getItem('currentUser') || 'null'); return u; } catch (e) { return null; }
  })();

  useEffect(() => {
    if (!open) return;
    if (!currentUser) return;
    // If toUserId already set, fetch conversation
    if (toUserId) fetchMessages();
  }, [open, toUserId]);

  async function fetchMessages() {
    if (!currentUser || !toUserId) return;
    setLoading(true);
    try {
      const data = await chatApi.getMessages(String(currentUser.id), String(toUserId));
      setMessages(data || []);
    } catch (e) {
      console.error('fetch messages error', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!currentUser) return alert('Veuillez vous connecter pour envoyer un message.');
    if (!toUserId || !text) return alert('Destinataire et message requis.');
    try {
      await chatApi.sendMessage({ fromUserId: String(currentUser.id), toUserId: String(toUserId), text });
      setText('');
      fetchMessages();
    } catch (e) {
      console.error('send error', e);
      alert('Échec envoi message');
    }
  }

  if (!open) return null;

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true">
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 style={{ margin: 0 }}>Contacter un artiste</h3>
          <button onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div style={styles.body}>
          {!currentUser && <div style={styles.notice}>Veuillez vous connecter pour utiliser le chat.</div>}

          <label>Destinataire (user id)</label>
          <input value={toUserId} onChange={(e) => setToUserId(e.target.value)} style={styles.input} placeholder="ID destinataire (ex: dev-user-...)" />

          <button style={styles.smallButton} onClick={fetchMessages} disabled={!toUserId || loading}>Charger la conversation</button>

          <div style={styles.messages}>
            {loading && <div>Chargement…</div>}
            {messages.map((m) => (
              <div key={m.id} style={m.from === String(currentUser?.id) ? styles.msgOut : styles.msgIn}>
                <div style={styles.msgMeta}>{m.from} · {new Date(m.createdAt).toLocaleString()}</div>
                <div>{m.text}</div>
              </div>
            ))}
            {(!messages || messages.length === 0) && <div style={styles.empty}>Aucun message</div>}
          </div>

          <textarea value={text} onChange={(e) => setText(e.target.value)} style={styles.textarea} placeholder="Votre message…" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSend} style={styles.button}>Envoyer</button>
            <button onClick={onClose} style={styles.buttonAlt}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 2000 },
  card: { width: 520, maxWidth: '96%', background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  body: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: { padding: 8, borderRadius: 6, border: '1px solid #ddd' },
  smallButton: { padding: '6px 10px', borderRadius: 6, background: '#f3f3f3', border: '1px solid #ddd' },
  messages: { maxHeight: 240, overflow: 'auto', border: '1px solid #eee', padding: 8, borderRadius: 6, background: '#fafafa' },
  msgIn: { textAlign: 'left', marginBottom: 8, background: '#fff', padding: 8, borderRadius: 6 },
  msgOut: { textAlign: 'right', marginBottom: 8, background: '#e6ffea', padding: 8, borderRadius: 6 },
  msgMeta: { fontSize: 11, color: '#666', marginBottom: 4 },
  empty: { color: '#999', fontStyle: 'italic' },
  textarea: { minHeight: 80, padding: 8, borderRadius: 6, border: '1px solid #ddd' },
  button: { padding: '8px 12px', background: '#0b5cff', color: '#fff', border: 'none', borderRadius: 6 },
  buttonAlt: { padding: '8px 12px', background: '#f3f3f3', border: 'none', borderRadius: 6 },
  notice: { padding: 8, background: '#fff0f0', borderRadius: 6, color: '#611' }
};
