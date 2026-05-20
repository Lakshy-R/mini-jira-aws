import { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose, duration = 3000 }) {
    useEffect(() => {
        if (!duration) return undefined;
        const timer = setTimeout(() => onClose?.(), duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const color =
        type === 'error'
            ? 'bg-red-600'
            : type === 'success'
                ? 'bg-green-600'
                : 'bg-gray-900';

    return (
        <div className="fixed top-4 right-4 z-50">
            <div className={`${color} text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-3`}>
                <span>{message}</span>
                <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white text-xs"
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
