import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, HelpCircle } from 'lucide-react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const resolveConfirmRef = useRef(null);

  // Show non-blocking toast
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Promise-based accessible confirmation modal
  const confirmModal = useCallback(({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false
  }) => {
    return new Promise((resolve) => {
      resolveConfirmRef.current = resolve;
      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText,
        isDestructive
      });
    });
  }, []);

  const handleConfirm = () => {
    if (resolveConfirmRef.current) {
      resolveConfirmRef.current(true);
      resolveConfirmRef.current = null;
    }
    setConfirmDialog(null);
  };

  const handleCancel = () => {
    if (resolveConfirmRef.current) {
      resolveConfirmRef.current(false);
      resolveConfirmRef.current = null;
    }
    setConfirmDialog(null);
  };

  return (
    <NotificationContext.Provider value={{ showToast, confirmModal }}>
      {children}

      {/* TOAST CONTAINER (Top-Right) */}
      <div 
        style={{
          position: 'fixed',
          top: '84px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          width: '100%',
          pointerEvents: 'none'
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const isSuccess = toast.type === 'success';
            const isError = toast.type === 'error';
            const borderColor = isSuccess ? '#a7f3d0' : isError ? '#fca5a5' : '#fde68a';
            const bgColor = isSuccess ? '#ecfdf5' : isError ? '#fef2f2' : '#fffbeb';
            const textColor = isSuccess ? '#065f46' : isError ? '#991b1b' : '#92400e';
            const IconComponent = isSuccess ? CheckCircle2 : isError ? AlertCircle : Info;

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                style={{
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  pointerEvents: 'auto',
                  color: textColor
                }}
              >
                <IconComponent size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, lineHeight: 1.4 }}>
                  {toast.message}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: textColor,
                    padding: '2px',
                    opacity: 0.7
                  }}
                  aria-label="Close notification"
                >
                  <X size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmDialog && (
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(24, 54, 48, 0.45)',
              backdropFilter: 'blur(4px)',
              zIndex: 10000,
              display: 'grid',
              placeItems: 'center',
              padding: '20px'
            }}
            onClick={handleCancel}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              className="bento-card"
              style={{
                width: '100%',
                maxWidth: '440px',
                background: '#ffffff',
                padding: '28px',
                boxShadow: '0 20px 45px rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: confirmDialog.isDestructive ? '#fef2f2' : 'rgba(229, 198, 144, 0.25)',
                    display: 'grid',
                    placeItems: 'center',
                    color: confirmDialog.isDestructive ? '#dc2626' : 'var(--primary)'
                  }}
                >
                  {confirmDialog.isDestructive ? <AlertCircle size={22} /> : <HelpCircle size={22} />}
                </div>
                <h3 id="confirm-dialog-title" style={{ fontSize: '19px', fontWeight: 800, margin: 0 }}>
                  {confirmDialog.title}
                </h3>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                {confirmDialog.message}
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCancel}
                  style={{ padding: '10px 18px', fontSize: '13px' }}
                >
                  {confirmDialog.cancelText}
                </button>
                <button
                  type="button"
                  className="btn-action"
                  onClick={handleConfirm}
                  autoFocus
                  style={{
                    padding: '10px 20px',
                    fontSize: '13px',
                    background: confirmDialog.isDestructive ? '#dc2626' : 'var(--primary)',
                    borderColor: confirmDialog.isDestructive ? '#b91c1c' : 'var(--primary)'
                  }}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
