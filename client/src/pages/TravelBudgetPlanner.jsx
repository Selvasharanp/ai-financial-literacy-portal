import { useState, useEffect, useCallback } from 'react';
import { 
  Luggage, Sparkles, MapPin, Calendar, Users, IndianRupee, 
  ShieldCheck, CheckCircle2, AlertCircle, 
  Bus, Train, Car, Plane, Hotel, Utensils, Compass, 
  Check, X, BookmarkCheck, Trash2, FolderHeart, 
  Zap, RefreshCw, ExternalLink, Star,
  Clock, Sun, Sunset, Moon, Coffee, Ticket, ArrowRight
} from 'lucide-react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { apiUrl, authConfig } from '../utils/api';
import { formatINR } from '../utils/currency';
import { useNotification } from '../context/NotificationContext';

function formatDayDate(startDateStr, dayNumber) {
  if (!startDateStr) return `Day ${dayNumber}`;
  const d = new Date(startDateStr);
  if (isNaN(d.getTime())) return `Day ${dayNumber}`;
  d.setDate(d.getDate() + (dayNumber - 1));
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TravelBudgetPlanner() {
  const { showToast, confirmModal } = useNotification();
  // Input form state
  const [origin, setOrigin] = useState('Bangalore');
  const [destination, setDestination] = useState('Ooty');
  const [departureDate, setDepartureDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 9);
    return d.toISOString().slice(0, 10);
  });
  const [durationDays, setDurationDays] = useState(3);
  const [numberOfTravellers, setNumberOfTravellers] = useState(2);
  const [totalBudget, setTotalBudget] = useState(15000);
  const [travelStyle, setTravelStyle] = useState('balanced');
  const [preferredTransport, setPreferredTransport] = useState('any');
  const [accommodationType, setAccommodationType] = useState('any');
  const [interests, setInterests] = useState(['Nature', 'Sightseeing']);

  // Plan generation state
  const [generating, setGenerating] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [error, setError] = useState('');

  // Interactive option selections
  const [selectedTransportIdx, setSelectedTransportIdx] = useState(0);
  const [selectedAccommodationIdx, setSelectedAccommodationIdx] = useState(0);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [contingencyPercent, setContingencyPercent] = useState(8);

  // Saved plans drawer / modal
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedPlans, setSavedPlans] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [currentPlanSaved, setCurrentPlanSaved] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('itinerary'); // 'itinerary' | 'breakdown' | 'transport' | 'stay'

  // Auto-calculate duration days when dates change
  useEffect(() => {
    if (departureDate && returnDate) {
      const dep = new Date(departureDate);
      const ret = new Date(returnDate);
      if (!isNaN(dep.getTime()) && !isNaN(ret.getTime()) && ret >= dep) {
        const diff = Math.ceil((ret - dep) / (1000 * 60 * 60 * 24)) + 1;
        setDurationDays(Math.max(1, Math.min(14, diff)));
      }
    }
  }, [departureDate, returnDate]);

  // Load saved plans count on mount
  const fetchSavedPlans = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const res = await axios.get(apiUrl('/api/travel-planner/saved'), authConfig());
      setSavedPlans(res.data.plans || []);
    } catch {
      // User might be unauthenticated or offline
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedPlans();
  }, [fetchSavedPlans]);

  // Generate Plan from Backend
  const handleGeneratePlan = async (e) => {
    if (e) e.preventDefault();
    if (!origin.trim() || !destination.trim()) {
      setError('Please provide both starting location and destination.');
      return;
    }
    if (Number(totalBudget) <= 0) {
      setError('Please enter a valid budget in INR.');
      return;
    }

    setGenerating(true);
    setError('');
    setSaveSuccessMsg('');
    setCurrentPlanSaved(false);

    try {
      const payload = {
        origin: origin.trim(),
        destination: destination.trim(),
        departureDate,
        returnDate,
        durationDays,
        numberOfTravellers: Number(numberOfTravellers),
        totalBudget: Number(totalBudget),
        travelStyle,
        preferredTransport,
        accommodationType,
        interests
      };

      const res = await axios.post(apiUrl('/api/travel-planner/generate'), payload, authConfig());
      const data = res.data;

      setPlanResult(data);
      setSelectedTransportIdx(data.selectedOptions?.transportIndex ?? 0);
      setSelectedAccommodationIdx(data.selectedOptions?.accommodationIndex ?? 0);
      setSelectedActivities(data.selectedOptions?.activitySelections ?? []);
      setContingencyPercent(data.selectedOptions?.customContingencyPercent ?? 8);
      setActiveTab('itinerary');
    } catch (err) {
      console.error('Plan generation failed:', err);
      setError(err.response?.data?.error || 'Failed to generate itinerary. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Deterministic Recalculation Engine Caller
  const handleOptionChange = async (newOptions) => {
    if (!planResult || !planResult.planData) return;

    const updatedOptions = {
      transportIndex: newOptions.transportIndex !== undefined ? newOptions.transportIndex : selectedTransportIdx,
      accommodationIndex: newOptions.accommodationIndex !== undefined ? newOptions.accommodationIndex : selectedAccommodationIdx,
      activitySelections: newOptions.activitySelections !== undefined ? newOptions.activitySelections : selectedActivities,
      customContingencyPercent: newOptions.customContingencyPercent !== undefined ? newOptions.customContingencyPercent : contingencyPercent
    };

    if (newOptions.transportIndex !== undefined) setSelectedTransportIdx(newOptions.transportIndex);
    if (newOptions.accommodationIndex !== undefined) setSelectedAccommodationIdx(newOptions.accommodationIndex);
    if (newOptions.activitySelections !== undefined) setSelectedActivities(newOptions.activitySelections);
    if (newOptions.customContingencyPercent !== undefined) setContingencyPercent(newOptions.customContingencyPercent);

    try {
      const res = await axios.post(apiUrl('/api/travel-planner/recalculate'), {
        planData: planResult.planData,
        selectedOptions: updatedOptions,
        inputs: planResult.inputs
      }, authConfig());

      setPlanResult(prev => ({
        ...prev,
        calculations: res.data.calculations,
        suggestions: res.data.suggestions,
        selectedOptions: updatedOptions
      }));
    } catch (err) {
      console.error('Recalculation error:', err);
    }
  };

  // Toggle single activity
  const toggleActivity = (activityId) => {
    let nextList;
    if (selectedActivities.includes(activityId)) {
      nextList = selectedActivities.filter(id => id !== activityId);
    } else {
      nextList = [...selectedActivities, activityId];
    }
    handleOptionChange({ activitySelections: nextList });
  };

  // Apply single optimization suggestion
  const applySuggestion = (suggestion) => {
    if (!suggestion || !suggestion.actionPayload) return;
    const payload = suggestion.actionPayload;

    if (payload.transportIndex !== undefined) {
      handleOptionChange({ transportIndex: payload.transportIndex });
    } else if (payload.accommodationIndex !== undefined) {
      handleOptionChange({ accommodationIndex: payload.accommodationIndex });
    } else if (payload.deselectActivityId !== undefined) {
      const nextList = selectedActivities.filter(id => id !== payload.deselectActivityId);
      handleOptionChange({ activitySelections: nextList });
    }
  };

  // Apply all optimization recommendations to fit budget
  const applyAllOptimizations = () => {
    if (!planResult || !planResult.suggestions || planResult.suggestions.length === 0) return;

    let nextTIdx = selectedTransportIdx;
    let nextAIdx = selectedAccommodationIdx;
    let nextActs = [...selectedActivities];

    planResult.suggestions.forEach(sug => {
      const p = sug.actionPayload || {};
      if (p.transportIndex !== undefined) nextTIdx = p.transportIndex;
      if (p.accommodationIndex !== undefined) nextAIdx = p.accommodationIndex;
      if (p.deselectActivityId !== undefined) {
        nextActs = nextActs.filter(id => id !== p.deselectActivityId);
      }
    });

    handleOptionChange({
      transportIndex: nextTIdx,
      accommodationIndex: nextAIdx,
      activitySelections: nextActs
    });
  };

  // Save current plan
  const handleSavePlan = async () => {
    if (!planResult) return;
    if (savingPlan) return;                  // in-flight guard
    if (currentPlanSaved) return;            // already saved guard – prevents duplicate saves

    setSavingPlan(true);
    setSaveSuccessMsg('');
    setError('');

    try {
      const payload = {
        title: `${planResult.inputs.destination} Trip (${planResult.inputs.durationDays}D, ${planResult.inputs.numberOfTravellers} Pax)`,
        planData: planResult.planData,
        selectedOptions: {
          transportIndex: selectedTransportIdx,
          accommodationIndex: selectedAccommodationIdx,
          activitySelections: selectedActivities,
          customContingencyPercent: contingencyPercent
        },
        calculations: planResult.calculations,
        inputs: planResult.inputs
      };

      await axios.post(apiUrl('/api/travel-planner/save'), payload, authConfig());
      setCurrentPlanSaved(true);             // mark this plan as saved
      setSaveSuccessMsg('Travel plan saved to your account!');
      fetchSavedPlans();
      // Do NOT clear saveSuccessMsg – it stays until a new plan is generated
    } catch (err) {
      console.error('Failed to save plan:', err);
      setError(err.response?.data?.error || 'Unable to save travel plan. Please try again.');
      // Do NOT set currentPlanSaved true on failure – allow retry
    } finally {
      setSavingPlan(false);
    }
  };

  // Load a saved plan
  const loadSavedPlan = async (planId) => {
    setLoadingSaved(true);
    try {
      const res = await axios.get(apiUrl(`/api/travel-planner/saved/${planId}`), authConfig());
      const p = res.data.plan;
      if (p) {
        setOrigin(p.origin);
        setDestination(p.destination);
        setDepartureDate(new Date(p.departureDate).toISOString().slice(0, 10));
        setReturnDate(new Date(p.returnDate).toISOString().slice(0, 10));
        setDurationDays(p.durationDays);
        setNumberOfTravellers(p.numberOfTravellers);
        setTotalBudget(p.totalBudget);
        setTravelStyle(p.travelStyle);

        setPlanResult({
          inputs: {
            origin: p.origin,
            destination: p.destination,
            departureDate: p.departureDate,
            returnDate: p.returnDate,
            durationDays: p.durationDays,
            numberOfTravellers: p.numberOfTravellers,
            totalBudget: p.totalBudget,
            travelStyle: p.travelStyle
          },
          planData: p.planData,
          calculations: p.calculations,
          selectedOptions: p.selectedOptions,
          source: 'saved_plan'
        });

        setSelectedTransportIdx(p.selectedOptions?.transportIndex ?? 0);
        setSelectedAccommodationIdx(p.selectedOptions?.accommodationIndex ?? 0);
        setSelectedActivities(p.selectedOptions?.activitySelections ?? []);
        setContingencyPercent(p.selectedOptions?.customContingencyPercent ?? 8);
        setActiveTab('itinerary');

        // This plan is already saved – mark it to prevent a duplicate re-save
        setCurrentPlanSaved(true);
        setSaveSuccessMsg('This plan is already saved to your account.');

        setShowSavedModal(false);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load saved plan.', 'error');
    } finally {
      setLoadingSaved(false);
    }
  };

  // Delete a saved plan
  const deleteSavedPlan = async (planId, e) => {
    e.stopPropagation();
    const confirmed = await confirmModal({
      title: 'Delete Saved Plan',
      message: 'Delete this saved travel plan? This cannot be undone.',
      confirmText: 'Delete Plan',
      cancelText: 'Cancel',
      isDestructive: true
    });
    if (!confirmed) return;
    try {
      await axios.delete(apiUrl(`/api/travel-planner/saved/${planId}`), authConfig());
      setSavedPlans(prev => prev.filter(p => p._id !== planId));
      showToast('Saved travel plan removed.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete saved plan.', 'error');
    }
  };

  const calcs = planResult?.calculations;
  const planData = planResult?.planData;

  return (
    <div style={{ background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
      <Sidebar />

      <main className="app-main">
        
        {/* Top Header */}
        <header className="travel-top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ minWidth: 0, flex: '1 1 280px' }}>
            <div className="travel-header-title-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#183630', padding: '10px', borderRadius: '12px', color: '#E5C690', flexShrink: 0 }}>
                <Luggage size={32} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 className="travel-page-title" style={{ fontSize: '30px', margin: 0, color: 'var(--text-main)', wordBreak: 'break-word' }}>
                  AI Travel Budget Planner
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: '4px 0 0 0', lineHeight: 1.45 }}>
                  Plan end-to-end trips with chronological day-by-day itineraries, verified places, and deterministic budget calculations.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={() => { fetchSavedPlans(); setShowSavedModal(true); }}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <FolderHeart size={18} color="#183630" />
              Saved Plans ({savedPlans.length})
            </button>
          </div>
        </header>

        {/* Isolation Alert Banner */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 20px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0 }} />
          <span><strong>Personal Finance Isolation:</strong> The Travel Budget Planner operates independently. Generating or saving itineraries will never alter your personal accounts, Safe Balance, or bank records.</span>
        </div>

        {error && (
          <div style={{ padding: '14px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#b91c1c', fontSize: '14px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div style={{ padding: '14px 20px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', color: '#047857', fontSize: '14px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle2 size={18} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* SECTION 1: TRIP PLANNER FORM */}
        <div className="travel-form-card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', marginBottom: '36px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
              <Compass size={22} color="#183630" />
              Configure Your Trip
            </h2>
          </div>

          <form onSubmit={handleGeneratePlan}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '20px', marginBottom: '20px' }}>
              {/* Origin */}
              <div>
                <label htmlFor="travel-origin-input" style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Starting Location (Origin)
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    id="travel-origin-input"
                    type="text"
                    required
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    aria-label="Starting Location Origin"
                    style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '15px', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Destination */}
              <div>
                <label htmlFor="travel-dest-input" style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Destination
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#183630' }} />
                  <input
                    id="travel-dest-input"
                    type="text"
                    required
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    aria-label="Destination"
                    style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '15px', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Dates */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Departure Date
                </label>
                <input
                  type="date"
                  required
                  value={departureDate}
                  onChange={e => setDepartureDate(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '15px', color: '#0f172a' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Return Date ({durationDays} Days, {durationDays > 1 ? durationDays - 1 : 1}N)
                </label>
                <input
                  type="date"
                  required
                  value={returnDate}
                  min={departureDate}
                  onChange={e => setReturnDate(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '15px', color: '#0f172a' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '22px' }}>
              {/* Travellers */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Number of Travellers
                </label>
                <div style={{ position: 'relative' }}>
                  <Users size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={numberOfTravellers}
                    onChange={e => setNumberOfTravellers(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '15px', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Total Group Budget */}
              <div>
                <label htmlFor="travel-budget-input" style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Total Trip Budget (INR)
                </label>
                <div style={{ position: 'relative' }}>
                  <IndianRupee size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#059669' }} />
                  <input
                    id="travel-budget-input"
                    type="number"
                    min="1000"
                    step="500"
                    required
                    value={totalBudget}
                    onChange={e => setTotalBudget(Number(e.target.value) || 0)}
                    aria-label="Total Trip Budget in INR"
                    style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '15px', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Travel Style Buttons */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Travel Style
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  {[
                    { id: 'budget', label: 'Budget', desc: 'Dorms, buses & economical eats' },
                    { id: 'balanced', label: 'Balanced', desc: 'Comfortable hotels & value transit' },
                    { id: 'comfortable', label: 'Comfortable', desc: 'Premium resorts & AC cabs/flights' }
                  ].map(style => (
                    <button
                      type="button"
                      key={style.id}
                      onClick={() => setTravelStyle(style.id)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: travelStyle === style.id ? '2px solid #183630' : '1px solid var(--border)',
                        background: travelStyle === style.id ? 'rgba(24, 54, 48, 0.06)' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: 800, color: travelStyle === style.id ? '#183630' : '#1e293b' }}>
                        {style.label}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        {style.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>



            {/* Submit Button */}
            <div className="travel-form-submit-row" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="travel-form-submit-btn"
                disabled={generating}
                style={{
                  background: '#183630',
                  color: '#E5C690',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 32px',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 14px rgba(24, 54, 48, 0.25)',
                  opacity: generating ? 0.7 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                {generating ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    Generating Intelligent Itinerary...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate Travel Budget Plan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 2: RESULTS VIEW */}
        {planResult && calcs && (
          <div>
            
            {/* HERO TRIP BANNER */}
            <div className="travel-hero-banner" style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '28px 32px',
              marginBottom: '28px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '20px'
            }}>
              <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#183630', background: 'rgba(24, 54, 48, 0.08)', padding: '4px 10px', borderRadius: '6px' }}>
                    {planResult.inputs.travelStyle?.toUpperCase()} PLAN
                  </span>
                </div>

                <h2 className="travel-dest-heading" style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px', wordBreak: 'break-word' }}>
                  {planResult.inputs.origin} <span style={{ color: '#94a3b8', fontWeight: 400 }}>→</span> {planResult.inputs.destination}
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#475569', fontSize: '15px', fontWeight: 600, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} color="#183630" />
                    {new Date(planResult.inputs.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(planResult.inputs.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span>•</span>
                  <span>{planResult.inputs.durationDays} Days, {calcs.nights} Night{calcs.nights > 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} color="#183630" />
                    {calcs.numberOfTravellers} Traveller{calcs.numberOfTravellers > 1 ? 's' : ''} ({calcs.roomsNeeded} Room{calcs.roomsNeeded > 1 ? 's' : ''})
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={handleSavePlan}
                  disabled={savingPlan || currentPlanSaved}
                  title={currentPlanSaved ? 'This plan has already been saved. Generate a new plan to save a different one.' : 'Save this plan to your account'}
                  style={{
                    background: currentPlanSaved ? '#d1fae5' : '#059669',
                    color: currentPlanSaved ? '#065f46' : '#ffffff',
                    border: currentPlanSaved ? '1.5px solid #6ee7b7' : 'none',
                    borderRadius: '10px',
                    padding: '12px 22px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: (savingPlan || currentPlanSaved) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: currentPlanSaved ? 'none' : '0 2px 8px rgba(5, 150, 105, 0.25)',
                    opacity: currentPlanSaved ? 0.85 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {currentPlanSaved
                    ? <><CheckCircle2 size={18} /> Plan Saved</>
                    : savingPlan
                      ? <><RefreshCw size={18} className="animate-spin" /> Saving...</>
                      : <><BookmarkCheck size={18} /> Save This Plan</>
                  }
                </button>
              </div>
            </div>

            {/* REQUIREMENT 4: PROMINENT BUDGET SUMMARY HERO */}
            <div style={{ marginBottom: '32px' }}>
              <div className="travel-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '20px', marginBottom: '20px' }}>
                {/* 1. Total Estimated Trip Cost */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px 28px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: '14px', color: '#475569', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Estimated Trip Cost
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                    {formatINR(calcs.totalTripCost)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                    Complete estimate for all {calcs.numberOfTravellers} travellers across {planResult.inputs.durationDays} days
                  </div>
                </div>

                {/* 2. Budget Remaining or Over Budget */}
                <div style={{
                  background: calcs.isOverBudget ? '#fef2f2' : '#f0fdf4',
                  border: `1.5px solid ${calcs.isOverBudget ? '#fecaca' : '#bbf7d0'}`,
                  borderRadius: '16px',
                  padding: '24px 28px'
                }}>
                  <div style={{ fontSize: '14px', color: calcs.isOverBudget ? '#991b1b' : '#166534', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {calcs.isOverBudget ? 'Over Budget Shortfall' : 'Budget Surplus Remaining'}
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 900, color: calcs.isOverBudget ? '#dc2626' : '#15803d', letterSpacing: '-0.5px' }}>
                    {calcs.isOverBudget ? `+${formatINR(calcs.shortfall)}` : formatINR(calcs.remainingBudget)}
                  </div>
                  <div style={{ fontSize: '13px', color: calcs.isOverBudget ? '#b91c1c' : '#166534', marginTop: '6px', fontWeight: 600 }}>
                    Target Budget: {formatINR(calcs.totalBudget)} ({calcs.isOverBudget ? 'Exceeded budget limit' : 'Safe spending buffer'})
                  </div>
                </div>

                {/* 3. Cost Per Person */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px 28px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: '14px', color: '#475569', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Cost Per Person
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 900, color: '#183630', letterSpacing: '-0.5px' }}>
                    {formatINR(calcs.costPerPerson)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                    Per traveller share (Transit, Stays, Meals & Sights)
                  </div>
                </div>
              </div>

              {/* 4 CORE BUDGET CATEGORY TOTALS ROW (Requirement 4) */}
              <div className="travel-category-totals-row" style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px 28px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
                gap: '16px'
              }}>
                {/* Transport Total */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ background: '#eff6ff', color: '#2563eb', padding: '12px', borderRadius: '12px' }}>
                    <Train size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Transport Total
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      {formatINR(calcs.transportationTotal)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {calcs.selectedTransport?.mode}
                    </div>
                  </div>
                </div>

                {/* Accommodation Total */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ background: '#f5f3ff', color: '#7c3aed', padding: '12px', borderRadius: '12px' }}>
                    <Hotel size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Stay & Lodging
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      {formatINR(calcs.accommodationTotal)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {calcs.nights}N • {calcs.roomsNeeded} Room{calcs.roomsNeeded > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Meals Total */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ background: '#fffbeb', color: '#d97706', padding: '12px', borderRadius: '12px' }}>
                    <Utensils size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Food & Dining
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      {formatINR(calcs.mealsTotal)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      All daily meals
                    </div>
                  </div>
                </div>

                {/* Sightseeing & Activities Total */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ background: '#ecfdf5', color: '#059669', padding: '12px', borderRadius: '12px' }}>
                    <Ticket size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Sightseeing & Entry
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      {formatINR(calcs.activitiesTotal)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {selectedActivities.length} Attractions
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Over-Budget / Optimization Recommendations Banner */}
            {planResult.suggestions && planResult.suggestions.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Zap size={24} color="#d97706" />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#92400e' }}>
                        {calcs.isOverBudget ? 'Budget Optimization Available' : 'Cost Optimization Insights'}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#b45309' }}>
                        {calcs.isOverBudget
                          ? `Your selected options exceed the budget by ${formatINR(calcs.shortfall)}. Apply these suggestions to bring it within budget:`
                          : 'Potential options to save money on this trip without sacrificing comfort:'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={applyAllOptimizations}
                    style={{ background: '#d97706', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Apply All Recommendations
                  </button>
                </div>

                <div className="travel-suggestions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '12px' }}>
                  {planResult.suggestions.map((sug, idx) => (
                    <div key={idx} style={{ background: '#ffffff', borderRadius: '10px', padding: '14px 16px', border: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', wordBreak: 'break-word' }}>{sug.title}</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', wordBreak: 'break-word' }}>{sug.description}</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                          Save {formatINR(sug.potentialSavings)}
                        </div>
                      </div>
                      <button
                        onClick={() => applySuggestion(sug)}
                        style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NAVIGATION TABS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
              <div className="travel-tabs-container" style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '6px', borderRadius: '12px', flexWrap: 'wrap' }}>
                {[
                  { id: 'itinerary', label: 'Day-by-Day Itinerary' },
                  { id: 'breakdown', label: 'Budget Breakdown' },
                  { id: 'transport', label: 'Transportation' },
                  { id: 'stay', label: 'Accommodation' }
                ].map(t => (
                  <button
                    key={t.id}
                    className="travel-tab-btn"
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      background: activeTab === t.id ? '#183630' : 'transparent',
                      color: activeTab === t.id ? '#E5C690' : '#475569',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: activeTab === t.id ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* TAB 1: DAY-BY-DAY ITINERARY WITH VERTICAL TIMELINE (Requirements 1 & 2)  */}
            {/* ========================================================================= */}
            {activeTab === 'itinerary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {(planData.itinerary || []).map((day) => {
                  const formattedDate = formatDayDate(planResult.inputs.departureDate, day.dayNumber);
                  const isFirstDay = day.dayNumber === 1;
                  const isLastDay = day.dayNumber === planResult.inputs.durationDays;

                  return (
                    <div 
                      key={day.dayNumber}
                      className="travel-day-card"
                      style={{
                        background: '#ffffff',
                        borderRadius: '18px',
                        border: '1px solid #e2e8f0',
                        padding: '32px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Day Prominent Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '2px solid #f1f5f9',
                        paddingBottom: '20px',
                        marginBottom: '28px',
                        flexWrap: 'wrap',
                        gap: '14px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', minWidth: 0, flex: '1 1 200px' }}>
                          <span style={{
                            background: '#183630',
                            color: '#E5C690',
                            padding: '6px 16px',
                            borderRadius: '8px',
                            fontWeight: 900,
                            fontSize: '15px',
                            letterSpacing: '1px',
                            flexShrink: 0
                          }}>
                            DAY {day.dayNumber}
                          </span>
                          <h3 className="travel-day-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a', wordBreak: 'break-word' }}>
                            {day.title?.replace(/^Day\s*\d+:\s*/i, '') || `Highlights of ${planResult.inputs.destination}`}
                          </h3>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: '#f8fafc',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: '1px solid #e2e8f0',
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#475569',
                          flexShrink: 0
                        }}>
                          <Calendar size={16} color="#183630" />
                          {formattedDate}
                        </div>
                      </div>

                      {/* OUTBOUND TRANSIT: Only on Day 1 (Requirement 1) */}
                      {isFirstDay && calcs.selectedTransport && (
                        <div className="travel-transit-badge-card" style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          marginBottom: '24px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ background: '#16a34a', color: '#ffffff', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
                            {calcs.selectedTransport.mode?.toLowerCase().includes('train') ? <Train size={20} /> :
                             calcs.selectedTransport.mode?.toLowerCase().includes('flight') ? <Plane size={20} /> :
                             calcs.selectedTransport.mode?.toLowerCase().includes('cab') ? <Car size={20} /> :
                             <Bus size={20} />}
                          </div>
                          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#15803d', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                              Outbound Travel & Departure
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px', wordBreak: 'break-word' }}>
                              {planResult.inputs.origin} → {planResult.inputs.destination} via {calcs.selectedTransport.mode} ({calcs.selectedTransport.operator || 'Scheduled'})
                            </div>
                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px', wordBreak: 'break-word' }}>
                              Duration: {calcs.selectedTransport.duration || 'Direct'} • Total Transit Cost: {formatINR(calcs.transportationTotal)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* BASE ACCOMMODATION: Only on Day 1 (Requirement 1) */}
                      {isFirstDay && calcs.selectedAccommodation && (
                        <div className="travel-transit-badge-card" style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          marginBottom: '28px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ background: '#2563eb', color: '#ffffff', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
                            <Hotel size={20} />
                          </div>
                          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                              Base Stay ({calcs.nights} Night{calcs.nights > 1 ? 's' : ''})
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px', wordBreak: 'break-word' }}>
                              {calcs.selectedAccommodation.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px', wordBreak: 'break-word' }}>
                              {calcs.selectedAccommodation.formattedAddress || calcs.selectedAccommodation.location} • {calcs.roomsNeeded} Room{calcs.roomsNeeded > 1 ? 's' : ''} ({formatINR(calcs.selectedAccommodation.pricePerNight)}/room/night)
                            </div>
                          </div>
                          {calcs.selectedAccommodation.googleMapsUri && (
                            <a
                              href={calcs.selectedAccommodation.googleMapsUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#ffffff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 700,
                                textDecoration: 'none',
                                flexShrink: 0
                              }}
                            >
                              View on Maps <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      )}

                      {/* CHRONOLOGICAL VERTICAL TIMELINE (Morning → Afternoon → Evening) */}
                      <div className="travel-timeline" style={{
                        position: 'relative',
                        paddingLeft: '38px',
                        marginLeft: '12px',
                        borderLeft: '3px solid #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '32px'
                      }}>
                        
                        {/* 1. MORNING SLOT */}
                        {day.schedule?.morning && (
                          <div style={{ position: 'relative' }}>
                            {/* Marker Node */}
                            <div className="travel-timeline-marker" style={{
                              position: 'absolute',
                              left: '-52px',
                              top: '2px',
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: '#183630',
                              border: '3px solid #ffffff',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#E5C690'
                            }}>
                              <Sun size={14} />
                            </div>

                            <div className="travel-slot-card" style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: '#183630', letterSpacing: '0.5px' }}>
                                  Morning
                                </span>
                                <span style={{ color: '#94a3b8' }}>•</span>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={14} /> {day.schedule.morning.time}
                                </span>
                              </div>

                              <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', wordBreak: 'break-word' }}>
                                {day.schedule.morning.title}
                              </h4>
                              <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px 0', wordBreak: 'break-word' }}>
                                {day.schedule.morning.description}
                              </p>

                              {/* Morning Activity if available */}
                              {day.activities?.[0] && (
                                <ActivityRow 
                                  activity={day.activities[0]} 
                                  selected={selectedActivities.includes(day.activities[0].id)}
                                  onToggle={() => toggleActivity(day.activities[0].id)}
                                  travellers={calcs.numberOfTravellers}
                                />
                              )}

                              {/* Breakfast Stop */}
                              {day.meals?.breakfast && (
                                <MealStop 
                                  label="Breakfast"
                                  icon={<Coffee size={15} />}
                                  meal={day.meals.breakfast}
                                  travellers={calcs.numberOfTravellers}
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* 2. AFTERNOON SLOT */}
                        {day.schedule?.afternoon && (
                          <div style={{ position: 'relative' }}>
                            {/* Marker Node */}
                            <div className="travel-timeline-marker" style={{
                              position: 'absolute',
                              left: '-52px',
                              top: '2px',
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: '#183630',
                              border: '3px solid #ffffff',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#E5C690'
                            }}>
                              <Compass size={14} />
                            </div>

                            <div className="travel-slot-card" style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: '#183630', letterSpacing: '0.5px' }}>
                                  Afternoon
                                </span>
                                <span style={{ color: '#94a3b8' }}>•</span>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={14} /> {day.schedule.afternoon.time}
                                </span>
                              </div>

                              <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', wordBreak: 'break-word' }}>
                                {day.schedule.afternoon.title}
                              </h4>
                              <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px 0', wordBreak: 'break-word' }}>
                                {day.schedule.afternoon.description}
                              </p>

                              {/* Afternoon Activity if available */}
                              {day.activities?.[1] && (
                                <ActivityRow 
                                  activity={day.activities[1]} 
                                  selected={selectedActivities.includes(day.activities[1].id)}
                                  onToggle={() => toggleActivity(day.activities[1].id)}
                                  travellers={calcs.numberOfTravellers}
                                />
                              )}

                              {/* Lunch Stop */}
                              {day.meals?.lunch && (
                                <MealStop 
                                  label="Lunch"
                                  icon={<Utensils size={15} />}
                                  meal={day.meals.lunch}
                                  travellers={calcs.numberOfTravellers}
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* 3. EVENING & NIGHT SLOT */}
                        {(day.schedule?.evening || day.schedule?.night) && (
                          <div style={{ position: 'relative' }}>
                            {/* Marker Node */}
                            <div className="travel-timeline-marker" style={{
                              position: 'absolute',
                              left: '-52px',
                              top: '2px',
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: '#183630',
                              border: '3px solid #ffffff',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#E5C690'
                            }}>
                              <Sunset size={14} />
                            </div>

                            <div className="travel-slot-card" style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: '#183630', letterSpacing: '0.5px' }}>
                                  Evening & Night
                                </span>
                                <span style={{ color: '#94a3b8' }}>•</span>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={14} /> {day.schedule.evening?.time || '04:30 PM - 09:30 PM'}
                                </span>
                              </div>

                              <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', wordBreak: 'break-word' }}>
                                {day.schedule.evening?.title || 'Evening Exploration & Sunset'}
                              </h4>
                              <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px 0', wordBreak: 'break-word' }}>
                                {day.schedule.evening?.description || 'Relax with scenic promenade walks and regional tea spots.'}
                              </p>

                              {/* Evening Activity if available */}
                              {day.activities?.[2] && (
                                <ActivityRow 
                                  activity={day.activities[2]} 
                                  selected={selectedActivities.includes(day.activities[2].id)}
                                  onToggle={() => toggleActivity(day.activities[2].id)}
                                  travellers={calcs.numberOfTravellers}
                                />
                              )}

                              {/* Dinner Stop */}
                              {day.meals?.dinner && (
                                <MealStop 
                                  label="Dinner"
                                  icon={<Utensils size={15} />}
                                  meal={day.meals.dinner}
                                  travellers={calcs.numberOfTravellers}
                                />
                              )}
                            </div>
                          </div>
                        )}

                      </div>

                      {/* RETURN TRANSIT: Only on final day (Requirement 1) */}
                      {isLastDay && calcs.selectedTransport && (
                        <div className="travel-transit-badge-card" style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          marginTop: '28px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ background: '#16a34a', color: '#ffffff', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
                            <ArrowRight size={20} />
                          </div>
                          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#15803d', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                              Return Transit
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px', wordBreak: 'break-word' }}>
                              Return from {planResult.inputs.destination} to {planResult.inputs.origin} via {calcs.selectedTransport.mode}
                            </div>
                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px', wordBreak: 'break-word' }}>
                              End of trip itinerary. Safe travels!
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: DETAILED COST BREAKDOWN (Requirement 4: Separate, Clearly Labelled) */}
            {/* ========================================================================= */}
            {activeTab === 'breakdown' && (
              <div className="travel-options-card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
                    Complete Deterministic Expense Matrix
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                    Deterministic calculation across {calcs.numberOfTravellers} travellers and {planResult.inputs.durationDays} days. Zero hallucinated figures.
                  </p>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '14px 16px', fontWeight: 800 }}>Expense Category</th>
                        <th style={{ padding: '14px 16px', fontWeight: 800 }}>Assumptions & Selected Options</th>
                        <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800 }}>Per Person Share</th>
                        <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800 }}>Total Group Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>1. Transportation</td>
                        <td style={{ padding: '16px', color: '#475569' }}>
                          {calcs.selectedTransport?.mode} ({calcs.selectedTransport?.operator || 'Roundtrip transit'})
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>
                          {formatINR(Math.round(calcs.transportationTotal / calcs.numberOfTravellers))}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {formatINR(calcs.transportationTotal)}
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>2. Accommodation</td>
                        <td style={{ padding: '16px', color: '#475569' }}>
                          {calcs.selectedAccommodation?.name} ({calcs.roomsNeeded} room{calcs.roomsNeeded > 1 ? 's' : ''}, {calcs.nights} night{calcs.nights > 1 ? 's' : ''})
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>
                          {formatINR(Math.round(calcs.accommodationTotal / calcs.numberOfTravellers))}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {formatINR(calcs.accommodationTotal)}
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>3. Food & Dining</td>
                        <td style={{ padding: '16px', color: '#475569' }}>
                          Breakfast ({formatINR(calcs.breakfastTotal)}), Lunch ({formatINR(calcs.lunchTotal)}), Dinner ({formatINR(calcs.dinnerTotal)})
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>
                          {formatINR(Math.round(calcs.mealsTotal / calcs.numberOfTravellers))}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {formatINR(calcs.mealsTotal)}
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>4. Sightseeing & Activities</td>
                        <td style={{ padding: '16px', color: '#475569' }}>
                          {selectedActivities.length} active sightseeing attractions
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>
                          {formatINR(Math.round(calcs.activitiesTotal / calcs.numberOfTravellers))}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {formatINR(calcs.activitiesTotal)}
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>5. Local City Transit</td>
                        <td style={{ padding: '16px', color: '#475569' }}>
                          In-city auto rickshaws, cabs & local shuttles
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>
                          {formatINR(Math.round(calcs.localTravelTotal / calcs.numberOfTravellers))}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {formatINR(calcs.localTravelTotal)}
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>6. Miscellaneous Expenses</td>
                        <td style={{ padding: '16px', color: '#475569' }}>
                          Tolls & parking ({formatINR(calcs.parkingAndTolls)}), Water & refreshments ({formatINR(calcs.waterAndSnacks)})
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>
                          {formatINR(Math.round(calcs.miscellaneousTotal / calcs.numberOfTravellers))}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {formatINR(calcs.miscellaneousTotal)}
                        </td>
                      </tr>

                      <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                        <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>7. Contingency Reserve ({calcs.contingencyPercent}%)</td>
                        <td style={{ padding: '16px', color: '#475569' }}>
                          Emergency buffer for unexpected price variations or medical needs
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>
                          {formatINR(Math.round(calcs.contingencyReserve / calcs.numberOfTravellers))}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: '#183630' }}>
                          {formatINR(calcs.contingencyReserve)}
                        </td>
                      </tr>

                      <tr style={{ fontSize: '16px', fontWeight: 900, background: '#f1f5f9' }}>
                        <td colSpan="2" style={{ padding: '18px 16px', color: '#0f172a' }}>
                          GRAND TOTAL TRIP ESTIMATE
                        </td>
                        <td style={{ padding: '18px 16px', textAlign: 'right', color: '#183630' }}>
                          {formatINR(calcs.costPerPerson)} / person
                        </td>
                        <td style={{ padding: '18px 16px', textAlign: 'right', color: '#0f172a' }}>
                          {formatINR(calcs.totalTripCost)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: TRANSPORTATION OPTIONS                                             */}
            {/* ========================================================================= */}
            {activeTab === 'transport' && (
              <div className="travel-options-card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
                    Transportation Options & Comparison
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                    Select your preferred mode of travel. Your total budget recalculates deterministically.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '20px' }}>
                  {(planData.transportationOptions || []).map((opt, idx) => {
                    const isSelected = selectedTransportIdx === idx;
                    const groupCost = opt.totalGroupCost ? Number(opt.totalGroupCost) : (Number(opt.perPersonFare || 0) * calcs.numberOfTravellers) + Number(opt.additionalCosts || 0);

                    return (
                      <div
                        key={idx}
                        onClick={() => handleOptionChange({ transportIndex: idx })}
                        style={{
                          border: isSelected ? '2px solid #183630' : '1px solid #e2e8f0',
                          borderRadius: '14px',
                          padding: '24px',
                          background: isSelected ? 'rgba(24, 54, 48, 0.04)' : '#ffffff',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isSelected && (
                          <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#183630', color: '#E5C690', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 800 }}>
                            ACTIVE OPTION
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                          {opt.mode?.toLowerCase().includes('flight') ? <Plane size={22} color="#183630" /> :
                           opt.mode?.toLowerCase().includes('train') ? <Train size={22} color="#183630" /> :
                           opt.mode?.toLowerCase().includes('cab') || opt.mode?.toLowerCase().includes('car') ? <Car size={22} color="#183630" /> :
                           <Bus size={22} color="#183630" />}
                          <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{opt.mode}</span>
                        </div>

                        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                          {opt.operator} • {opt.duration}
                        </div>

                        <div style={{ fontSize: '26px', fontWeight: 900, color: isSelected ? '#183630' : '#0f172a', marginBottom: '4px' }}>
                          {formatINR(groupCost)}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                          {formatINR(opt.perPersonFare)} per person (Roundtrip)
                        </div>

                        {opt.bookingNotes && (
                          <div style={{ fontSize: '13px', color: '#475569', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            {opt.bookingNotes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: ACCOMMODATION OPTIONS                                              */}
            {/* ========================================================================= */}
            {activeTab === 'stay' && (
              <div className="travel-options-card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
                    Accommodation Options & Stays
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                    Required: {calcs.roomsNeeded} room{calcs.roomsNeeded > 1 ? 's' : ''} for {calcs.numberOfTravellers} guests across {calcs.nights} night{calcs.nights > 1 ? 's' : ''}.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '20px' }}>
                  {(planData.accommodationOptions || []).map((acc, idx) => {
                    const isSelected = selectedAccommodationIdx === idx;
                    const totalStay = Number(acc.pricePerNight || 0) * calcs.roomsNeeded * calcs.nights;

                    return (
                      <div
                        key={idx}
                        onClick={() => handleOptionChange({ accommodationIndex: idx })}
                        style={{
                          border: isSelected ? '2px solid #183630' : '1px solid #e2e8f0',
                          borderRadius: '14px',
                          padding: '24px',
                          background: isSelected ? 'rgba(24, 54, 48, 0.04)' : '#ffffff',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {isSelected && (
                          <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#183630', color: '#E5C690', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 800 }}>
                            ACTIVE STAY
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <Hotel size={22} color="#183630" />
                          <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{acc.name}</span>
                          {acc.verifiedPlace && (
                            <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                              Google Maps Verified
                            </span>
                          )}
                          {acc.rating && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 800 }}>
                              <Star size={12} fill="#f59e0b" color="#f59e0b" /> {acc.rating} {acc.userRatingCount ? `(${acc.userRatingCount.toLocaleString()})` : ''}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                          {acc.type} • {acc.formattedAddress || acc.location || 'Destination Center'}
                        </div>

                        {acc.googleMapsUri && (
                          <div style={{ marginBottom: '14px' }}>
                            <a
                              href={acc.googleMapsUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '13px',
                                color: '#2563eb',
                                textDecoration: 'none',
                                fontWeight: 700
                              }}
                            >
                              View on Google Maps <ExternalLink size={13} />
                            </a>
                          </div>
                        )}

                        <div style={{ fontSize: '26px', fontWeight: 900, color: isSelected ? '#183630' : '#0f172a', marginBottom: '4px' }}>
                          {formatINR(totalStay)}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                          {formatINR(acc.pricePerNight)} / room / night ({calcs.roomsNeeded} room{calcs.roomsNeeded > 1 ? 's' : ''} × {calcs.nights}N)
                        </div>

                        {acc.bookingNotes && (
                          <div style={{ fontSize: '13px', color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                            {acc.bookingNotes}
                          </div>
                        )}

                        {acc.amenities && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {acc.amenities.map((am, i) => (
                              <span key={i} style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                                {am}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* SAVED PLANS MODAL */}
        {showSavedModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '680px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              
              <div style={{ padding: '22px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FolderHeart size={22} color="#183630" />
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Saved Travel Plans</h3>
                </div>
                <button
                  onClick={() => setShowSavedModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={22} />
                </button>
              </div>

              <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
                {loadingSaved ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                    Loading your saved itineraries...
                  </div>
                ) : savedPlans.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                    <Luggage size={40} style={{ margin: '0 auto 14px auto', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#475569' }}>No saved plans yet.</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>Generate any itinerary and click "Save This Plan" to access it here anytime.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {savedPlans.map(plan => (
                      <div
                        key={plan._id}
                        onClick={() => loadSavedPlan(plan._id)}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          background: '#ffffff',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#183630'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                      >
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                            {plan.title || `${plan.destination} Trip`}
                          </div>
                          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>
                            {plan.origin} → {plan.destination} • {plan.durationDays} Days • {plan.numberOfTravellers} Pax
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                            Saved on {new Date(plan.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#183630' }}>
                              {formatINR(plan.calculations?.totalTripCost || 0)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              Budget: {formatINR(plan.totalBudget)}
                            </div>
                          </div>

                          <button
                            onClick={(e) => deleteSavedPlan(plan._id, e)}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', padding: '8px', color: '#ef4444', cursor: 'pointer' }}
                            title="Delete Saved Plan"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// Subcomponent: Activity Row in Timeline
function ActivityRow({ activity, selected, onToggle, travellers }) {
  const feeGroup = (Number(activity.feePerPerson) || 0) * travellers;

  return (
    <div
      onClick={onToggle}
      className="travel-activity-row"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderRadius: '12px',
        border: selected ? '2px solid #183630' : '1px solid #cbd5e1',
        background: selected ? '#ffffff' : '#f1f5f9',
        cursor: 'pointer',
        marginTop: '12px',
        gap: '16px',
        transition: 'all 0.15s ease',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: '1 1 200px', minWidth: 0 }}>
        <div style={{
          width: '22px',
          height: '22px',
          borderRadius: '6px',
          border: selected ? '2px solid #183630' : '2px solid #94a3b8',
          background: selected ? '#183630' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#E5C690',
          marginTop: '2px',
          flexShrink: 0
        }}>
          {selected && <Check size={14} strokeWidth={3} />}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: selected ? '#0f172a' : '#64748b', wordBreak: 'break-word' }}>
              {activity.name}
            </span>
            {activity.rating && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 800 }}>
                <Star size={11} fill="#b45309" color="#b45309" /> {activity.rating}
              </span>
            )}
          </div>

          <div style={{ fontSize: '14px', color: '#475569', marginTop: '4px', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {activity.description}
          </div>

          {(activity.formattedAddress || activity.location) && (
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', wordBreak: 'break-word', flexWrap: 'wrap' }}>
              <MapPin size={13} color="#94a3b8" style={{ flexShrink: 0 }} />
              <span>{activity.formattedAddress || activity.location}</span>
            </div>
          )}

          {activity.googleMapsUri && (
            <div style={{ marginTop: '6px' }}>
              <a
                href={activity.googleMapsUri}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}
              >
                View on Google Maps <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="travel-activity-price" style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: 800, color: selected ? '#0f172a' : '#94a3b8' }}>
          {feeGroup > 0 ? formatINR(feeGroup) : 'Free Entry'}
        </div>
        {feeGroup > 0 && (
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            ({formatINR(activity.feePerPerson)}/person)
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponent: Meal Stop in Timeline
function MealStop({ label, icon, meal, travellers }) {
  const groupCost = (meal.costPerPerson || 0) * travellers;

  return (
    <div className="travel-meal-stop" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '14px',
      background: '#fffbeb',
      border: '1px solid #fef3c7',
      borderRadius: '12px',
      padding: '14px 18px',
      marginTop: '12px',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 180px', minWidth: 0 }}>
        <div style={{ background: '#fef3c7', color: '#b45309', padding: '8px', borderRadius: '8px', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#92400e', wordBreak: 'break-word' }}>
            {label}: {meal.recommendedPlace || meal.suggestion}
          </div>
          <div style={{ fontSize: '13px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px', wordBreak: 'break-word' }}>
            {meal.rating && <span>★ {meal.rating} rating</span>}
            {meal.formattedAddress && <span>• {meal.formattedAddress}</span>}
            {meal.googleMapsUri && (
              <a
                href={meal.googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#92400e', textDecoration: 'underline', fontWeight: 700 }}
              >
                Google Maps ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="travel-meal-price" style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#92400e' }}>
          ~{formatINR(groupCost)}
        </div>
        <div style={{ fontSize: '12px', color: '#b45309' }}>
          ({formatINR(meal.costPerPerson || 0)}/person)
        </div>
      </div>
    </div>
  );
}
