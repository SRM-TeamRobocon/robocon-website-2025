"use client";

import { motion, useInView, useReducedMotion, type Transition, type UseInViewOptions, type Variant } from "framer-motion";
import { type ElementType, type ReactNode, useRef, useState } from "react";

export interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  variants?: { hidden: Variant; visible: Variant };
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  as?: ElementType;
  once?: boolean;
}

const defaultVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const defaultTransition: Transition = { duration: 0.6, ease: "easeOut" };
const defaultViewOptions: UseInViewOptions = { once: true, amount: 0.25 };

export default function ScrollReveal({
  children,
  className,
  variants = defaultVariants,
  transition = defaultTransition,
  viewOptions = defaultViewOptions,
  as = "div",
  once = true,
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, viewOptions);
  const [isViewed, setIsViewed] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const MotionComponent = motion[as as keyof typeof motion] as typeof motion.div;
  const shouldAnimate = !prefersReducedMotion;

  return (
    <MotionComponent
      ref={ref}
      className={className}
      initial={shouldAnimate ? "hidden" : "visible"}
      animate={shouldAnimate ? (isInView || isViewed ? "visible" : "hidden") : "visible"}
      onAnimationComplete={() => {
        if (once) setIsViewed(true);
      }}
      variants={variants}
      transition={shouldAnimate ? transition : { duration: 0 }}
    >
      {children}
    </MotionComponent>
  );
}
