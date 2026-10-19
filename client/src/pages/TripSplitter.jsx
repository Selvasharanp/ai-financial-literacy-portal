import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, Plus, Trash2, Edit2, ArrowRight, 
  CheckCircle2, PlusCircle, ShieldCheck, X, Split, RotateCcw, CreditCard,
  Users, Mail, UserPlus, Clock, Ban, RefreshCw, Send,
  Receipt, FileText, Check, AlertCircle, Eye
} from 'lucide-react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { apiUrl, authConfig } from '../utils/api';
import { useNotification } from '../context/NotificationContext';

const formatINR = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
};

const TripSplitter = () => {
  const { showToast, confirmModal } = useNotification();
  const [searchParams] = useSearchParams();
  const [trips, setTrips] = useState([]);
  const [activeTripId, setActiveTripId] = useState(null);
  const [tripDetails, setTripDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Collaborative mode — create trip
  const [createMode, setCreateMode] = useState('personal'); // 'personal' | 'collaborative'
  const [collabTripName, setCollabTripName] = useState('');
  const [collabDescription, setCollabDescription] = useState('');
  const [collabStartDate, setCollabStartDate] = useState('');
  const [collabEndDate, setCollabEndDate] = useState('');
  const [myName, setMyName] = useState('');

  // Pending received invitations
  const [myPendingInvites, setMyPendingInvites] = useState([]);
  const [respondingInviteId, setRespondingInviteId] = useState(null);

  // Invite panel state
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLookup, setInviteLookup] = useState(null); // { exists, verified, name, userId, isSelf, isMember, isPending, canInvite }
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  // New Trip Modal
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [tripName, setTripName] = useState('');
  const [participants, setParticipants] = useState([
    { id: 'p_you', name: 'You' },
    { id: 'p_1', name: '' }
  ]);

  // Add Expense Modal
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [sharedWith, setSharedWith] = useState([]);
  const [expenseSplitType, setExpenseSplitType] = useState('equal'); // 'equal' | 'custom'
  const [expenseCustomShares, setExpenseCustomShares] = useState({}); // { [participantId]: string }

  // Edit Expense Modal
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editSharedWith, setEditSharedWith] = useState([]);
  const [editSplitType, setEditSplitType] = useState('equal'); // 'equal' | 'custom'
  const [editCustomShares, setEditCustomShares] = useState({});

  // Record Settlement Modal
  const [showRecordSettlementModal, setShowRecordSettlementModal] = useState(false);
  const [settlementFrom, setSettlementFrom] = useState('');
  const [settlementTo, setSettlementTo] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');

  // View Custom Shares Breakdown Modal
  const [viewCustomModalExpense, setViewCustomModalExpense] = useState(null);

  // Live calculation for Custom Amount Split (Add form)
  const customSumPaise = useMemo(() => {
    if (!tripDetails?.trip?.participants) return 0;
    return tripDetails.trip.participants.reduce((acc, p) => {
      const val = Number(expenseCustomShares[p.id]) || 0;
      return acc + Math.round(val * 100);
    }, 0);
  }, [tripDetails, expenseCustomShares]);

  const totalExpensePaise = useMemo(() => {
    return Math.round((Number(expenseAmount) || 0) * 100);
  }, [expenseAmount]);

  const customDiffPaise = totalExpensePaise - customSumPaise;

  // Live calculation for Custom Amount Split (Edit form)
  const editCustomSumPaise = useMemo(() => {
    if (!tripDetails?.trip?.participants) return 0;
    return tripDetails.trip.participants.reduce((acc, p) => {
      const val = Number(editCustomShares[p.id]) || 0;
      return acc + Math.round(val * 100);
    }, 0);
  }, [tripDetails, editCustomShares]);

  const editTotalExpensePaise = useMemo(() => {
    return Math.round((Number(editAmount) || 0) * 100);
  }, [editAmount]);

  const editCustomDiffPaise = editTotalExpensePaise - editCustomSumPaise;

  const fetchTrips = useCallback(async () => {
    try {
      const res = await axios.get(apiUrl('/api/trips'), authConfig());
      const tripList = res.data || [];
      setTrips(tripList);
      // Honour ?tripId=... query param from dashboard or invite accept redirect
      const urlTripId = searchParams.get('tripId');
      const defaultId = urlTripId && tripList.find(t => t._id === urlTripId)
        ? urlTripId
        : (tripList.length > 0 && !activeTripId ? tripList[0]._id : null);
      if (defaultId) setActiveTripId(defaultId);
    } catch (err) {
      setError('Unable to load trips.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMyPendingInvites = useCallback(async () => {
    try {
      const res = await axios.get(apiUrl('/api/my-pending-invitations'), authConfig());
      setMyPendingInvites(res.data || []);
    } catch {
      // Non-blocking
    }
  }, []);

  const handleAcceptPendingInvite = async (invId) => {
    setRespondingInviteId(invId);
    try {
      const res = await axios.post(apiUrl(`/api/my-pending-invitations/${invId}/accept`), {}, authConfig());
      showToast(res.data?.msg || 'Joined trip successfully!', 'success');
      await fetchMyPendingInvites();
      await fetchTrips();
      if (res.data?.tripId) {
        setActiveTripId(res.data.tripId);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to accept invitation.', 'error');
    } finally {
      setRespondingInviteId(null);
    }
  };

  const handleDeclinePendingInvite = async (invId) => {
    const confirmed = await confirmModal({
      title: 'Decline Trip Invitation',
      message: 'Are you sure you want to decline this trip invitation?',
      confirmText: 'Decline Invitation',
      cancelText: 'Keep Invitation',
      isDestructive: true
    });
    if (!confirmed) return;
    setRespondingInviteId(invId);
    try {
      await axios.post(apiUrl(`/api/my-pending-invitations/${invId}/decline`), {}, authConfig());
      showToast('Trip invitation declined.', 'info');
      await fetchMyPendingInvites();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to decline invitation.', 'error');
    } finally {
      setRespondingInviteId(null);
    }
  };

  const fetchTripDetails = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await axios.get(apiUrl(`/api/trips/${id}`), authConfig());
      setTripDetails(res.data);
      if (res.data?.trip?.participants?.length > 0) {
        setPaidBy(res.data.trip.participants[0].id);
        setSharedWith(res.data.trip.participants.map(p => p.id));
      }
    } catch (err) {
      setError('Unable to load trip details.');
    }
  }, []);

  useEffect(() => {
    fetchTrips();
    fetchMyPendingInvites();
  }, [fetchTrips, fetchMyPendingInvites]);

  useEffect(() => {
    if (activeTripId) {
      fetchTripDetails(activeTripId);
    }
  }, [activeTripId, fetchTripDetails]);

  // Support ?create=true from dashboard or links
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreateMode('collaborative');
      setShowNewTripModal(true);
    }
  }, [searchParams]);

  // Live synchronization: re-fetch when tab is focused
  useEffect(() => {
    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        fetchTrips();
        fetchMyPendingInvites();
        if (activeTripId) fetchTripDetails(activeTripId);
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [activeTripId, fetchTripDetails, fetchTrips, fetchMyPendingInvites]);

  // Create Trip Handlers
  const handleAddParticipantField = () => {
    setParticipants(prev => [
      ...prev,
      { id: `p_${Date.now()}_${prev.length}`, name: '' }
    ]);
  };

  const handleRemoveParticipantField = (idx) => {
    if (participants.length <= 2) return;
    setParticipants(prev => prev.filter((_, i) => i !== idx));
  };

  const handleParticipantNameChange = (idx, name) => {
    setParticipants(prev => {
      const updated = [...prev];
      updated[idx].name = name;
      return updated;
    });
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault();

    // --- Collaborative Mode ---
    if (createMode === 'collaborative') {
      if (!collabTripName.trim() || !myName.trim()) {
        showToast('Please enter a trip name and your display name.', 'error');
        return;
      }
      try {
        const res = await axios.post(apiUrl('/api/trips'), {
          name: collabTripName.trim(),
          description: collabDescription.trim(),
          startDate: collabStartDate || undefined,
          endDate: collabEndDate || undefined,
          collaborativeMode: true,
          myName: myName.trim()
        }, authConfig());
        setShowNewTripModal(false);
        setCollabTripName(''); setCollabDescription(''); setCollabStartDate(''); setCollabEndDate(''); setMyName('');
        const newTrip = res.data;
        setTrips(prev => [newTrip, ...prev]);
        setActiveTripId(newTrip._id);
        showToast(`Trip "${newTrip.name}" created successfully.`, 'success');
        // Open invite panel immediately
        setTimeout(() => setShowInvitePanel(true), 400);
      } catch (err) {
        showToast(err.response?.data?.error || 'Failed to create collaborative trip.', 'error');
      }
      return;
    }

    // --- Personal Mode (existing behaviour) ---
    const clean = participants.filter(p => p.name.trim() !== '');
    if (clean.length < 2) {
      showToast('Please enter at least 2 participants for the trip.', 'error');
      return;
    }
    try {
      const res = await axios.post(apiUrl('/api/trips'), {
        name: tripName,
        participants: clean
      }, authConfig());

      setShowNewTripModal(false);
      setTripName('');
      setParticipants([{ id: 'p_you', name: 'You' }, { id: 'p_1', name: '' }]);
      
      const newTrip = res.data;
      setTrips(prev => [newTrip, ...prev]);
      setActiveTripId(newTrip._id);
      showToast(`Trip "${newTrip.name}" created successfully.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create trip.', 'error');
    }
  };

  // --- Collaborative invite handlers ---
  const handleEmailLookup = async () => {
    const email = inviteEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteLookup({ error: 'Please enter a valid email address.' });
      return;
    }
    setInviteSearching(true);
    setInviteLookup(null);
    setInviteMsg('');
    try {
      const res = await axios.post(apiUrl('/api/trips/invite/lookup-email'), { email, tripId: activeTripId }, authConfig());
      setInviteLookup(res.data);
    } catch (err) {
      setInviteLookup({ error: err.response?.data?.error || 'Lookup failed.' });
    } finally {
      setInviteSearching(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteLookup?.userId || !activeTripId) return;
    setInviteSending(true);
    setInviteMsg('');
    try {
      const res = await axios.post(
        apiUrl(`/api/trips/${activeTripId}/invitations`),
        { recipientUserId: inviteLookup.userId },
        authConfig()
      );
      const sent = res.data.emailSent;
      setInviteMsg(sent
        ? `✅ Invitation email sent to ${inviteLookup.name}! The invitation is also available in their FinWise portal.`
        : `✅ Invitation created successfully. The invitation is available in the recipient's FinWise portal. Email notifications are not configured.`);
      setInviteEmail('');
      setInviteLookup(null);
      fetchTripDetails(activeTripId); // refresh to show new pending invites
    } catch (err) {
      setInviteMsg(`❌ ${err.response?.data?.error || 'Failed to send invitation.'}`);
    } finally {
      setInviteSending(false);
    }
  };

  const handleRevokeInvite = async (invId) => {
    const confirmed = await confirmModal({
      title: 'Revoke Invitation',
      message: 'Revoke this trip invitation? The pending invitation link will become invalid.',
      confirmText: 'Revoke',
      cancelText: 'Keep Invitation',
      isDestructive: true
    });
    if (!confirmed) return;
    try {
      await axios.delete(apiUrl(`/api/trips/${activeTripId}/invitations/${invId}`), authConfig());
      showToast('Trip invitation revoked.', 'info');
      fetchTripDetails(activeTripId);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to revoke invitation.', 'error');
    }
  };

  const handleResendInvite = async (invId) => {
    try {
      const res = await axios.post(apiUrl(`/api/trips/${activeTripId}/invitations/${invId}/resend`), {}, authConfig());
      showToast(res.data.emailSent ? 'Invitation resent via email!' : 'Invitation updated and available in recipient\'s FinWise portal.', 'success');
      fetchTripDetails(activeTripId);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to resend invitation.', 'error');
    }
  };

  // Open Add Expense Modal
  const openAddExpenseModal = () => {
    if (tripDetails?.trip?.participants?.length > 0) {
      setPaidBy(tripDetails.trip.participants[0].id);
      setSharedWith(tripDetails.trip.participants.map(p => p.id));
      const initialCustom = {};
      tripDetails.trip.participants.forEach(p => {
        initialCustom[p.id] = '';
      });
      setExpenseCustomShares(initialCustom);
    }
    setExpenseSplitType('equal');
    setExpenseDesc('');
    setExpenseAmount('');
    setShowAddExpenseModal(true);
  };

  // Add Expense Handler
  const handleAddExpense = async (e) => {
    e.preventDefault();
    const totalAmt = Number(expenseAmount);
    if (!activeTripId || !expenseDesc.trim() || !Number.isFinite(totalAmt) || totalAmt <= 0 || !paidBy) {
      showToast('Please fill out all required expense fields with positive amounts.', 'error');
      return;
    }

    const payload = {
      description: expenseDesc.trim(),
      amount: totalAmt,
      paidBy,
      splitType: expenseSplitType
    };

    if (expenseSplitType === 'custom') {
      const shares = (tripDetails?.trip?.participants || []).map(p => ({
        participantId: p.id,
        amount: Number(expenseCustomShares[p.id]) || 0
      }));

      const sumPaise = shares.reduce((acc, s) => acc + Math.round(s.amount * 100), 0);
      const totalPaise = Math.round(totalAmt * 100);

      if (sumPaise !== totalPaise) {
        const diff = Math.abs(totalPaise - sumPaise) / 100;
        const msg = sumPaise < totalPaise
          ? `The sum of individual amounts (₹${(sumPaise / 100).toFixed(2)}) is less than total expense (₹${totalAmt.toFixed(2)}) by ₹${diff.toFixed(2)}.`
          : `The sum of individual amounts (₹${(sumPaise / 100).toFixed(2)}) exceeds total expense (₹${totalAmt.toFixed(2)}) by ₹${diff.toFixed(2)}.`;
        showToast(msg, 'error');
        return;
      }

      payload.participantShares = shares;
    } else {
      if (sharedWith.length === 0) {
        showToast('Please select at least 1 person to share this expense with.', 'error');
        return;
      }
      payload.sharedWith = sharedWith;
    }

    try {
      await axios.post(apiUrl(`/api/trips/${activeTripId}/expenses`), payload, authConfig());

      setShowAddExpenseModal(false);
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseSplitType('equal');
      setExpenseCustomShares({});
      showToast('Trip expense recorded.', 'success');
      fetchTripDetails(activeTripId);
      fetchTrips();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add trip expense.', 'error');
    }
  };

  // Open Edit Expense Modal
  const openEditModal = (exp) => {
    setEditingExpenseId(exp._id);
    setEditDesc(exp.description);
    setEditAmount(String(exp.amount));
    setEditPaidBy(exp.paidBy);
    const isCustom = exp.splitType === 'custom';
    setEditSplitType(isCustom ? 'custom' : 'equal');
    setEditSharedWith(Array.isArray(exp.sharedWith) ? exp.sharedWith : []);

    const initialEditCustom = {};
    (tripDetails?.trip?.participants || []).forEach(p => {
      const match = (exp.participantShares || []).find(s => s.participantId === p.id);
      initialEditCustom[p.id] = match ? String(match.amount) : '';
    });
    setEditCustomShares(initialEditCustom);
    setShowEditExpenseModal(true);
  };

    // Submit Edit Expense
  const handleEditExpenseSubmit = async (e) => {
    e.preventDefault();
    const totalAmt = Number(editAmount);
    if (!activeTripId || !editingExpenseId || !editDesc.trim() || !Number.isFinite(totalAmt) || totalAmt <= 0 || !editPaidBy) {
      showToast('Please fill out all required expense fields with positive amounts.', 'error');
      return;
    }

    const payload = {
      description: editDesc.trim(),
      amount: totalAmt,
      paidBy: editPaidBy,
      splitType: editSplitType
    };

    if (editSplitType === 'custom') {
      const shares = (tripDetails?.trip?.participants || []).map(p => ({
        participantId: p.id,
        amount: Number(editCustomShares[p.id]) || 0
      }));

      const sumPaise = shares.reduce((acc, s) => acc + Math.round(s.amount * 100), 0);
      const totalPaise = Math.round(totalAmt * 100);

      if (sumPaise !== totalPaise) {
        const diff = Math.abs(totalPaise - sumPaise) / 100;
        const msg = sumPaise < totalPaise
          ? `The sum of individual amounts (₹${(sumPaise / 100).toFixed(2)}) is less than total expense (₹${totalAmt.toFixed(2)}) by ₹${diff.toFixed(2)}.`
          : `The sum of individual amounts (₹${(sumPaise / 100).toFixed(2)}) exceeds total expense (₹${totalAmt.toFixed(2)}) by ₹${diff.toFixed(2)}.`;
        showToast(msg, 'error');
        return;
      }

      payload.participantShares = shares;
    } else {
      if (!Array.isArray(editSharedWith) || editSharedWith.length === 0) {
        showToast('Expense must be shared with at least 1 person.', 'error');
        return;
      }
      payload.sharedWith = editSharedWith;
    }

    try {
      await axios.put(apiUrl(`/api/trips/${activeTripId}/expenses/${editingExpenseId}`), payload, authConfig());

      setShowEditExpenseModal(false);
      showToast('Trip expense updated.', 'success');
      fetchTripDetails(activeTripId);
      fetchTrips();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update trip expense.', 'error');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    const confirmed = await confirmModal({
      title: 'Delete Expense',
      message: 'Delete this trip expense? Split calculations will update automatically.',
      confirmText: 'Delete Expense',
      cancelText: 'Cancel',
      isDestructive: true
    });
    if (!confirmed) return;
    try {
      await axios.delete(apiUrl(`/api/trips/${activeTripId}/expenses/${expenseId}`), authConfig());
      showToast('Trip expense deleted.', 'success');
      fetchTripDetails(activeTripId);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete expense.', 'error');
    }
  };

  // Open Record Settlement Modal with pre-filled pair
  const openRecordSettlementForPair = (fromId, toId, defaultAmount) => {
    setSettlementFrom(fromId);
    setSettlementTo(toId);
    setSettlementAmount(String(defaultAmount || ''));
    setSettlementNotes('');
    setShowRecordSettlementModal(true);
  };

  // Submit Record Settlement
  const handleRecordSettlementSubmit = async (e) => {
    e.preventDefault();
    if (!activeTripId || !settlementFrom || !settlementTo || settlementFrom === settlementTo || Number(settlementAmount) <= 0) {
      showToast('Please enter valid settlement details.', 'error');
      return;
    }
    try {
      await axios.post(apiUrl(`/api/trips/${activeTripId}/settlements`), {
        fromParticipantId: settlementFrom,
        toParticipantId: settlementTo,
        amount: Number(settlementAmount),
        notes: settlementNotes
      }, authConfig());

      setShowRecordSettlementModal(false);
      setSettlementAmount('');
      setSettlementNotes('');
      showToast('Settlement payment recorded.', 'success');
      fetchTripDetails(activeTripId);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to record settlement payment.', 'error');
    }
  };

  const handleDeleteSettlement = async (settlementId) => {
    const confirmed = await confirmModal({
      title: 'Remove Settlement',
      message: 'Remove this recorded settlement payment?',
      confirmText: 'Remove Payment',
      cancelText: 'Cancel',
      isDestructive: true
    });
    if (!confirmed) return;
    try {
      await axios.delete(apiUrl(`/api/trips/${activeTripId}/settlements/${settlementId}`), authConfig());
      showToast('Settlement record removed.', 'success');
      fetchTripDetails(activeTripId);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete settlement record.', 'error');
    }
  };

  const handleDeleteTrip = async (tId) => {
    const confirmed = await confirmModal({
      title: 'Delete Trip',
      message: 'Are you sure you want to delete this trip and all its recorded expenses and settlements? This action cannot be undone.',
      confirmText: 'Delete Entire Trip',
      cancelText: 'Cancel',
      isDestructive: true
    });
    if (!confirmed) return;
    try {
      await axios.delete(apiUrl(`/api/trips/${tId}`), authConfig());
      const remaining = trips.filter(t => t._id !== tId);
      setTrips(remaining);
      if (remaining.length > 0) {
        setActiveTripId(remaining[0]._id);
      } else {
        setActiveTripId(null);
        setTripDetails(null);
      }
      showToast('Trip deleted successfully.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete trip.', 'error');
    }
  };


  return (
    <div style={{ display: 'flex', background: 'var(--bg-main)', minHeight: '100vh' }}>
      <Sidebar />

      <main className="app-main">
        
        {/* Top Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Plane size={28} color="var(--primary)" />
              <h1 style={{ fontSize: '30px', margin: 0 }}>
                Group Trip Splitter
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
              True running pairwise debt ledger, integer-paise accounting, and settlement optimization.
            </p>
          </div>

          <button className="btn-action" onClick={() => setShowNewTripModal(true)} style={{ height: '42px', padding: '0 20px', fontSize: '14px' }}>
            <PlusCircle size={18} /> Create New Trip
          </button>
        </header>

        {/* Isolation Alert Banner */}
        <div style={{ background: '#f4f6f8', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-main)' }}>
          <ShieldCheck size={18} color="var(--primary)" />
          <span><strong>Personal Finance Isolation:</strong> Trip expenses are tracked independently for group balance calculation and do not alter your personal Available Safe Balance or personal monthly budget snapshot.</span>
        </div>

        {/* Received Pending Invitations Banner */}
        {myPendingInvites.length > 0 && (
          <div style={{ background: '#fffbf0', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Clock size={16} color="#d97706" />
              <strong style={{ fontSize: '14px', color: '#92400e' }}>
                You have {myPendingInvites.length} pending trip invitation{myPendingInvites.length > 1 ? 's' : ''}!
              </strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myPendingInvites.map(inv => (
                <div key={inv._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--text-main)', display: 'block' }}>{inv.tripName}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Invited by <strong>{inv.creatorName}</strong> {inv.tripDescription ? `— ${inv.tripDescription}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => handleAcceptPendingInvite(inv._id)}
                      disabled={respondingInviteId === inv._id}
                      className="btn-action"
                      style={{ padding: '6px 14px', fontSize: '12px', background: '#183630' }}
                    >
                      {respondingInviteId === inv._id ? 'Joining...' : 'Accept & Join'}
                    </button>
                    <button 
                      onClick={() => handleDeclinePendingInvite(inv._id)}
                      disabled={respondingInviteId === inv._id}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading group trips...</div>
        ) : trips.length === 0 ? (
          <div className="bento-card" style={{ padding: '48px', textAlign: 'center' }}>
            <Split size={48} color="var(--primary)" style={{ marginBottom: '16px', opacity: 0.8 }} />
            <h2 style={{ fontSize: '22px', marginBottom: '8px' }}>No Group Trips Yet</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '460px', margin: '0 auto 24px auto' }}>
              Create a trip for your upcoming vacation, weekend getaway, or roommate bill sharing to split expenses fairly.
            </p>
            <button className="btn-action" onClick={() => setShowNewTripModal(true)} style={{ padding: '12px 24px' }}>
              <PlusCircle size={18} /> Start Your First Trip
            </button>
          </div>
        ) : (
          <div className="trip-splitter-layout-grid">
            
            {/* Trip List Selector */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Your Trips
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {trips.map(t => (
                  <div
                    key={t._id}
                    onClick={() => setActiveTripId(t._id)}
                    className="bento-card"
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      border: activeTripId === t._id ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: activeTripId === t._id ? '#ffffff' : '#fafafa'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{t.name}</strong>
                      <span className={`stitch-badge ${t.isCreator ? 'badge-dark' : 'badge-green'}`} style={{ fontSize: '10px' }}>
                        {t.collaborativeMode ? (t.isCreator ? 'Creator' : 'Joined') : 'Personal'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <span>{t.acceptedMemberCount || t.participants?.length || 0} members</span>
                      <span>{formatINR(t.totalExpenses || 0)}</span>
                    </div>

                    {t.collaborativeMode && typeof t.currentUserNetBalance === 'number' && (
                      <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>
                        {t.currentUserNetBalance > 0 ? (
                          <span style={{ color: '#047857' }}>+{formatINR(t.currentUserNetBalance)} to receive</span>
                        ) : t.currentUserNetBalance < 0 ? (
                          <span style={{ color: '#b91c1c' }}>{formatINR(Math.abs(t.currentUserNetBalance))} to pay</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Settled</span>
                        )}
                      </div>
                    )}

                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      {t.startDate ? `${new Date(t.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}` : `Created ${new Date(t.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Trip Details & Settlement Board */}
            {tripDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Trip Header Banner */}
                <div className="bento-card" style={{ padding: '24px', background: 'var(--primary)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <span className="stitch-badge badge-dark" style={{ marginBottom: '8px', color: 'var(--gold)', borderColor: 'var(--gold)' }}>
                      Active Trip Overview
                    </span>
                    <h2 style={{ fontSize: '26px', margin: '4px 0', color: '#F7F4EE' }}>
                      {tripDetails.trip?.name}
                    </h2>
                    <span style={{ fontSize: '13px', opacity: 0.9 }}>
                      Participants: {tripDetails.trip?.participants?.map(p => p.name).join(', ')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8, display: 'block' }}>
                        Total Trip Cost
                      </span>
                      <strong style={{ fontSize: '24px', color: 'var(--gold)', fontWeight: 800 }}>
                        {formatINR(tripDetails.totalTripExpense)}
                      </strong>
                    </div>

                    <button 
                      className="btn-action" 
                      onClick={openAddExpenseModal}
                      style={{ background: 'var(--gold)', color: 'var(--primary)', fontWeight: 800, padding: '10px 18px' }}
                    >
                      <Plus size={16} /> Record Shared Expense
                    </button>

                    <button 
                      className="btn-secondary"
                      onClick={() => {
                        if (tripDetails.trip?.participants?.length >= 2) {
                          setSettlementFrom(tripDetails.trip.participants[0].id);
                          setSettlementTo(tripDetails.trip.participants[1].id);
                        }
                        setShowRecordSettlementModal(true);
                      }}
                      style={{ padding: '10px 16px', fontSize: '13px', background: '#ffffff', color: 'var(--primary)', borderColor: '#ffffff' }}
                    >
                      <CreditCard size={15} /> Record Payment
                    </button>

                    <button 
                      className="btn-secondary"
                      onClick={() => {
                        fetchTripDetails(activeTripId);
                        fetchTrips();
                      }}
                      title="Sync shared changes with server"
                      style={{ padding: '10px 14px', fontSize: '13px', background: 'rgba(255,255,255,0.15)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={14} /> Sync
                    </button>

                    <button 
                      onClick={() => handleDeleteTrip(tripDetails.trip._id)}
                      style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '6px' }}
                      title="Delete Trip"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* COLLABORATIVE TRIP: Invite Members Panel */}
                {tripDetails.trip?.collaborativeMode && tripDetails.isCreator && (
                  <div className="bento-card" style={{ padding: '22px', border: showInvitePanel ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserPlus size={18} color="var(--primary)" />
                        <h3 style={{ fontSize: '16px', margin: 0, fontWeight: 800 }}>Invite Members</h3>
                        <span className="stitch-badge badge-dark" style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7' }}>Collaborative Trip</span>
                      </div>
                      <button onClick={() => setShowInvitePanel(!showInvitePanel)}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {showInvitePanel ? 'Hide' : 'Manage Members'}
                      </button>
                    </div>

                    {/* Member List */}
                    {tripDetails.members && tripDetails.members.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Accepted Members</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {tripDetails.members.map(m => (
                            <span key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0faf5', border: '1px solid #a7f3d0', borderRadius: '20px', padding: '4px 12px', fontSize: '13px', color: '#065f46' }}>
                              <CheckCircle2 size={13} />
                              {m.name} {m.role === 'creator' && <span style={{ fontSize: '10px', color: '#999' }}>(creator)</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {showInvitePanel && (
                      <>
                        {/* Email search */}
                        <label htmlFor="invite-email-input" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                          Friend's FinWise Email Address:
                        </label>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                          <input
                            id="invite-email-input"
                            className="input-wrapper"
                            value={inviteEmail}
                            onChange={e => { setInviteEmail(e.target.value); setInviteLookup(null); setInviteMsg(''); }}
                            onKeyDown={e => e.key === 'Enter' && handleEmailLookup()}
                            style={{ flex: 1 }}
                            aria-label="Friend's FinWise email address"
                          />
                          <button
                            onClick={handleEmailLookup}
                            disabled={inviteSearching}
                            className="btn-secondary"
                            style={{ padding: '0 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                          >
                            {inviteSearching ? 'Searching…' : <><Mail size={14} /> Look Up</>}
                          </button>
                        </div>

                        {/* Lookup result */}
                        {inviteLookup && (
                          <div style={{ borderRadius: '10px', padding: '14px 16px', marginBottom: '12px', fontSize: '13px',
                            background: inviteLookup.error ? '#fef2f2' : inviteLookup.canInvite ? '#f0faf5' : '#fff8ec',
                            border: `1px solid ${inviteLookup.error ? '#fca5a5' : inviteLookup.canInvite ? '#a7f3d0' : '#fde68a'}`,
                            color: inviteLookup.error ? '#b91c1c' : inviteLookup.canInvite ? '#065f46' : '#78350f'
                          }}>
                            {inviteLookup.error && <p style={{ margin: 0 }}>❌ {inviteLookup.error}</p>}
                            {!inviteLookup.error && !inviteLookup.exists && (
                              <p style={{ margin: 0 }}>📭 {inviteLookup.message || 'This email is not registered with FinWise yet. Ask your friend to create an account and verify their email before inviting them.'}</p>
                            )}
                            {!inviteLookup.error && inviteLookup.exists && inviteLookup.verified === false && (
                              <p style={{ margin: 0 }}>⚠️ {inviteLookup.message || 'This account has not verified their email yet. Ask your friend to verify their email before receiving a trip invitation.'}</p>
                            )}
                            {!inviteLookup.error && inviteLookup.exists && inviteLookup.isSelf && (
                              <p style={{ margin: 0 }}>⚠️ {inviteLookup.message || 'You cannot invite yourself to your own trip.'}</p>
                            )}
                            {!inviteLookup.error && inviteLookup.exists && inviteLookup.isMember && (
                              <p style={{ margin: 0 }}>👥 {inviteLookup.message || `${inviteLookup.name} is already a member of this trip.`}</p>
                            )}
                            {!inviteLookup.error && inviteLookup.exists && inviteLookup.isPending && (
                              <p style={{ margin: 0 }}>⏳ {inviteLookup.message || `A pending invitation already exists for ${inviteLookup.name}.`}</p>
                            )}
                            {!inviteLookup.error && inviteLookup.canInvite && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                <span>✅ Found verified user: <strong>{inviteLookup.name}</strong></span>
                                <button
                                  onClick={handleSendInvite}
                                  disabled={inviteSending}
                                  style={{ background: '#183630', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: inviteSending ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <Send size={13} />{inviteSending ? 'Sending…' : 'Send Invitation'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {inviteMsg && (
                          <div style={{ borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', background: inviteMsg.startsWith('❌') ? '#fef2f2' : '#f0faf5', border: `1px solid ${inviteMsg.startsWith('❌') ? '#fca5a5' : '#a7f3d0'}`, color: inviteMsg.startsWith('❌') ? '#b91c1c' : '#065f46', wordBreak: 'break-all' }}>
                            {inviteMsg}
                          </div>
                        )}

                        {/* Pending Invitations */}
                        {tripDetails.pendingInvitations?.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Pending Invitations</p>
                            {tripDetails.pendingInvitations.map(inv => (
                              <div key={inv._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fffbf0', borderRadius: '8px', marginBottom: '6px', border: '1px solid #fde68a', fontSize: '13px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Clock size={13} color="#d97706" />
                                  <span><strong>{inv.recipientName}</strong> — {inv.recipientEmail}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button onClick={() => handleResendInvite(inv._id)}
                                    style={{ background: 'none', border: '1px solid #d97706', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <RefreshCw size={11} /> Resend
                                  </button>
                                  <button onClick={() => handleRevokeInvite(inv._id)}
                                    style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Ban size={11} /> Revoke
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* COLLABORATIVE TRIP: Member (non-creator) view */}
                {tripDetails.trip?.collaborativeMode && !tripDetails.isCreator && (
                  <div className="bento-card" style={{ padding: '18px 22px', background: '#f0faf5', border: '1px solid #a7f3d0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#065f46' }}>
                      <Users size={16} />
                      <span>You are a member of this collaborative trip. {tripDetails.members?.length ? `${tripDetails.members.length} accepted member(s).` : ''}</span>
                    </div>
                  </div>
                )}

                {/* RUNNING PAIRWISE PAYMENT MATRIX (Section 4 & 5) */}
                <div className="bento-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={20} color="var(--primary)" />
                      <h3 style={{ fontSize: '18px', margin: 0 }}>Running Pairwise Debt Matrix</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className="stitch-badge badge-dark" style={{ fontSize: '11px' }}>
                        Total Debt: {formatINR(tripDetails.totalOutstandingDebt)}
                      </span>
                      <span className="stitch-badge badge-dark" style={{ fontSize: '11px' }}>
                        Total Credit: {formatINR(tripDetails.totalOutstandingCredit)}
                      </span>
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '18px', fontStyle: 'italic', background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                    💡 <strong>Running Pairwise Ledger:</strong> Rows represent <strong>debtors</strong> (who owes). Columns represent <strong>creditors</strong> (who is owed). Each cell reflects direct net pairwise obligations across expenses, netting opposing debts without redirection.
                  </p>

                  {tripDetails.isAllSettled ? (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '16px 20px', borderRadius: '10px', color: '#047857', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={18} /> All settled — nobody owes anything!
                    </div>
                  ) : (
                    <>
                      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
                          <thead>
                            <tr style={{ background: 'var(--primary)', color: '#ffffff' }}>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700, minWidth: '180px' }}>
                                Debtor (Pays to ↓) / Creditor (Receives from →)
                              </th>
                              {tripDetails.runningMatrix?.participantNames?.map((name, cIdx) => (
                                <th key={cIdx} style={{ padding: '12px', fontWeight: 700, minWidth: '100px' }}>
                                  {name}
                                </th>
                              ))}
                              <th style={{ padding: '12px', fontWeight: 800, background: 'var(--gold)', color: 'var(--primary)', minWidth: '110px' }}>
                                Total Owed (Debt)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {tripDetails.runningMatrix?.matrix?.map((row, rIdx) => {
                              const debtorName = tripDetails.runningMatrix.participantNames[rIdx];
                              const rowTotal = tripDetails.runningMatrix.rowTotals?.[rIdx] || 0;

                              return (
                                <tr key={rIdx} style={{ borderBottom: '1px solid var(--border)', background: rIdx % 2 === 0 ? '#ffffff' : '#fcfbf9' }}>
                                  <td style={{ padding: '12px 14px', fontWeight: 700, textAlign: 'left', color: 'var(--primary)' }}>
                                    {debtorName}
                                  </td>
                                  {row.map((val, cIdx) => {
                                    const isDiagonal = rIdx === cIdx;
                                    return (
                                      <td 
                                        key={cIdx} 
                                        style={{ 
                                          padding: '12px', 
                                          fontWeight: val > 0 ? 800 : 400, 
                                          color: isDiagonal ? 'var(--text-muted)' : val > 0 ? '#dc2626' : 'var(--text-muted)',
                                          background: isDiagonal ? '#f3f4f6' : val > 0 ? '#fef2f2' : 'transparent'
                                        }}
                                      >
                                        {isDiagonal ? '—' : val > 0 ? formatINR(val) : '₹0'}
                                      </td>
                                    );
                                  })}
                                  <td style={{ padding: '12px', fontWeight: 800, color: rowTotal > 0 ? '#dc2626' : 'var(--text-muted)', background: '#fafafa' }}>
                                    {rowTotal > 0 ? formatINR(rowTotal) : '₹0'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                              <td style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text-main)' }}>
                                Total to Receive (Credit)
                              </td>
                              {tripDetails.runningMatrix?.colTotals?.map((colTotal, cIdx) => (
                                <td key={cIdx} style={{ padding: '12px', color: colTotal > 0 ? '#047857' : 'var(--text-muted)' }}>
                                  {colTotal > 0 ? formatINR(colTotal) : '₹0'}
                                </td>
                              ))}
                              <td style={{ padding: '12px', background: 'var(--gold)', color: 'var(--primary)', fontWeight: 900 }}>
                                {formatINR(tripDetails.totalOutstandingDebt)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Direct Pairwise Obligations List */}
                      <div style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
                            Direct Pairwise Debts ({tripDetails.pairwiseDebts?.length || 0})
                          </h4>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Direct transfers based on the running matrix
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {tripDetails.pairwiseDebts?.map((debt, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                                <ArrowRight size={16} color="var(--primary)" />
                                <span>
                                  <strong>{debt.fromName}</strong> owes <strong>{debt.toName}</strong>: <strong style={{ color: '#dc2626', fontSize: '15px' }}>{formatINR(debt.amount)}</strong>
                                </span>
                              </div>
                              <button 
                                onClick={() => openRecordSettlementForPair(debt.fromId, debt.toId, debt.amount)}
                                className="btn-secondary"
                                style={{ padding: '5px 12px', fontSize: '12px', background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}
                              >
                                Settle Debt
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Recorded Shared Expenses Ledger */}
                <div className="bento-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '18px', margin: 0 }}>Recorded Shared Expenses ({tripDetails.expenses?.length || 0})</h3>
                    <button className="btn-secondary" onClick={openAddExpenseModal} style={{ padding: '6px 14px', fontSize: '12px' }}>
                      + Add Expense
                    </button>
                  </div>

                  {tripDetails.expenses?.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No expenses logged yet. Click "Record Shared Expense" above to add trip items.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                            <th style={{ padding: '12px' }}>Description</th>
                            <th style={{ padding: '12px' }}>Paid By</th>
                            <th style={{ padding: '12px' }}>Shared With</th>
                            <th style={{ padding: '12px' }}>Amount</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tripDetails.expenses.map(exp => {
                            const payerObj = tripDetails.trip?.participants?.find(p => p.id === exp.paidBy);
                            const sharedNames = exp.sharedWith?.map(sId => {
                              const match = tripDetails.trip?.participants?.find(p => p.id === sId);
                              return match ? match.name : sId;
                            }).join(', ');

                            return (
                              <tr key={exp._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '14px', fontWeight: 700 }}>
                                  {exp.description}
                                  {exp.splitType === 'custom' && (
                                    <span 
                                      onClick={() => setViewCustomModalExpense(exp)}
                                      className="stitch-badge badge-green" 
                                      style={{ fontSize: '10px', marginLeft: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                      title="Click to view custom split breakdown"
                                    >
                                      <Users size={11} /> Custom Split
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '14px', color: 'var(--primary)' }}>{payerObj?.name || exp.paidBy}</td>
                                <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '12px' }}>{sharedNames}</td>
                                <td style={{ padding: '14px', fontWeight: 800 }}>{formatINR(exp.amount)}</td>
                                <td style={{ padding: '14px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    {exp.splitType === 'custom' && (
                                      <button 
                                        onClick={() => setViewCustomModalExpense(exp)}
                                        style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', padding: '4px' }}
                                        title="View Custom Breakdown"
                                      >
                                        <Eye size={16} />
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => openEditModal(exp)}
                                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                      title="Edit Expense"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteExpense(exp._id)}
                                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                      title="Delete Expense"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Recorded Settlements Ledger */}
                {tripDetails.recordedSettlements?.length > 0 && (
                  <div className="bento-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', margin: 0 }}>Recorded Settlement Payments ({tripDetails.recordedSettlements.length})</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                            <th style={{ padding: '12px' }}>Date</th>
                            <th style={{ padding: '12px' }}>Payer (Debtor)</th>
                            <th style={{ padding: '12px' }}>Payee (Creditor)</th>
                            <th style={{ padding: '12px' }}>Amount Paid</th>
                            <th style={{ padding: '12px' }}>Notes</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>Undo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tripDetails.recordedSettlements.map(s => {
                            const fromName = tripDetails.trip?.participants?.find(p => p.id === s.fromParticipantId)?.name || s.fromParticipantId;
                            const toName = tripDetails.trip?.participants?.find(p => p.id === s.toParticipantId)?.name || s.toParticipantId;

                            return (
                              <tr key={s._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '14px', color: 'var(--text-muted)' }}>
                                  {new Date(s.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                </td>
                                <td style={{ padding: '14px', fontWeight: 700 }}>{fromName}</td>
                                <td style={{ padding: '14px', fontWeight: 700, color: 'var(--primary)' }}>{toName}</td>
                                <td style={{ padding: '14px', fontWeight: 800, color: '#047857' }}>{formatINR(s.amount)}</td>
                                <td style={{ padding: '14px', color: 'var(--text-muted)' }}>{s.notes || '—'}</td>
                                <td style={{ padding: '14px', textAlign: 'right' }}>
                                  <button 
                                    onClick={() => handleDeleteSettlement(s._id)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                    title="Undo / Delete Settlement Payment"
                                  >
                                    <RotateCcw size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </main>

      {/* CREATE NEW TRIP MODAL */}
      <AnimatePresence>
        {showNewTripModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bento-card" style={{ width: '100%', maxWidth: '520px', background: '#ffffff', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Create New Group Trip</h3>
                <button onClick={() => setShowNewTripModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              {/* Mode Toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                <button type="button" onClick={() => setCreateMode('personal')}
                  style={{ padding: '10px', borderRadius: '10px', border: `2px solid ${createMode === 'personal' ? 'var(--primary)' : 'var(--border)'}`, background: createMode === 'personal' ? 'var(--primary)' : '#fafafa', color: createMode === 'personal' ? '#fff' : 'var(--text-main)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                  👥 Personal Trip
                </button>
                <button type="button" onClick={() => setCreateMode('collaborative')}
                  style={{ padding: '10px', borderRadius: '10px', border: `2px solid ${createMode === 'collaborative' ? 'var(--primary)' : 'var(--border)'}`, background: createMode === 'collaborative' ? 'var(--primary)' : '#fafafa', color: createMode === 'collaborative' ? '#fff' : 'var(--text-main)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                  🔗 Collaborative Trip
                </button>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', fontStyle: 'italic' }}>
                {createMode === 'personal'
                  ? 'Enter participant names manually. Only you can manage this trip.'
                  : 'You manage this trip and invite friends via email. Friends join with their own accounts.'}
              </p>

              <form onSubmit={handleCreateTrip} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {createMode === 'collaborative' ? (
                  <>
                    <div>
                      <label htmlFor="collab-trip-name" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Trip Name</label>
                      <input id="collab-trip-name" className="input-wrapper" value={collabTripName} onChange={e => setCollabTripName(e.target.value)} required aria-label="Trip Name" />
                    </div>
                    <div>
                      <label htmlFor="collab-my-name" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Your Display Name in this Trip</label>
                      <input id="collab-my-name" className="input-wrapper" value={myName} onChange={e => setMyName(e.target.value)} required aria-label="Display Name" />
                    </div>
                    <div>
                      <label htmlFor="collab-trip-desc" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Description (optional)</label>
                      <input id="collab-trip-desc" className="input-wrapper" value={collabDescription} onChange={e => setCollabDescription(e.target.value)} aria-label="Description" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Start Date (optional)</label>
                        <input type="date" className="input-wrapper" value={collabStartDate} onChange={e => setCollabStartDate(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>End Date (optional)</label>
                        <input type="date" className="input-wrapper" value={collabEndDate} onChange={e => setCollabEndDate(e.target.value)} />
                      </div>
                    </div>
                    <div style={{ background: '#f0faf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#065f46' }}>
                      💡 After creating the trip, use <strong>Manage Members</strong> to invite friends by email.
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="personal-trip-name" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Trip Name</label>
                      <input id="personal-trip-name" className="input-wrapper" value={tripName} onChange={(e) => setTripName(e.target.value)} required aria-label="Trip Name" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 700 }}>Group Participants</label>
                        <button type="button" onClick={handleAddParticipantField} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                          + Add Person
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                        {participants.map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input className="input-wrapper" value={p.name} onChange={(e) => handleParticipantNameChange(idx, e.target.value)} required aria-label={`Participant ${idx + 1} Name`} />
                            {participants.length > 2 && (
                              <button type="button" onClick={() => handleRemoveParticipantField(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <button type="submit" className="btn-action" style={{ width: '100%', padding: '14px', marginTop: '6px' }}>
                  {createMode === 'collaborative' ? 'Create Collaborative Trip' : 'Create Trip & Add Expenses'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD SHARED EXPENSE MODAL */}
      <AnimatePresence>
        {showAddExpenseModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bento-card" style={{ width: '100%', maxWidth: '540px', background: '#ffffff', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Record Shared Expense</h3>
                <button onClick={() => setShowAddExpenseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label htmlFor="expense-desc-input" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Expense Description</label>
                  <input id="expense-desc-input" className="input-wrapper" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} required aria-label="Expense Description" />
                </div>

                <div>
                  <label htmlFor="expense-amount-input" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Total Amount Paid (INR ₹)</label>
                  <input id="expense-amount-input" type="number" step="any" className="input-wrapper" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} required min="0.01" aria-label="Expense Amount in INR" />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Who Actually Paid Upfront?</label>
                  <select className="input-wrapper" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} required>
                    {tripDetails?.trip?.participants?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Split Option: Equal Split vs Custom Amount Split */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Split Option</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setExpenseSplitType('equal')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: `2px solid ${expenseSplitType === 'equal' ? 'var(--primary)' : 'var(--border)'}`,
                        background: expenseSplitType === 'equal' ? '#f0faf5' : '#ffffff',
                        color: expenseSplitType === 'equal' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Split size={15} /> Equal Split
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpenseSplitType('custom');
                        if (!Object.values(expenseCustomShares).some(v => v !== '')) {
                          const initial = {};
                          (tripDetails?.trip?.participants || []).forEach(p => {
                            initial[p.id] = '';
                          });
                          setExpenseCustomShares(initial);
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: `2px solid ${expenseSplitType === 'custom' ? 'var(--primary)' : 'var(--border)'}`,
                        background: expenseSplitType === 'custom' ? '#f0faf5' : '#ffffff',
                        color: expenseSplitType === 'custom' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Users size={15} /> Custom Amount Split
                    </button>
                  </div>
                </div>

                {expenseSplitType === 'equal' ? (
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Shared With (Check to include):</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-subtle)', padding: '12px', borderRadius: '10px' }}>
                      {tripDetails?.trip?.participants?.map(p => {
                        const isChecked = sharedWith.includes(p.id);
                        return (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSharedWith(prev => [...prev, p.id]);
                                } else {
                                  if (sharedWith.length > 1) {
                                    setSharedWith(prev => prev.filter(id => id !== p.id));
                                  }
                                }
                              }}
                            />
                            {p.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 700 }}>
                        Enter Amount Each Person Owes (₹)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const total = Number(expenseAmount) || 0;
                          const count = tripDetails?.trip?.participants?.length || 1;
                          const base = Math.floor((total * 100) / count) / 100;
                          const rem = Math.round(total * 100) - Math.round(base * 100) * count;
                          const updated = {};
                          tripDetails?.trip?.participants?.forEach((p, idx) => {
                            const val = idx < rem ? base + 0.01 : base;
                            updated[p.id] = String(val.toFixed(2));
                          });
                          setExpenseCustomShares(updated);
                        }}
                        className="btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        title="Split total evenly as a starting point"
                      >
                        Split Evenly
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-subtle)', padding: '12px', borderRadius: '10px' }}>
                      {tripDetails?.trip?.participants?.map(p => {
                        const isPayer = p.id === paidBy;
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600 }}>{p.name}</span>
                              {isPayer && (
                                <span className="stitch-badge badge-green" style={{ fontSize: '10px' }}>
                                  Payer
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>₹</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0"
                                value={expenseCustomShares[p.id] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExpenseCustomShares(prev => ({
                                    ...prev,
                                    [p.id]: val
                                  }));
                                }}
                                style={{
                                  width: '100px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  textAlign: 'right'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Validation difference indicator */}
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: totalExpensePaise > 0 && customDiffPaise === 0 ? '#ecfdf5' : '#fff7ed',
                      border: `1px solid ${totalExpensePaise > 0 && customDiffPaise === 0 ? '#a7f3d0' : '#fed7aa'}`,
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '6px'
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Sum of Amounts: </span>
                        <strong style={{ fontSize: '13px' }}>₹{(customSumPaise / 100).toFixed(2)}</strong>
                        <span style={{ color: 'var(--text-muted)' }}> / Total: </span>
                        <strong style={{ fontSize: '13px' }}>₹{(totalExpensePaise / 100).toFixed(2)}</strong>
                      </div>

                      <div>
                        {totalExpensePaise <= 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>Enter total amount</span>
                        ) : customDiffPaise === 0 ? (
                          <span style={{ color: '#047857', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={14} /> Exact Match
                          </span>
                        ) : customDiffPaise > 0 ? (
                          <span style={{ color: '#c2410c', fontWeight: 700 }}>
                            ⚠️ ₹{(customDiffPaise / 100).toFixed(2)} remaining to allocate
                          </span>
                        ) : (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            ❌ Exceeds total by ₹{(Math.abs(customDiffPaise) / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={expenseSplitType === 'custom' && (totalExpensePaise <= 0 || customDiffPaise !== 0)}
                  className="btn-action" 
                  style={{ width: '100%', padding: '14px', marginTop: '10px' }}
                >
                  Save Trip Expense & Recalculate
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT EXPENSE MODAL */}
      <AnimatePresence>
        {showEditExpenseModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bento-card" style={{ width: '100%', maxWidth: '540px', background: '#ffffff', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Edit Shared Expense</h3>
                <button onClick={() => setShowEditExpenseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <form onSubmit={handleEditExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Expense Description</label>
                  <input className="input-wrapper" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} required />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Total Amount Paid (₹)</label>
                  <input type="number" step="any" className="input-wrapper" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} required min="0.01" />
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Who Paid Upfront?</label>
                  <select className="input-wrapper" value={editPaidBy} onChange={(e) => setEditPaidBy(e.target.value)} required>
                    {tripDetails?.trip?.participants?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Split Option Selector */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Split Option</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setEditSplitType('equal')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: `2px solid ${editSplitType === 'equal' ? 'var(--primary)' : 'var(--border)'}`,
                        background: editSplitType === 'equal' ? '#f0faf5' : '#ffffff',
                        color: editSplitType === 'equal' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Split size={15} /> Equal Split
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditSplitType('custom')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: `2px solid ${editSplitType === 'custom' ? 'var(--primary)' : 'var(--border)'}`,
                        background: editSplitType === 'custom' ? '#f0faf5' : '#ffffff',
                        color: editSplitType === 'custom' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Users size={15} /> Custom Amount Split
                    </button>
                  </div>
                </div>

                {editSplitType === 'equal' ? (
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Shared With (Check to include):</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-subtle)', padding: '12px', borderRadius: '10px' }}>
                      {tripDetails?.trip?.participants?.map(p => {
                        const isChecked = editSharedWith.includes(p.id);
                        return (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditSharedWith(prev => [...prev, p.id]);
                                } else {
                                  if (editSharedWith.length > 1) {
                                    setEditSharedWith(prev => prev.filter(id => id !== p.id));
                                  }
                                }
                              }}
                            />
                            {p.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>
                      Enter Amount Each Person Owes (₹)
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-subtle)', padding: '12px', borderRadius: '10px' }}>
                      {tripDetails?.trip?.participants?.map(p => {
                        const isPayer = p.id === editPaidBy;
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600 }}>{p.name}</span>
                              {isPayer && (
                                <span className="stitch-badge badge-green" style={{ fontSize: '10px' }}>
                                  Payer
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>₹</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0"
                                value={editCustomShares[p.id] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditCustomShares(prev => ({
                                    ...prev,
                                    [p.id]: val
                                  }));
                                }}
                                style={{
                                  width: '100px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  textAlign: 'right'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Validation difference indicator */}
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: editTotalExpensePaise > 0 && editCustomDiffPaise === 0 ? '#ecfdf5' : '#fff7ed',
                      border: `1px solid ${editTotalExpensePaise > 0 && editCustomDiffPaise === 0 ? '#a7f3d0' : '#fed7aa'}`,
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '6px'
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Sum of Amounts: </span>
                        <strong style={{ fontSize: '13px' }}>₹{(editCustomSumPaise / 100).toFixed(2)}</strong>
                        <span style={{ color: 'var(--text-muted)' }}> / Total: </span>
                        <strong style={{ fontSize: '13px' }}>₹{(editTotalExpensePaise / 100).toFixed(2)}</strong>
                      </div>

                      <div>
                        {editTotalExpensePaise <= 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>Enter total amount</span>
                        ) : editCustomDiffPaise === 0 ? (
                          <span style={{ color: '#047857', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={14} /> Exact Match
                          </span>
                        ) : editCustomDiffPaise > 0 ? (
                          <span style={{ color: '#c2410c', fontWeight: 700 }}>
                            ⚠️ ₹{(editCustomDiffPaise / 100).toFixed(2)} remaining to allocate
                          </span>
                        ) : (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            ❌ Exceeds total by ₹{(Math.abs(editCustomDiffPaise) / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={editSplitType === 'custom' && (editTotalExpensePaise <= 0 || editCustomDiffPaise !== 0)}
                  className="btn-action" 
                  style={{ width: '100%', padding: '14px', marginTop: '10px' }}
                >
                  Update Expense & Recalculate Ledger
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD SETTLEMENT PAYMENT MODAL */}
      <AnimatePresence>
        {showRecordSettlementModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bento-card" style={{ width: '100%', maxWidth: '520px', background: '#ffffff', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Record Direct Settlement Payment</h3>
                <button onClick={() => setShowRecordSettlementModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <form onSubmit={handleRecordSettlementSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Who Paid (Debtor)?</label>
                  <select className="input-wrapper" value={settlementFrom} onChange={(e) => setSettlementFrom(e.target.value)} required>
                    {tripDetails?.trip?.participants?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Who Received (Creditor)?</label>
                  <select className="input-wrapper" value={settlementTo} onChange={(e) => setSettlementTo(e.target.value)} required>
                    {tripDetails?.trip?.participants?.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="settlement-amount-input" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Amount Paid (INR ₹)</label>
                  <input id="settlement-amount-input" type="number" className="input-wrapper" value={settlementAmount} onChange={(e) => setSettlementAmount(e.target.value)} required min="1" aria-label="Settlement Amount in INR" />
                </div>

                <div>
                  <label htmlFor="settlement-notes-input" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Notes (e.g. UPI / Cash Reference, Optional)</label>
                  <input id="settlement-notes-input" className="input-wrapper" value={settlementNotes} onChange={(e) => setSettlementNotes(e.target.value)} aria-label="Settlement Notes" />
                </div>

                <button type="submit" className="btn-action" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
                  Record Payment & Deduct Debt
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW CUSTOM EXPENSE BREAKDOWN MODAL */}
      <AnimatePresence>
        {viewCustomModalExpense && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bento-card" style={{ width: '100%', maxWidth: '500px', background: '#ffffff', padding: '28px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={22} color="var(--primary)" />
                  <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Custom Expense Split</h3>
                </div>
                <button onClick={() => setViewCustomModalExpense(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Description:</span>
                  <strong>{viewCustomModalExpense.description}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Paid Upfront By:</span>
                  <strong>{tripDetails?.trip?.participants?.find(p => p.id === viewCustomModalExpense.paidBy)?.name || viewCustomModalExpense.paidBy}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Amount:</span>
                  <strong style={{ color: 'var(--primary)', fontSize: '16px' }}>{formatINR(viewCustomModalExpense.amount)}</strong>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-muted)' }}>
                  Participant Breakdown
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(viewCustomModalExpense.participantShares || []).map((share, idx) => {
                    const pName = tripDetails?.trip?.participants?.find(p => p.id === share.participantId)?.name || share.participantId;
                    const isPayer = share.participantId === viewCustomModalExpense.paidBy;
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fafafa', borderRadius: '8px', fontSize: '13px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600 }}>{pName}</span>
                          {isPayer && <span className="stitch-badge badge-green" style={{ fontSize: '10px' }}>Payer</span>}
                        </div>
                        <strong style={{ color: 'var(--primary)', fontSize: '14px' }}>{formatINR(share.amount)}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button
                  onClick={() => setViewCustomModalExpense(null)}
                  className="btn-secondary"
                  style={{ padding: '8px 20px' }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default TripSplitter;
