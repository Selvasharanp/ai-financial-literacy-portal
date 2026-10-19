import { useEffect, useState } from 'react';
import axios from 'axios';
import { recognize } from 'tesseract.js';
import Sidebar from '../components/Sidebar';
import { Plus, Mic, Trash2, Loader2, Upload, Users, Pencil, CheckCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatINR } from '../utils/currency';
import { apiUrl, authConfig } from '../utils/api';
import { useNotification } from '../context/NotificationContext';

const today = () => new Date().toISOString().slice(0, 10);
const blankForm = () => ({ title: '', amount: '', type: 'expense', category: 'General', date: today(), isVoice: false, isCredited: true });
const categoryFor = (text) => /restaurant|cafe|food|lunch|dinner|burger|pizza/i.test(text) ? 'Food' : /uber|ola|fuel|petrol|taxi|bus|train/i.test(text) ? 'Transport' : /rent|electricity|water|bill/i.test(text) ? 'Bills' : 'General';
const receiptDateToIso = (value) => {
    const match = value?.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
    if (!match) return null;
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    const date = new Date(`${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const readReceipt = (text) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const totalLine = lines.find((line) => /grand\s*total|amount\s*due|net\s*amount|\btotal\b/i.test(line));
    const amountText = (totalLine || text).replace(/\b\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b/g, '');
    const amounts = amountText.match(/(?:₹|rs\.?|inr)?\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?/gi) || [];
    const numericAmounts = amounts.map((value) => Number(value.replace(/[^0-9.]/g, '').replace(/,/g, ''))).filter((value) => Number.isFinite(value) && value > 0);
    const amount = numericAmounts.length ? Math.max(...numericAmounts) : null;
    const dateMatch = text.match(/\b\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b/);
    const merchant = lines.find((line) => /[a-z]/i.test(line) && !/tax|gst|invoice|total|amount|cash|card|upi|date/i.test(line)) || '';
    return { merchant, amount, date: dateMatch?.[0] || '', rawText: text };
};

const Transactions = () => {
    const { showToast, confirmModal } = useNotification();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [formData, setFormData] = useState(blankForm());
    const [draftSource, setDraftSource] = useState('');
    const [draftNotice, setDraftNotice] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingId, setEditingId] = useState(null);

    const fetchData = async () => {
        try {
            const transactionResponse = await axios.get(apiUrl('/api/transactions'), authConfig());
            setTransactions(transactionResponse.data);
        } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to load your records.'); }
    };

    useEffect(() => { fetchData(); }, []);

    const saveTransaction = async (event) => {
        event.preventDefault();
        try {
            setError(''); setSuccess('');
            if (editingId) await axios.put(apiUrl(`/api/transactions/${editingId}`), formData, authConfig());
            else await axios.post(apiUrl('/api/transactions'), formData, authConfig());
            window.dispatchEvent(new Event('transactions-changed'));
            setFormData(blankForm()); setDraftSource(''); setDraftNotice(''); setEditingId(null);
            const msg = editingId ? 'Transaction updated.' : 'Transaction saved.';
            setSuccess(msg);
            showToast(msg, 'success');
            await fetchData();
        } catch (requestError) { 
            const msg = requestError.response?.data?.error || 'Unable to save this transaction.';
            setError(msg); 
            showToast(msg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await confirmModal({
            title: 'Delete Transaction',
            message: 'Delete this transaction? This cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            isDestructive: true
        });
        if (!confirmed) return;
        try {
            setError(''); setSuccess(''); await axios.delete(apiUrl(`/api/transactions/${id}`), authConfig());
            window.dispatchEvent(new Event('transactions-changed')); await fetchData();
            setSuccess('Transaction deleted.');
            showToast('Transaction deleted.', 'success');
        } catch (requestError) { 
            const msg = requestError.response?.data?.error || 'Unable to delete this transaction.';
            setError(msg); 
            showToast(msg, 'error');
        }
    };

    const applyDraft = (draft, source, notice) => {
        setEditingId(null);
        setFormData((current) => ({ ...current, ...draft, amount: draft.amount ? String(draft.amount) : current.amount }));
        setDraftSource(source); setDraftNotice(notice);
    };

    const startVoiceEntry = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { setError('Voice entry needs Chrome, Edge, or another browser that supports Speech Recognition.'); return; }
        const recognition = new SpeechRecognition(); recognition.lang = 'en-IN'; recognition.interimResults = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onerror = () => { setIsListening(false); setError('Voice recognition could not understand that request. Please try again or enter it manually.'); };
        recognition.onend = () => setIsListening(false);
        recognition.onresult = async (event) => {
            const text = event.results[0][0].transcript; setIsListening(false); setLoading(true); setError('');
            try {
                const response = await axios.post(apiUrl('/api/ai/parse-voice'), { text }, authConfig());
                applyDraft({ ...response.data, isVoice: true }, 'voice', `Heard: “${text}”. Please confirm the amount, category, description, and date before saving.`);
            } catch (requestError) { setError(requestError.response?.data?.error || 'Could not parse that voice entry. Try “I spent ₹250 on lunch today.”'); }
            finally { setLoading(false); }
        };
        recognition.start();
    };

    const handleReceipt = async (event) => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError('Choose an image file for receipt OCR.'); return; }
        setOcrLoading(true); setError('');
        try {
            const { data } = await recognize(file, 'eng', { logger: () => {} });
            const extracted = readReceipt(data.text || '');
            if (!extracted.amount) throw new Error('No amount found');
            applyDraft({ title: extracted.merchant || 'Receipt purchase', amount: extracted.amount, category: categoryFor(`${extracted.merchant} ${extracted.rawText}`), date: receiptDateToIso(extracted.date) || today(), type: 'expense', isVoice: false }, 'receipt', `OCR found merchant “${extracted.merchant || 'not clear'}”, amount ${formatINR(extracted.amount)}, and date “${extracted.date || 'not clear'}”. OCR can be wrong—review every field before saving.`);
        } catch { setError('Could not read that receipt. Use a clear, upright image or enter the transaction manually.'); }
        finally { setOcrLoading(false); }
    };

    const updateFriend = (index, field, value) => setSplitForm((current) => ({ ...current, friends: current.friends.map((friend, friendIndex) => friendIndex === index ? { ...friend, [field]: value } : friend) }));
    
    const startEdit = (transaction) => {
        setFormData({
            title: transaction.title,
            amount: String(transaction.amount),
            type: transaction.type,
            category: transaction.category,
            date: new Date(transaction.date).toISOString().slice(0, 10),
            isVoice: transaction.isVoice || false,
            isCredited: transaction.isCredited !== undefined ? transaction.isCredited : true
        });
        setEditingId(transaction._id); setDraftSource(''); setDraftNotice(''); setError(''); setSuccess('Editing transaction. Update the fields, then save.');
    };
    
    const cancelEdit = () => { setEditingId(null); setFormData(blankForm()); setDraftSource(''); setDraftNotice(''); setSuccess('Edit cancelled.'); };
    
    const saveSplit = async (event) => {
        event.preventDefault(); setError('');
        try {
            const payload = { ...splitForm, amount: Number(splitForm.amount), friends: splitForm.friends.map((friend) => ({ ...friend, amountOwed: Number(friend.amountOwed) })) };
            const response = await axios.post(apiUrl('/api/expense-splits'), payload, authConfig());
            setSplitResult(response.data); setSplitForm({ description: '', amount: '', splitMethod: 'equal', friends: [{ name: '', amountOwed: '' }] }); await fetchData();
        } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to calculate and save this split.'); }
    };

    return <div style={{ display: 'flex', background: '#f8fafc', minHeight: '100vh' }}>
        <Sidebar />
        <main className="app-main">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 className="title-main" style={{ fontSize: '30px', margin: 0 }}>Transactions</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>Manage income and expense records with date filtering.</p>
                </div>
                <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '12px', padding: '6px 14px', borderRadius: '20px', fontWeight: 600 }}>
                    📅 {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
            </div>
            {error && <p role="alert" style={{ color: '#dc2626', marginBottom: '16px' }}>{error}</p>}
            {success && <p role="status" style={{ color: '#059669', marginBottom: '16px' }}>{success}</p>}
            <div className="ledger-grid">
                <div className="bento-card" style={{ background: '#fff', height: 'fit-content' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>{editingId ? 'Edit Entry' : 'New Entry'}</h3>
                    <form onSubmit={saveTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label htmlFor="tx-desc-input" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #183630)', display: 'block', marginBottom: '4px' }}>Description</label>
                            <input id="tx-desc-input" className="input-wrapper" value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} required aria-label="Transaction Description" />
                        </div>
                        <div>
                            <label htmlFor="tx-amount-input" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #183630)', display: 'block', marginBottom: '4px' }}>Amount (INR ₹)</label>
                            <input id="tx-amount-input" className="input-wrapper" type="number" min="0.01" step="0.01" value={formData.amount} onChange={(event) => setFormData({ ...formData, amount: event.target.value })} required aria-label="Transaction Amount in INR" />
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <select className="input-wrapper" value={formData.type} onChange={(event) => setFormData({ ...formData, type: event.target.value })}>
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                            </select>
                            <select className="input-wrapper" value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })}>
                                {['General', 'Salary', 'Food', 'Shopping', 'Rent', 'Transport', 'Bills', 'Savings'].map((value) => <option key={value}>{value}</option>)}
                            </select>
                        </div>

                        {formData.type === 'income' && (
                            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Credited Status:</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isCredited: true })}
                                        style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: formData.isCredited ? '1px solid #10b981' : '1px solid #cbd5e1', background: formData.isCredited ? '#ecfdf5' : '#fff', color: formData.isCredited ? '#047857' : '#64748b', cursor: 'pointer' }}
                                    >
                                        Credited
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isCredited: false })}
                                        style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: !formData.isCredited ? '1px solid #f59e0b' : '1px solid #cbd5e1', background: !formData.isCredited ? '#fffbeb' : '#fff', color: !formData.isCredited ? '#b45309' : '#64748b', cursor: 'pointer' }}
                                    >
                                        Pending
                                    </button>
                                </div>
                            </div>
                        )}

                        <input className="input-wrapper" type="date" value={formData.date} onChange={(event) => setFormData({ ...formData, date: event.target.value })} required />
                        {draftNotice && <p style={{ fontSize: '12px', color: '#b45309', background: '#fffbeb', padding: '10px', borderRadius: '8px' }}>{draftNotice}</p>}
                        <button type="submit" className="btn-action">{editingId ? 'Save changes' : draftSource ? `Confirm ${draftSource} entry & save` : 'Save record'} <Plus size={18} /></button>
                        {editingId && <button type="button" onClick={cancelEdit} style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel edit</button>}
                    </form>
                    <div style={{ margin: '20px 0', textAlign: 'center', color: '#94a3b8' }}>Voice or receipt draft</div>
                    <button onClick={startVoiceEntry} disabled={loading || ocrLoading} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: isListening ? '2px solid #EAB308' : '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                        {loading ? <Loader2 className="animate-spin" /> : <Mic size={20} color={isListening ? '#EAB308' : '#64748b'} />} {isListening ? 'Listening…' : 'Speak an expense'}
                    </button>
                    <label style={{ display: 'block', marginTop: '10px', textAlign: 'center', padding: '14px', border: '1px dashed #94a3b8', borderRadius: '12px', cursor: ocrLoading ? 'wait' : 'pointer' }}>
                        {ocrLoading ? 'Reading receipt…' : <><Upload size={18} /> Upload receipt image</>}
                        <input type="file" accept="image/*" onChange={handleReceipt} disabled={ocrLoading || loading} hidden />
                    </label>
                </div>
                <div className="bento-card" style={{ background: '#fff' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px' }}>Transaction History</h3>
                    {!transactions.length && <p style={{ color: '#64748b' }}>No transactions yet.</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {transactions.map((transaction) => (
                            <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={transaction._id} style={{ padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {transaction.title}
                                        {transaction.type === 'income' && transaction.isCredited === false && (
                                            <span style={{ fontSize: '10px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={10} /> Pending (See Dashboard Notification)
                                            </span>
                                        )}
                                        {transaction.type === 'income' && transaction.isCredited !== false && (
                                            <span style={{ fontSize: '10px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <CheckCircle size={10} /> Credited
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                                        {transaction.category} · {new Date(transaction.date).toLocaleDateString()}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <b style={{ color: transaction.type === 'income' ? (transaction.isCredited === false ? '#d97706' : '#10b981') : '#ef4444' }}>
                                        {transaction.type === 'income' ? '+' : '-'} {formatINR(transaction.amount)}
                                    </b>

                                    <Pencil aria-label={`Edit ${transaction.title}`} size={16} color="#64748b" cursor="pointer" onClick={() => startEdit(transaction)} />
                                    <Trash2 aria-label={`Delete ${transaction.title}`} size={16} color="#cbd5e1" cursor="pointer" onClick={() => handleDelete(transaction._id)} />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    </div>;
};

export default Transactions;
