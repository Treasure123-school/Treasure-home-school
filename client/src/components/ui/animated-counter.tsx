import { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}
export function AnimatedCounter({
  value,
  duration = 1000,
  className = '',
  suffix = '',
  prefix = ''
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
  const isDecimal = numericValue % 1 !== 0;

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      const easeOutQuad = (t: number) => t * (2 - t);
      const easedProgress = easeOutQuad(progress);

      const currentCount = easedProgress * numericValue;
      setCount(currentCount);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [numericValue, duration]);

  const displayValue = isDecimal ? count.toFixed(2) : Math.floor(count);

  return (
    <span className={className}>
      {prefix}{displayValue}{suffix}
    </span>
  );
}