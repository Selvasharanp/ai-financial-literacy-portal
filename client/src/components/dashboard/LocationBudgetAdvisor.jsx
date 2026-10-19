// client/src/components/dashboard/LocationBudgetAdvisor.jsx
// Location-Based Budget Advisor for FinWise AI Dashboard
// Deterministic local cost comparison (e.g. Bengaluru vs Tenkasi), Google Places integration, and Grok guidance.

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  MapPin,
  Compass,
  Crosshair,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Utensils,
  Bus,
  Hotel,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Edit2,
  IndianRupee,
  Loader2,
  Info
} from 'lucide-react';
import { apiUrl, authConfig } from '../../utils/api';
import { formatINR } from '../../utils/currency';

export default function LocationBudgetAdvisor({ initialBalance, userProfileLocation }) {
  // Location selection state
  const [locationMode, setLocationMode] = useState(userProfileLocation && userProfileLocation !== 'Global' ? 'selected' : 'prompt');
  const [selectedLocation, setSelectedLocation] = useState(userProfileLocation && userProfileLocation !== 'Global' ? userProfileLocation : '');
  const [manualInput, setManualInput] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');

  // User input parameters
  const [availableAmount, setAvailableAmount] = useState(
    initialBalance && initialBalance > 500 ? Math.min(initialBalance, 3000) : 2000
  );
  const [days, setDays] = useState(5);
  const [includeFood, setIncludeFood] = useState(true);
  const [includeTransport, setIncludeTransport] = useState(true);
  const [includeAccommodation, setIncludeAccommodation] = useState(false);
  const [otherDailyExpense, setOtherDailyExpense] = useState('');

  // Calculation & Results State
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [adviceResult, setAdviceResult] = useState(null);
  const [adviceError, setAdviceError] = useState('');
  const [showHowWeEstimated, setShowHowWeEstimated] = useState(false);

  // Sync initial location from user profile if available
  useEffect(() => {
    if (userProfileLocation && userProfileLocation !== 'Global' && !selectedLocation) {
      setSelectedLocation(userProfileLocation);
      setLocationMode('selected');
    }
  }, [userProfileLocation]);

  // Request browser location
  const handleUseMyLocation = () => {
    setLocationNotice('');
    setAdviceError('');

    if (!navigator.geolocation) {
      setLocationNotice('Geolocation is not supported by your browser. Please enter your location manually.');
      setLocationMode('manual');
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await axios.post(
            apiUrl('/api/location-budget/detect'),
            { latitude, longitude },
            authConfig()
          );

          if (res.data && res.data.location && res.data.location !== 'Current Location') {
            setSelectedLocation(res.data.location);
            setLocationMode('selected');
            setLocationNotice(`Location detected: ${res.data.location}${res.data.region ? `, ${res.data.region}` : ''}`);
          } else {
            setLocationNotice('Could not pinpoint city automatically. Please enter your city or PIN code below.');
            setLocationMode('manual');
          }
        } catch (err) {
          console.warn('[LocationBudget] Geolocation reverse geocode failed:', err.message);
          setLocationNotice('Could not resolve your city from GPS coordinates. Please enter it manually.');
          setLocationMode('manual');
        } finally {
          setIsDetecting(false);
        }
      },
      (geoError) => {
        setIsDetecting(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setLocationNotice('Location permission was denied. You can continue by entering your city, town, or PIN code below.');
        } else {
          setLocationNotice('Unable to retrieve your GPS location. Please enter your location manually.');
        }
        setLocationMode('manual');
      },
      { timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 }
    );
  };

  // Confirm manual location
  const handleApplyManualLocation = (e) => {
    if (e) e.preventDefault();
    if (!manualInput || !manualInput.trim()) {
      setLocationNotice('Please enter a city, town, or PIN code.');
      return;
    }
    setSelectedLocation(manualInput.trim());
    setLocationMode('selected');
    setLocationNotice('');
  };

  // Submit and calculate location budget advice
  const handleCalculateAdvice = async (e) => {
    if (e) e.preventDefault();

    const loc = selectedLocation || manualInput;
    if (!loc || !loc.trim()) {
      setAdviceError('Please select or enter a location.');
      return;
    }

    if (Number(availableAmount) < 0) {
      setAdviceError('Please enter a valid available amount.');
      return;
    }

    if (Number(days) <= 0 || Number(days) > 60) {
      setAdviceError('Please enter a valid period between 1 and 60 days.');
      return;
    }

    setLoadingAdvice(true);
    setAdviceError('');

    try {
      const payload = {
        location: loc.trim(),
        availableAmount: Number(availableAmount),
        days: Number(days),
        needs: {
          includeFood,
          includeTransport,
          includeAccommodation,
          otherDailyExpense: Number(otherDailyExpense) || 0
        }
      };

      const res = await axios.post(apiUrl('/api/location-budget/advice'), payload, authConfig());
      setAdviceResult(res.data);
    } catch (err) {
      console.error('[LocationBudget] Advice calculation failed:', err);
      setAdviceError(err.response?.data?.error || 'Unable to calculate budget advice. Please verify inputs and try again.');
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <div
      className="bento-card"
      style={{
        background: '#ffffff',
        padding: '28px',
        marginBottom: '28px',
        border: '1px solid var(--border)',
        borderRadius: '16px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--primary)', color: 'var(--gold)', padding: '10px', borderRadius: '12px', display: 'grid', placeItems: 'center' }}>
            <Compass size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
              Location-Based Budget Advice
            </h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Check if your money is sufficient for your target city, accounting for local price differences (e.g. Bengaluru vs Tenkasi).
            </span>
          </div>
        </div>

        {selectedLocation && locationMode === 'selected' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-subtle)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            <MapPin size={14} color="var(--primary)" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>{selectedLocation}</span>
            <button
              type="button"
              onClick={() => { setLocationMode('manual'); setManualInput(selectedLocation); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
              title="Change location"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* 1. LOCATION SELECTION SECTION */}
      {locationMode === 'prompt' && (
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '10px' }}>
            Step 1: Choose Your Location
          </span>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isDetecting}
              className="btn-action"
              style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--primary)' }}
            >
              {isDetecting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Detecting GPS...</span>
                </>
              ) : (
                <>
                  <Crosshair size={14} />
                  <span>Use My Location</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setLocationMode('manual')}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              <MapPin size={14} />
              <span>Enter Location</span>
            </button>
          </div>
        </div>
      )}

      {locationMode === 'manual' && (
        <form onSubmit={handleApplyManualLocation} style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
              Enter City, Town, or 6-Digit PIN Code (e.g. Bengaluru, Tenkasi, or 627811):
            </label>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isDetecting}
              style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Crosshair size={12} /> Use GPS Instead
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              id="loc-manual-input"
              type="text"
              className="input-wrapper"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              style={{ flex: 1, minWidth: '220px', height: '42px', fontSize: '14px' }}
              aria-label="City, town, or PIN code"
              autoFocus
            />
            <button type="submit" className="btn-action" style={{ padding: '0 20px', height: '42px', fontSize: '13px' }}>
              Confirm Location
            </button>
          </div>
        </form>
      )}

      {locationNotice && (
        <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', color: '#92400e', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>{locationNotice}</span>
        </div>
      )}

      {/* 2. USER INPUTS (Compact Form) */}
      <form onSubmit={handleCalculateAdvice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {/* Available Amount */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label htmlFor="loc-avail-amount" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                Available Amount (INR ₹)
              </label>
              {initialBalance !== undefined && initialBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAvailableAmount(initialBalance)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  title="Prefill with available balance"
                >
                  Use Balance ({formatINR(initialBalance)})
                </button>
              )}
            </div>
            <input
              id="loc-avail-amount"
              type="number"
              min="0"
              step="50"
              className="input-wrapper"
              value={availableAmount}
              onChange={(e) => setAvailableAmount(e.target.value)}
              required
              aria-label="Available Amount in INR"
              style={{ fontSize: '15px', fontWeight: 700, height: '44px' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Enter what you plan to spend — we do not assume your entire account balance is available.
            </span>
          </div>

          {/* Number of Days */}
          <div>
            <label htmlFor="loc-days-input" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
              Period to Last (Days)
            </label>
            <input
              id="loc-days-input"
              type="number"
              min="1"
              max="60"
              className="input-wrapper"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              required
              aria-label="Period to Last in Days"
              style={{ fontSize: '15px', fontWeight: 700, height: '44px' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Number of days this money must cover.
            </span>
          </div>

          {/* Other Daily Expenses */}
          <div>
            <label htmlFor="loc-other-expense" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
              Other Planned Expenses (₹ / day)
            </label>
            <input
              id="loc-other-expense"
              type="number"
              min="0"
              step="10"
              className="input-wrapper"
              value={otherDailyExpense}
              onChange={(e) => setOtherDailyExpense(e.target.value)}
              aria-label="Other Planned Expenses"
              style={{ fontSize: '15px', height: '44px' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              e.g. daily medicine, printouts, phone recharge.
            </span>
          </div>
        </div>

        {/* Essential Needs Checklist */}
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
            Essential Needs to Include:
          </span>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: 'var(--bg-main)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={includeFood}
                onChange={(e) => setIncludeFood(e.target.checked)}
                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
              />
              <Utensils size={14} color="var(--primary)" /> Food & Meals
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={includeTransport}
                onChange={(e) => setIncludeTransport(e.target.checked)}
                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
              />
              <Bus size={14} color="var(--primary)" /> Local Transport / Commute
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={includeAccommodation}
                onChange={(e) => setIncludeAccommodation(e.target.checked)}
                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
              />
              <Hotel size={14} color="var(--primary)" /> Accommodation / Stay (if traveling)
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={loadingAdvice || (!selectedLocation && !manualInput)}
            className="btn-action"
            style={{ width: '100%', padding: '12px', fontSize: '14px' }}
          >
            {loadingAdvice ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Analyzing Local Cost Benchmarks for {selectedLocation || manualInput}...</span>
              </>
            ) : (
              <>
                <Compass size={16} />
                <span>Get Location Budget Advice</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Banner */}
      {adviceError && (
        <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{adviceError}</span>
        </div>
      )}

      {/* 3. SPENDING RECOMMENDATION RESULTS */}
      {adviceResult && (
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          {/* Prominent Sufficiency Banner */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              background:
                adviceResult.status === 'sufficient'
                  ? '#ecfdf5'
                  : adviceResult.status === 'tight'
                  ? '#fffbeb'
                  : adviceResult.status === 'uncertain'
                  ? '#f1f5f9'
                  : '#fef2f2',
              borderColor:
                adviceResult.status === 'sufficient'
                  ? '#a7f3d0'
                  : adviceResult.status === 'tight'
                  ? '#fde68a'
                  : adviceResult.status === 'uncertain'
                  ? '#cbd5e1'
                  : '#fecaca',
              color:
                adviceResult.status === 'sufficient'
                  ? '#065f46'
                  : adviceResult.status === 'tight'
                  ? '#92400e'
                  : adviceResult.status === 'uncertain'
                  ? '#334155'
                  : '#991b1b'
            }}
          >
            {adviceResult.status === 'sufficient' ? (
              <CheckCircle2 size={22} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : adviceResult.status === 'tight' ? (
              <AlertCircle size={22} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : adviceResult.status === 'uncertain' ? (
              <HelpCircle size={22} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <AlertCircle size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            )}

            <div>
              <strong style={{ fontSize: '15px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                Budget Status: {adviceResult.status === 'sufficient' ? 'Sufficient' : adviceResult.status === 'tight' ? 'Tight / Low Buffer' : adviceResult.status === 'uncertain' ? 'Uncertain Local Data' : 'Insufficient Budget'}
              </strong>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                {adviceResult.statusMessage}
              </p>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            {/* Daily Safe Limit */}
            <div style={{ background: 'var(--primary)', color: '#F7F4EE', padding: '18px', borderRadius: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gold)' }}>
                Recommended Daily Limit
              </span>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
                {formatINR(adviceResult.safeDailyLimit)} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--primary-light)' }}>/ day</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--primary-light)' }}>
                Calculated to protect emergency buffer
              </span>
            </div>

            {/* Total Essential Cost */}
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', padding: '18px', borderRadius: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                Essential Need Cost ({adviceResult.days} Days)
              </span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: '4px 0' }}>
                {formatINR(adviceResult.totalEssentialCost)}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ~{formatINR(adviceResult.essentialDailyCost)}/day baseline in {adviceResult.location}
              </span>
            </div>

            {/* Emergency Reserve */}
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '18px', borderRadius: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#065f46' }}>
                Emergency Reserve
              </span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857', margin: '4px 0' }}>
                {formatINR(adviceResult.emergencyReserve)}
              </div>
              <span style={{ fontSize: '11px', color: '#065f46' }}>
                Protected contingency cushion
              </span>
            </div>

            {/* Expected Balance / Shortfall */}
            <div
              style={{
                background: adviceResult.surplusOrShortfall >= 0 ? 'var(--bg-subtle)' : '#fef2f2',
                border: '1px solid',
                borderColor: adviceResult.surplusOrShortfall >= 0 ? 'var(--border)' : '#fecaca',
                padding: '18px',
                borderRadius: '12px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: adviceResult.surplusOrShortfall >= 0 ? 'var(--text-muted)' : '#991b1b' }}>
                {adviceResult.surplusOrShortfall >= 0 ? 'Expected Surplus' : 'Expected Shortfall'}
              </span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: adviceResult.surplusOrShortfall >= 0 ? '#047857' : '#dc2626', margin: '4px 0' }}>
                {adviceResult.surplusOrShortfall >= 0 ? `+${formatINR(adviceResult.surplusOrShortfall)}` : `-${formatINR(Math.abs(adviceResult.surplusOrShortfall))}`}
              </div>
              <span style={{ fontSize: '11px', color: adviceResult.surplusOrShortfall >= 0 ? 'var(--text-muted)' : '#991b1b' }}>
                {adviceResult.surplusOrShortfall >= 0 ? 'Discretionary buffer remaining' : 'Deficit below essential costs'}
              </span>
            </div>
          </div>

          {/* Category Allocations List */}
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', margin: '0 0 12px 0' }}>
              Estimated Category Allocations ({adviceResult.days} Days in {adviceResult.location})
            </h4>

            <div style={{ display: 'grid', gap: '10px' }}>
              {/* Food */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Utensils size={15} color="var(--primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Food & Meals</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
                    {adviceResult.breakdown.food.statusLabel}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                    {formatINR(adviceResult.breakdown.food.total)}
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    ({formatINR(adviceResult.breakdown.food.daily)}/day)
                  </span>
                </div>
              </div>

              {/* Transport */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bus size={15} color="var(--primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Local Transport</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
                    {adviceResult.breakdown.transport.statusLabel}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                    {formatINR(adviceResult.breakdown.transport.total)}
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    ({formatINR(adviceResult.breakdown.transport.daily)}/day)
                  </span>
                </div>
              </div>

              {/* Accommodation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Hotel size={15} color="var(--primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Accommodation</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
                    {adviceResult.breakdown.accommodation.statusLabel}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                    {formatINR(adviceResult.breakdown.accommodation.total)}
                  </strong>
                  {adviceResult.breakdown.accommodation.included && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      ({formatINR(adviceResult.breakdown.accommodation.daily)}/night)
                    </span>
                  )}
                </div>
              </div>

              {/* Emergency Reserve */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', padding: '10px 14px', borderRadius: '8px', border: '1px solid #a7f3d0', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={15} color="#059669" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#065f46' }}>Emergency Reserve</span>
                  <span style={{ fontSize: '11px', color: '#065f46', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px' }}>
                    Calculated Cushion
                  </span>
                </div>
                <strong style={{ fontSize: '14px', color: '#047857' }}>
                  {formatINR(adviceResult.breakdown.emergencyReserve.total)}
                </strong>
              </div>
            </div>
          </div>

          {/* Three Practical Recommendations */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', margin: '0 0 10px 0' }}>
              3 Practical Recommendations to Reduce Spending:
            </h4>
            <div style={{ display: 'grid', gap: '8px' }}>
              {adviceResult.recommendations.map((rec, rIdx) => (
                <div
                  key={rIdx}
                  style={{
                    background: '#ffffff',
                    borderLeft: '4px solid var(--gold)',
                    border: '1px solid var(--border)',
                    borderLeftWidth: '4px',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    color: 'var(--text-main)'
                  }}
                >
                  <strong>{rIdx + 1}. </strong>{rec}
                </div>
              ))}
            </div>
          </div>

          {/* AI Local Wisdom (Grok Integration) */}
          {adviceResult.aiLocalInsight && (
            <div style={{ background: 'linear-gradient(135deg, #183630 0%, #112722 100%)', color: '#ffffff', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--gold)', display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
              <Sparkles size={16} color="var(--gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <strong style={{ color: 'var(--gold)', display: 'block', marginBottom: '2px' }}>AI Local Insight ({adviceResult.location}):</strong>
                <span>{adviceResult.aiLocalInsight}</span>
              </div>
            </div>
          )}

          {/* 4. COLLAPSIBLE "HOW WE ESTIMATED THIS" SECTION */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowHowWeEstimated(!showHowWeEstimated)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                background: 'var(--bg-main)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--primary)'
              }}
            >
              <span>How we estimated this (Data Sources & Disclaimers)</span>
              {showHowWeEstimated ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showHowWeEstimated && (
              <div style={{ padding: '18px', background: '#ffffff', borderTop: '1px solid var(--border)', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-main)' }}>
                <p style={{ margin: '0 0 10px 0' }}>
                  <strong>Regional Cost Index: </strong>
                  {adviceResult.costComparisonText} (Cost Index: {adviceResult.costIndex}).
                </p>

                <p style={{ margin: '0 0 10px 0' }}>
                  <strong>Source Benchmark: </strong>
                  {adviceResult.estimationDetails.dataSource}. Confidence: <strong style={{ textTransform: 'capitalize' }}>{adviceResult.estimationDetails.confidence}</strong>.
                </p>

                <p style={{ margin: '0 0 12px 0', color: 'var(--text-muted)' }}>
                  <strong>Disclaimer: </strong>
                  {adviceResult.estimationDetails.disclaimer} Google Places API results alone do not establish exact live prices, room availability, or taxi fares.
                </p>

                {/* Verified Places from Google Places API (if any) */}
                {adviceResult.nearbyPlaces && adviceResult.nearbyPlaces.length > 0 && (
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
                      Verified Local Venues in {adviceResult.location} (via Google Places):
                    </span>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {adviceResult.nearbyPlaces.map((p, pIdx) => (
                        <div key={pIdx} style={{ background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '13px' }}>{p.name}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{p.address}</span>
                            <span style={{ fontSize: '11px', color: '#b45309' }}>• {p.priceNote}</span>
                          </div>
                          {p.mapsUrl && (
                            <a
                              href={p.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                            >
                              Maps <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
