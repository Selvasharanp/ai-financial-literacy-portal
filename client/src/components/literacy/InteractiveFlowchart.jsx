// client/src/components/literacy/InteractiveFlowchart.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    GitBranch, 
    CheckCircle2, 
    AlertTriangle, 
    Sparkles, 
    RotateCcw, 
    ArrowRight, 
    HelpCircle,
    ShieldAlert,
    Target
} from 'lucide-react';
import { FLOWCHART_DIAGRAMS } from '../../data/lessonCatalog';

export default function InteractiveFlowchart({ flowchartId = 'smart-purchase-filter' }) {
    const diagram = FLOWCHART_DIAGRAMS[flowchartId] || FLOWCHART_DIAGRAMS['smart-purchase-filter'];
    
    // Path history of visited node IDs
    const [path, setPath] = useState(['start']);
    const currentNodeId = path[path.length - 1];
    const currentNode = diagram.nodes.find(n => n.id === currentNodeId) || diagram.nodes[0];

    const handleSelectBranch = (nextId) => {
        setPath(prev => [...prev, nextId]);
    };

    const handleReset = () => {
        setPath(['start']);
    };

    const handleStepBack = (index) => {
        setPath(prev => prev.slice(0, index + 1));
    };

    return (
        <div style={{
            background: 'var(--bg-subtle)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            background: 'var(--primary)',
                            color: 'var(--gold)',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase'
                        }}>
                            Interactive Decision Tree
                        </span>
                        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                            {diagram.title}
                        </h4>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {diagram.subtitle}
                    </p>
                </div>
                {path.length > 1 && (
                    <button
                        onClick={handleReset}
                        style={{
                            background: '#ffffff',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        <RotateCcw size={14} /> Restart Diagram
                    </button>
                )}
            </div>

            {/* Breadcrumb Path History */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px 14px',
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                fontSize: '12px'
            }}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Decision Steps:</span>
                {path.map((nodeId, idx) => {
                    const node = diagram.nodes.find(n => n.id === nodeId);
                    const isLast = idx === path.length - 1;
                    return (
                        <div key={nodeId} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                                onClick={() => handleStepBack(idx)}
                                style={{
                                    border: 'none',
                                    background: isLast ? 'var(--primary)' : 'var(--bg-subtle)',
                                    color: isLast ? '#ffffff' : 'var(--text-main)',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: isLast ? 700 : 500,
                                    cursor: isLast ? 'default' : 'pointer'
                                }}
                            >
                                {idx + 1}. {node?.title.replace(/Question \d+: /i, '').slice(0, 24)}
                            </button>
                            {!isLast && <ArrowRight size={12} color="var(--text-muted)" />}
                        </div>
                    );
                })}
            </div>

            {/* Active Node Card with Smooth Transitions */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentNode.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: currentNode.type?.startsWith('result') ? '2px solid var(--primary)' : '1px solid var(--border)',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: '0 4px 16px rgba(24, 54, 48, 0.06)'
                    }}
                >
                    {/* Node Header & Type Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {currentNode.type === 'start' && <GitBranch size={22} color="var(--primary)" />}
                        {currentNode.type === 'decision' && <HelpCircle size={22} color="var(--gold)" />}
                        {currentNode.type === 'step' && <Target size={22} color="var(--primary)" />}
                        {currentNode.type === 'result-success' && <CheckCircle2 size={24} color="#059669" />}
                        {currentNode.type === 'result-warning' && <AlertTriangle size={24} color="#d97706" />}
                        {currentNode.type === 'result-celebrate' && <Sparkles size={24} color="#059669" />}

                        <div>
                            <span style={{
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                color: currentNode.type?.startsWith('result') ? '#059669' : 'var(--text-muted)'
                            }}>
                                {currentNode.type === 'decision' ? 'Evaluate Decision' : currentNode.type?.startsWith('result') ? 'Decision Outcome' : 'Checkpoint'}
                            </span>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
                                {currentNode.title}
                            </h3>
                        </div>
                    </div>

                    {/* Node Narrative */}
                    <p style={{
                        margin: 0,
                        fontSize: '14px',
                        color: 'var(--text-main)',
                        lineHeight: '1.6',
                        background: currentNode.type?.startsWith('result') ? 'var(--bg-subtle)' : '#f8fafc',
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)'
                    }}>
                        {currentNode.description}
                    </p>

                    {/* Interactive Branch Buttons */}
                    {currentNode.branches && currentNode.branches.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                                Choose an option to explore the next decision branch:
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                {currentNode.branches.map((branch, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectBranch(branch.nextId)}
                                        style={{
                                            padding: '14px 18px',
                                            borderRadius: '10px',
                                            border: branch.actionType === 'stop' 
                                                ? '1px solid #fca5a5' 
                                                : branch.actionType === 'filter'
                                                ? '1px solid var(--gold)'
                                                : '1px solid var(--primary)',
                                            background: branch.actionType === 'stop'
                                                ? '#fef2f2'
                                                : branch.actionType === 'filter'
                                                ? '#fffbeb'
                                                : 'var(--primary)',
                                            color: branch.actionType === 'stop'
                                                ? '#b91c1c'
                                                : branch.actionType === 'filter'
                                                ? '#92400e'
                                                : '#ffffff',
                                            fontWeight: 700,
                                            fontSize: '13px',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            transition: 'transform 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <span>{branch.label}</span>
                                        <ArrowRight size={14} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                            paddingTop: '8px',
                            borderTop: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>
                                ✓ You have reached the conclusion of this financial decision pathway.
                            </span>
                            <button
                                onClick={handleReset}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    background: 'var(--primary)',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Try Another Scenario
                            </button>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
