import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  AnimatePresence,
  stagger,
  useAnimate,
} from 'framer-motion';
import {
  Zap, ArrowRight, LayoutGrid, Shield, Radio, Database,
  BarChart3, Users, ChevronRight, Check,
  Layers, Cloud, Activity, GitBranch, Server,
  Lock, Sparkles,
} from 'lucide-react';
import Lenis from 'lenis';
import { useAuthStore } from '../store/auth.store';
import FloatingNavbar from '../components/landing/FloatingNavbar';
import MockDashboard from '../components/landing/MockDashboard';

/* ─── Shared helpers ────────────────────────────────────── */

const EASE_OUT = [0.16, 1, 0.3, 1];

function FadeIn({ children, delay = 0, y = 30, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-indigo-300 mb-4"
      style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
    >
      <Sparkles size={11} />
      {children}
    </span>
  );
}

function SectionHeading({ children, accent, className = '' }) {
  return (
    <h2 className={`text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight ${className}`}>
      {children}{' '}
      {accent && <span className="text-gradient">{accent}</span>}
    </h2>
  );
}

/* ─── HERO ───────────────────────────────────────────────── */

const HERO_WORDS = ['Ship', 'faster', 'with', 'intelligent', 'workflows.'];

function HeroWord({ word, index }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const isAccent = word === 'intelligent' || word === 'workflows.';
  return (
    <motion.span
      ref={ref}
      className={`inline-block mr-[0.25em] ${isAccent ? 'text-gradient' : 'text-white'}`}
      initial={{ opacity: 0, y: 40, rotateX: -30 }}
      animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.09, ease: EASE_OUT }}
      style={{ transformOrigin: 'bottom', display: 'inline-block' }}
    >
      {word}
    </motion.span>
  );
}

function HeroSection() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -80]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-28 pb-20 overflow-hidden landing-grid">
      {/* Gradient blobs */}
      <div className="absolute pointer-events-none inset-0 overflow-hidden">
        <div
          className="absolute"
          style={{
            top: '-10%', left: '-5%',
            width: '60%', height: '70%',
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 65%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute"
          style={{
            top: '5%', right: '-5%',
            width: '50%', height: '60%',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.14) 0%, transparent 65%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: '-5%', left: '30%',
            width: '40%', height: '50%',
            background: 'radial-gradient(ellipse, rgba(34,211,238,0.08) 0%, transparent 65%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Horizontal beam */}
        <div
          className="absolute animate-beam"
          style={{
            top: '40%', left: 0, right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)',
          }}
        />
      </div>

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 max-w-7xl mx-auto px-6 w-full"
      >
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left column */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }}
            >
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-indigo-300 mb-8"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                AWS-Powered Project Management Platform
              </span>
            </motion.div>

            {/* Headline */}
            <h1
              className="text-5xl sm:text-6xl lg:text-[4.5rem] font-black leading-[1.08] tracking-tight mb-6"
              style={{ perspective: '800px' }}
            >
              {HERO_WORDS.map((word, i) => (
                <HeroWord key={i} word={word} index={i} />
              ))}
            </h1>

            {/* Subtext */}
            <FadeIn delay={0.55} y={16}>
              <p className="text-lg text-white/55 leading-relaxed mb-8 max-w-lg">
                TaskFlow is a production-grade project board built on AWS — with real-time event pipelines,
                role-based access, Kanban drag-and-drop, and enterprise-level observability out of the box.
              </p>
            </FadeIn>

            {/* CTA row */}
            <FadeIn delay={0.7} y={16}>
              <div className="flex items-center flex-wrap gap-3 mb-10">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white animate-gradient"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)',
                      backgroundSize: '200% 200%',
                      boxShadow: '0 0 32px rgba(99,102,241,0.35), 0 4px 16px rgba(0,0,0,0.3)',
                    }}
                  >
                    Get Started Free
                    <ArrowRight size={16} />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <a
                    href="#features"
                    onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white/70 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Explore Features
                    <ChevronRight size={15} />
                  </a>
                </motion.div>
              </div>
            </FadeIn>

            {/* Tech proof */}
            <FadeIn delay={0.85} y={12}>
              <div className="flex items-center flex-wrap gap-x-5 gap-y-2">
                {[
                  'DynamoDB',
                  'SNS + SQS',
                  'Lambda',
                  'CloudWatch',
                  'Cognito',
                ].map((tech) => (
                  <span key={tech} className="flex items-center gap-1.5 text-xs text-white/35">
                    <Check size={11} className="text-indigo-400" />
                    {tech}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>

          {/* Right column — 3D mock dashboard */}
          <FadeIn delay={0.4} y={20} className="relative">
            <MockDashboard />
          </FadeIn>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-[10px] text-white/25 uppercase tracking-widest">Scroll</span>
        <div
          className="w-px h-8"
          style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)' }}
        />
      </motion.div>
    </section>
  );
}

/* ─── FEATURES ───────────────────────────────────────────── */

const FEATURES = [
  {
    icon: LayoutGrid,
    label: 'Visual Kanban Board',
    desc: 'Drag-and-drop task management with dnd-kit. Four status columns, priority indicators, deadline tracking, and image attachments.',
    gradient: 'from-indigo-500 to-violet-500',
    glow: 'rgba(99,102,241,0.25)',
    badge: 'Core',
  },
  {
    icon: Radio,
    label: 'Event-Driven Pipeline',
    desc: 'SNS topics fan out to SQS queues consumed by Lambda workers. Every task assignment triggers real-time notifications and activity logs.',
    gradient: 'from-violet-500 to-purple-600',
    glow: 'rgba(139,92,246,0.25)',
    badge: 'Backend',
  },
  {
    icon: Shield,
    label: 'Role-Based Access',
    desc: 'Cognito-backed authentication with custom claims. Managers create and assign tasks; employees update status. Team isolation enforced at API level.',
    gradient: 'from-cyan-500 to-blue-500',
    glow: 'rgba(34,211,238,0.2)',
    badge: 'Security',
  },
  {
    icon: Database,
    label: 'DynamoDB Architecture',
    desc: 'Single-table design with GSIs for team-based queries. Pagination tokens, image version tracking, and optimized access patterns throughout.',
    gradient: 'from-orange-500 to-amber-500',
    glow: 'rgba(249,115,22,0.2)',
    badge: 'Data',
  },
  {
    icon: BarChart3,
    label: 'CloudWatch Observability',
    desc: 'Custom metrics for task creation, closure, and team throughput. Daily digest via EventBridge, structured JSON logs, and correlation IDs.',
    gradient: 'from-green-500 to-teal-500',
    glow: 'rgba(16,185,129,0.2)',
    badge: 'Ops',
  },
  {
    icon: Cloud,
    label: 'S3 Image Pipeline',
    desc: 'Originals bucket triggers a Lambda resize function. Thumbnails served via pre-signed URLs with CloudFront-ready caching. Infinite-loop prevention built in.',
    gradient: 'from-pink-500 to-rose-500',
    glow: 'rgba(236,72,153,0.2)',
    badge: 'Storage',
  },
];

function FeatureCard({ feature, index }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-1, 1], [4, -4]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-1, 1], [-4, 4]), { stiffness: 300, damping: 30 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.07, ease: EASE_OUT }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
        mouseY.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
      }}
      onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
      style={{ perspective: '800px' }}
    >
      <motion.div
        style={{ rotateX, rotateY }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="group h-full rounded-2xl p-6 cursor-default relative overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 0 0 0 transparent',
          transition: 'box-shadow 0.3s ease',
        }}
        whileHover={{
          borderColor: `rgba(99,102,241,0.2)`,
          boxShadow: `0 0 40px ${feature.glow}, 0 8px 32px rgba(0,0,0,0.3)`,
        }}
      >
        {/* Background gradient on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
          style={{ background: `radial-gradient(ellipse at top left, ${feature.glow} 0%, transparent 60%)` }}
        />

        {/* Badge */}
        <div className="relative flex items-center justify-between mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${feature.gradient}`}
            style={{ boxShadow: `0 4px 12px ${feature.glow}` }}
          >
            <feature.icon size={18} className="text-white" />
          </div>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {feature.badge}
          </span>
        </div>

        <h3 className="relative text-base font-bold text-white mb-2">{feature.label}</h3>
        <p className="relative text-sm text-white/45 leading-relaxed">{feature.desc}</p>
      </motion.div>
    </motion.div>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="relative py-28 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <SectionLabel>Platform Features</SectionLabel>
          <SectionHeading className="mb-4" accent="at every layer.">
            Built for scale
          </SectionHeading>
          <p className="text-lg text-white/45 max-w-2xl mx-auto">
            Every component of TaskFlow is designed for production — from the frontend down to the DynamoDB
            access patterns and Lambda event workers.
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.label} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── WORKFLOW ───────────────────────────────────────────── */

const WORKFLOW_STEPS = [
  { status: 'TODO',        dot: '#6b7280', color: 'rgba(107,114,128,0.6)',  label: 'To Do',       title: 'Design API endpoints',          priority: 'HIGH',   tag: '#ef4444', assignee: 'MG' },
  { status: 'IN_PROGRESS', dot: '#3b82f6', color: 'rgba(59,130,246,0.6)',   label: 'In Progress', title: 'Design API endpoints',          priority: 'HIGH',   tag: '#ef4444', assignee: 'MG' },
  { status: 'IN_REVIEW',   dot: '#f59e0b', color: 'rgba(245,158,11,0.6)',   label: 'In Review',   title: 'Design API endpoints',          priority: 'HIGH',   tag: '#ef4444', assignee: 'SK' },
  { status: 'DONE',        dot: '#10b981', color: 'rgba(16,185,129,0.6)',   label: 'Done',        title: 'Design API endpoints',          priority: 'HIGH',   tag: '#10b981', assignee: 'MG' },
];

function WorkflowSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setActiveStep((s) => (s + 1) % 4), 1800);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <section id="workflow" className="relative py-28">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(139,92,246,0.07) 0%, transparent 60%)' }}
      />
      <div ref={ref} className="relative max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <SectionLabel>Task Lifecycle</SectionLabel>
          <SectionHeading accent="end to end.">
            Track every task,
          </SectionHeading>
          <p className="text-lg text-white/45 mt-4 max-w-2xl mx-auto">
            Watch tasks flow through their entire lifecycle. Each status change triggers real-time
            events and activity log entries in DynamoDB.
          </p>
        </FadeIn>

        {/* Status flow */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap mb-12">
          {WORKFLOW_STEPS.map((step, i) => {
            const isActive = i === activeStep;
            const isPast   = i < activeStep;
            return (
              <div key={step.status} className="flex items-center gap-2 sm:gap-4">
                <motion.div
                  animate={isActive ? { scale: 1.05, borderColor: step.dot } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="relative px-4 py-3 rounded-xl cursor-default"
                  style={{
                    background: isActive
                      ? `rgba(${step.dot === '#6b7280' ? '107,114,128' : step.dot === '#3b82f6' ? '59,130,246' : step.dot === '#f59e0b' ? '245,158,11' : '16,185,129'},0.12)`
                      : isPast
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? step.dot : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: isActive ? `0 0 20px ${step.color}` : 'none',
                    minWidth: '110px',
                  }}
                  onClick={() => setActiveStep(i)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: isActive || isPast ? step.dot : 'rgba(255,255,255,0.2)' }}>
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          style={{ background: step.dot }}
                        />
                      )}
                    </div>
                    <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-white/40'}`}>
                      {step.label}
                    </span>
                  </div>
                </motion.div>

                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="hidden sm:flex items-center">
                    <div
                      className="w-8 h-px"
                      style={{
                        background: i < activeStep
                          ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                          : 'rgba(255,255,255,0.1)',
                        transition: 'background 0.4s',
                      }}
                    />
                    <ChevronRight size={12} style={{ color: i < activeStep ? '#818cf8' : 'rgba(255,255,255,0.15)' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Animated task card preview */}
        <FadeIn delay={0.3} className="flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="relative rounded-2xl overflow-hidden w-full max-w-md"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${WORKFLOW_STEPS[activeStep].dot}40`,
                boxShadow: `0 0 40px ${WORKFLOW_STEPS[activeStep].color}, 0 16px 48px rgba(0,0,0,0.4)`,
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: `linear-gradient(90deg, ${WORKFLOW_STEPS[activeStep].dot}, transparent)` }}
              />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: `${WORKFLOW_STEPS[activeStep].dot}18`,
                      color: WORKFLOW_STEPS[activeStep].dot,
                      border: `1px solid ${WORKFLOW_STEPS[activeStep].dot}30`,
                    }}
                  >
                    {WORKFLOW_STEPS[activeStep].label}
                  </div>
                  <div className="px-2 py-1 rounded-full text-[10px] font-bold text-red-300 bg-red-500/10 border border-red-500/20">
                    HIGH
                  </div>
                </div>
                <h3 className="text-base font-bold text-white mb-2">Design API endpoints</h3>
                <p className="text-sm text-white/45 mb-5">
                  Define the REST API contract for tasks, projects, and user management.
                  Include request/response schemas and auth requirements.
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                    >
                      {WORKFLOW_STEPS[activeStep].assignee}
                    </div>
                    <span className="text-xs text-white/35">{WORKFLOW_STEPS[activeStep].assignee === 'MG' ? 'Mahmoud G.' : 'Sara K.'}</span>
                  </div>
                  <span className="text-xs text-white/25">Due May 28</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── ARCHITECTURE ───────────────────────────────────────── */

const ARCH_NODES = [
  { id: 'client',    x: 5,  y: 35, label: 'React Client', icon: LayoutGrid, color: '#6366f1', glow: 'rgba(99,102,241,0.4)' },
  { id: 'cognito',   x: 5,  y: 65, label: 'Cognito',       icon: Lock,       color: '#ec4899', glow: 'rgba(236,72,153,0.3)' },
  { id: 'api',       x: 32, y: 35, label: 'Express API',   icon: Server,     color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)' },
  { id: 'dynamo',    x: 60, y: 15, label: 'DynamoDB',      icon: Database,   color: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  { id: 's3',        x: 60, y: 45, label: 'S3 Buckets',    icon: Cloud,      color: '#10b981', glow: 'rgba(16,185,129,0.3)' },
  { id: 'sns',       x: 60, y: 72, label: 'SNS Topic',     icon: Radio,      color: '#f97316', glow: 'rgba(249,115,22,0.3)' },
  { id: 'cw',        x: 32, y: 65, label: 'CloudWatch',    icon: BarChart3,  color: '#06b6d4', glow: 'rgba(6,182,212,0.3)' },
  { id: 'lambda',    x: 85, y: 35, label: 'Lambda',        icon: Zap,        color: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  { id: 'sqs',       x: 85, y: 72, label: 'SQS Queue',     icon: Layers,     color: '#f97316', glow: 'rgba(249,115,22,0.3)' },
  { id: 'eventbridge', x: 32, y: 92, label: 'EventBridge', icon: GitBranch,  color: '#a78bfa', glow: 'rgba(167,139,250,0.3)' },
];

const ARCH_CONNECTIONS = [
  ['client', 'api'],    ['cognito', 'api'],   ['api', 'dynamo'],
  ['api', 's3'],        ['api', 'sns'],        ['api', 'cw'],
  ['s3', 'lambda'],     ['sns', 'sqs'],        ['sqs', 'lambda'],
  ['eventbridge', 'lambda'],
];

function ArchNode({ node, inView, index }) {
  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1.5"
      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay: 0.3 + index * 0.06, ease: EASE_OUT }}
    >
      <motion.div
        className="w-12 h-12 rounded-2xl flex items-center justify-center relative"
        style={{ background: `${node.color}18`, border: `1px solid ${node.color}40` }}
        whileHover={{ scale: 1.15, boxShadow: `0 0 20px ${node.glow}` }}
        animate={{ boxShadow: [`0 0 0px transparent`, `0 0 12px ${node.glow}`, `0 0 0px transparent`] }}
        transition={{ boxShadow: { duration: 3, repeat: Infinity, delay: index * 0.3 } }}
      >
        <node.icon size={18} style={{ color: node.color }} />
        {/* Pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ border: `1px solid ${node.color}30` }}
          animate={{ scale: [1, 1.3], opacity: [0.4, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: index * 0.4 }}
        />
      </motion.div>
      <span className="text-[9px] text-white/40 font-medium whitespace-nowrap text-center leading-tight">
        {node.label}
      </span>
    </motion.div>
  );
}

function ArchitectureSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  const nodeMap = Object.fromEntries(ARCH_NODES.map((n) => [n.id, n]));

  return (
    <section id="architecture" className="relative py-28">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)' }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <SectionLabel>AWS Architecture</SectionLabel>
          <SectionHeading accent="cloud-native.">
            Genuinely
          </SectionHeading>
          <p className="text-lg text-white/45 mt-4 max-w-2xl mx-auto">
            Every component is a real AWS service wired with IAM, VPC, and least-privilege policies.
            Not simulated — deployed and running.
          </p>
        </FadeIn>

        {/* Architecture diagram */}
        <FadeIn delay={0.2}>
          <div
            ref={ref}
            className="relative rounded-3xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              height: '420px',
            }}
          >
            {/* Grid lines */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            {/* SVG connection lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(99,102,241,0.6)" />
                  <stop offset="100%" stopColor="rgba(139,92,246,0.3)" />
                </linearGradient>
              </defs>
              {ARCH_CONNECTIONS.map(([from, to], i) => {
                const a = nodeMap[from];
                const b = nodeMap[to];
                if (!a || !b) return null;
                return (
                  <motion.line
                    key={i}
                    x1={`${a.x}%`} y1={`${a.y}%`}
                    x2={`${b.x}%`} y2={`${b.y}%`}
                    stroke="url(#line-grad)"
                    strokeWidth="1"
                    strokeDasharray="4 6"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={inView ? { pathLength: 1, opacity: 1 } : {}}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.05 }}
                    style={{ strokeDashoffset: 0 }}
                    className="animate-flow-dash"
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {ARCH_NODES.map((node, i) => (
              <ArchNode key={node.id} node={node} inView={inView} index={i} />
            ))}
          </div>
        </FadeIn>

        {/* Architecture legend */}
        <FadeIn delay={0.4} className="mt-8 flex flex-wrap justify-center gap-6">
          {[
            { label: 'Compute',  color: '#8b5cf6' },
            { label: 'Storage',  color: '#f59e0b' },
            { label: 'Messaging', color: '#f97316' },
            { label: 'Auth',     color: '#ec4899' },
            { label: 'Observability', color: '#06b6d4' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs text-white/35">{label}</span>
            </div>
          ))}
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── METRICS ────────────────────────────────────────────── */

function Counter({ target, suffix = '', prefix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 1800;
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.floor(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count}{suffix}
    </span>
  );
}

const METRICS = [
  { value: 12,    suffix: '+', label: 'AWS Services',     sub: 'Integrated & deployed',            gradient: 'from-indigo-500 to-violet-500' },
  { value: 100,   prefix: '<', suffix: 'ms', label: 'Avg API Latency', sub: 'DynamoDB GetItem baseline',       gradient: 'from-violet-500 to-purple-600' },
  { value: 99.9,  suffix: '%', label: 'Uptime SLA',       sub: 'Multi-AZ architecture',            gradient: 'from-cyan-500 to-blue-500' },
  { value: 4,     suffix: '',  label: 'DynamoDB Tables',  sub: 'Tasks · Projects · Comments · Logs', gradient: 'from-orange-500 to-amber-500' },
];

function MetricsSection() {
  return (
    <section id="metrics" className="relative py-28">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.06) 0%, transparent 60%)' }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <SectionLabel>By The Numbers</SectionLabel>
          <SectionHeading accent="measurable.">
            Production-grade,
          </SectionHeading>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {METRICS.map((m, i) => (
            <FadeIn key={m.label} delay={i * 0.1}>
              <div
                className="rounded-2xl p-6 text-center relative overflow-hidden group"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div
                  className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${m.gradient}`}
                  style={{ opacity: '0.04' }}
                />
                <div className={`text-4xl font-black mb-2 text-gradient`}>
                  <Counter target={m.value} suffix={m.suffix} prefix={m.prefix || ''} />
                </div>
                <div className="text-sm font-bold text-white/80 mb-1">{m.label}</div>
                <div className="text-xs text-white/35">{m.sub}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Tech badges */}
        <FadeIn delay={0.4} className="mt-14">
          <div
            className="flex flex-wrap items-center justify-center gap-3 p-6 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-xs text-white/30 mr-2">Stack:</span>
            {[
              { label: 'React 19',       color: '#61dafb' },
              { label: 'Node/Express',   color: '#68a063' },
              { label: 'DynamoDB',       color: '#f59e0b' },
              { label: 'Cognito',        color: '#ec4899' },
              { label: 'SNS + SQS',      color: '#f97316' },
              { label: 'Lambda',         color: '#f59e0b' },
              { label: 'S3',             color: '#10b981' },
              { label: 'CloudWatch',     color: '#06b6d4' },
              { label: 'EventBridge',    color: '#a78bfa' },
              { label: 'TanStack Query', color: '#6366f1' },
              { label: 'Framer Motion',  color: '#cc44ff' },
              { label: 'Tailwind v4',    color: '#38bdf8' },
            ].map(({ label, color }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background: `${color}12`,
                  border: `1px solid ${color}25`,
                  color: `${color}`,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── CTA ────────────────────────────────────────────────── */

function CTASection() {
  return (
    <section id="cta" className="relative py-32 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.1) 35%, transparent 70%)',
          }}
        />
        {/* Horizontal lines */}
        {[15, 35, 55, 75, 90].map((top, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 h-px"
            style={{
              top: `${top}%`,
              background: `rgba(99,102,241,${0.04 + i * 0.01})`,
            }}
          />
        ))}
      </div>

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <FadeIn>
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-indigo-300 mb-8"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
            animate={{ boxShadow: ['0 0 0px transparent', '0 0 20px rgba(99,102,241,0.3)', '0 0 0px transparent'] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles size={14} />
            Ready to ship?
          </motion.div>

          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tighter mb-6">
            Build better software,
            <br />
            <span className="text-gradient">together.</span>
          </h2>

          <p className="text-xl text-white/45 mb-10 max-w-2xl mx-auto leading-relaxed">
            Start with TaskFlow and experience what a production-grade,
            cloud-native project management system really feels like.
          </p>

          <div className="flex items-center justify-center flex-wrap gap-4">
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white animate-gradient"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)',
                  backgroundSize: '200% 200%',
                  boxShadow: '0 0 40px rgba(99,102,241,0.45), 0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                Get Started Free
                <ArrowRight size={18} />
              </Link>
            </motion.div>
            <Link
              to="/login"
              className="text-sm text-white/40 hover:text-white/70 transition-colors underline underline-offset-4"
            >
              Sign into existing workspace
            </Link>
          </div>

          <FadeIn delay={0.3} className="mt-12 flex items-center justify-center flex-wrap gap-x-8 gap-y-3">
            {[
              'No credit card required',
              'Full AWS integration',
              'Role-based access',
              'Real-time event pipeline',
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-xs text-white/30">
                <Check size={12} className="text-indigo-400/60" />
                {item}
              </span>
            ))}
          </FadeIn>
        </FadeIn>
      </div>

      {/* Footer */}
      <FadeIn delay={0.5} className="mt-24 border-t border-white/5 pt-8 max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Zap size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white/60">TaskFlow</span>
          </div>
          <p className="text-xs text-white/25">
            Built by Mahmoud Ghoraba · AWS-powered project management
          </p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-xs text-white/30 hover:text-white/60 transition-colors">Sign in</Link>
            <Link to="/login" className="text-xs text-white/30 hover:text-white/60 transition-colors">Dashboard</Link>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

/* ─── PAGE ORCHESTRATOR ──────────────────────────────────── */

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  /* Redirect authenticated users to the app */
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  /* Lenis smooth scroll */
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    let raf;
    function tick(time) {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      lenis.destroy();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: '#050510', color: 'white' }}
    >
      <FloatingNavbar />
      <HeroSection />
      <FeaturesSection />
      <WorkflowSection />
      <ArchitectureSection />
      <MetricsSection />
      <CTASection />
    </div>
  );
}
