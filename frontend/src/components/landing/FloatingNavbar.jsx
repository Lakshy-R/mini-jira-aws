import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { Zap, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features',     href: '#features'     },
  { label: 'Workflow',     href: '#workflow'      },
  { label: 'Architecture', href: '#architecture'  },
  { label: 'Metrics',      href: '#metrics'       },
];

function scrollTo(id) {
  document.getElementById(id.replace('#', ''))?.scrollIntoView({ behavior: 'smooth' });
}

export default function FloatingNavbar() {
  const [scrolled,    setScrolled]    = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [activeLink,  setActiveLink]  = useState('');

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 40));

  /* track active section via IntersectionObserver */
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.replace('#', ''));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveLink('#' + entry.target.id);
        });
      },
      { threshold: 0.4 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="w-full max-w-5xl flex items-center justify-between rounded-2xl px-5 h-14"
          animate={scrolled ? {
            background: 'rgba(5, 5, 16, 0.85)',
            borderColor: 'rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          } : {
            background: 'transparent',
            borderColor: 'transparent',
            boxShadow: 'none',
          }}
          style={{ border: '1px solid transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <motion.div
              className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center"
              whileHover={{ scale: 1.08, rotate: -5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Zap size={16} className="text-white" />
            </motion.div>
            <span className="text-white font-bold text-base tracking-tight">TaskFlow</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = activeLink === href;
              return (
                <motion.button
                  key={label}
                  onClick={() => scrollTo(href)}
                  className="relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
                  style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.55)' }}
                  whileHover={{ color: '#fff' }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white/10 rounded-lg"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative">{label}</span>
                </motion.button>
              );
            })}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <Link
              to="/login"
              className="text-sm text-white/60 hover:text-white transition-colors font-medium px-3 py-1.5"
            >
              Sign in
            </Link>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold text-white"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 0 20px rgba(99,102,241,0.4)',
                }}
              >
                Get started
              </Link>
            </motion.div>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </motion.div>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(5,5,16,0.97)', backdropFilter: 'blur(20px)' }}
          >
            <div className="pt-24 px-8 flex flex-col gap-2">
              {NAV_LINKS.map(({ label, href }, i) => (
                <motion.button
                  key={label}
                  onClick={() => { scrollTo(href); setMobileOpen(false); }}
                  className="text-left text-2xl font-bold text-white/80 hover:text-white py-3 border-b border-white/10 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                >
                  {label}
                </motion.button>
              ))}
              <motion.div
                className="mt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center w-full py-3.5 rounded-2xl text-base font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  Get Started Free
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
