import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface BadgeProps {
  count: number;
  triggerAnimation?: boolean;
}

export default function Badge({ count, triggerAnimation = false }: BadgeProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger animation when count changes or triggerAnimation prop updates
  useEffect(() => {
    if (count > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [count, triggerAnimation]);

  if (count === 0) {
    return null;
  }

  return (
    <motion.div
      className="badge-container"
      animate={isAnimating ? 'pulse' : 'idle'}
      variants={{
        idle: {
          scale: 1,
        },
        pulse: {
          scale: [1, 1.15, 1],
          transition: {
            duration: 0.6,
            ease: 'easeInOut',
          },
        },
      }}
      style={{
        position: 'absolute',
        top: '-8px',
        // right: '-4px',
        left: '20px',
        minWidth: '20px',
        height: '20px',
        border: '1px solid var(--figma-color-bg)',
        borderRadius: '10px',
        backgroundColor: 'var(--figma-color-bg-brand)',
        color: 'var(--figma-color-text-onbrand)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 'bold',
        lineHeight: '1',
        padding: '0 4px',
      }}
    >
      {count > 99 ? '99+' : count}
    </motion.div>
  );
}
