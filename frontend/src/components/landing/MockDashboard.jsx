import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Zap, LayoutGrid, FolderKanban, Calendar, Flag } from 'lucide-react';

/* ── Mock task data ───────────────────────────────────────── */
const COLUMNS = [
  {
    id: 'todo',
    label: 'To Do',
    dot: '#6b7280',
    border: 'rgba(107,114,128,0.5)',
    tasks: [
      { id: 1, title: 'Design system tokens', priority: 'HIGH',   assignee: 'MG', deadline: 'May 28', tag: '#ef4444' },
      { id: 2, title: 'API rate limiting',    priority: 'MEDIUM', assignee: 'SK', deadline: 'Jun 2',  tag: '#f59e0b' },
    ],
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    dot: '#3b82f6',
    border: 'rgba(59,130,246,0.5)',
    tasks: [
      { id: 3, title: 'Kanban drag & drop',  priority: 'HIGH',   assignee: 'MG', deadline: 'May 25', tag: '#ef4444' },
      { id: 4, title: 'SNS event pipeline',  priority: 'MEDIUM', assignee: 'AL', deadline: 'May 30', tag: '#f59e0b' },
    ],
  },
  {
    id: 'done',
    label: 'Done',
    dot: '#10b981',
    border: 'rgba(16,185,129,0.5)',
    tasks: [
      { id: 5, title: 'Cognito auth flow',   priority: 'HIGH',   assignee: 'MG', deadline: 'May 20', tag: '#ef4444' },
      { id: 6, title: 'DynamoDB schema',     priority: 'LOW',    assignee: 'SK', deadline: 'May 18', tag: '#6b7280' },
    ],
  },
];

/* ── Floating card with priority indicator ────────────────── */
function MiniTaskCard({ task, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Priority bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full" style={{ background: task.tag }} />
      <div className="pl-3 pr-2.5 py-2.5">
        <p className="text-[10px] font-semibold text-white/80 leading-tight mb-1.5 line-clamp-1">{task.title}</p>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {task.assignee[0]}
            </div>
            <span className="text-[9px] text-white/40">{task.assignee}</span>
          </div>
          <div className="flex items-center gap-0.5 text-[8px] text-white/30">
            <Calendar size={7} />
            <span>{task.deadline}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main mock dashboard ────────────────────────────────────── */
export default function MockDashboard() {
  const containerRef = useRef(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-1, 1], [10, -10]), { stiffness: 200, damping: 25 });
  const rotateY = useSpring(useTransform(mouseX, [-1, 1], [-10, 10]), { stiffness: 200, damping: 25 });
  const glowX   = useSpring(useTransform(mouseX, [-1, 1], ['0%', '100%']), { stiffness: 200, damping: 25 });
  const glowY   = useSpring(useTransform(mouseY, [-1, 1], ['0%', '100%']), { stiffness: 200, damping: 25 });

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    mouseY.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full select-none"
      style={{ perspective: '1200px' }}
    >
      {/* Ambient glow behind the dashboard */}
      <div
        className="absolute inset-[-20%] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.15) 40%, transparent 70%)' }}
      />

      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative"
      >
        {/* Main frame */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: '#080814',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
        >
          {/* Dynamic spotlight follow */}
          <motion.div
            className="absolute w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
              left: glowX,
              top: glowY,
              transform: 'translate(-50%, -50%)',
            }}
          />

          {/* Window chrome */}
          <div
            className="flex items-center gap-1.5 px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            {['#ef4444','#f59e0b','#10b981'].map((c, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.8 }} />
            ))}
            <div
              className="flex-1 mx-4 h-5 rounded-md flex items-center justify-center gap-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(99,102,241,0.6)' }} />
              <span className="text-[8px] text-white/30">app.taskflow.io/dashboard</span>
            </div>
          </div>

          {/* App body */}
          <div className="flex" style={{ minHeight: '260px' }}>
            {/* Sidebar */}
            <div
              className="flex flex-col gap-4 px-3 py-4 shrink-0"
              style={{ width: '52px', background: '#050510', borderRight: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center mx-auto"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                <Zap size={11} className="text-white" />
              </div>
              <div className="flex flex-col gap-2 mt-2">
                {[LayoutGrid, FolderKanban].map((Icon, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto"
                    style={{
                      background: i === 0 ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                      border: i === 0 ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                    }}
                  >
                    <Icon size={12} style={{ color: i === 0 ? '#818cf8' : 'rgba(255,255,255,0.3)' }} />
                  </div>
                ))}
              </div>
              {/* User avatar */}
              <div className="mt-auto mx-auto w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                MG
              </div>
            </div>

            {/* Board */}
            <div className="flex-1 p-3 overflow-hidden">
              {/* Page header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] font-bold text-white/90">Board</div>
                  <div className="text-[8px] text-white/35">6 tasks across 3 columns</div>
                </div>
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 8px rgba(99,102,241,0.4)' }}
                >
                  <span>+ New Task</span>
                </div>
              </div>

              {/* Kanban columns */}
              <div className="grid grid-cols-3 gap-2.5">
                {COLUMNS.map((col, ci) => (
                  <div key={col.id}>
                    {/* Column header */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.dot }} />
                      <span className="text-[8px] font-semibold text-white/50 uppercase tracking-wider">{col.label}</span>
                      <span
                        className="ml-auto text-[7px] font-medium text-white/40 px-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)' }}
                      >
                        {col.tasks.length}
                      </span>
                    </div>

                    {/* Column drop zone */}
                    <div
                      className="rounded-lg p-1.5 space-y-1.5"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${col.border}`,
                        borderTopWidth: '2px',
                        minHeight: '120px',
                      }}
                    >
                      {col.tasks.map((task, ti) => (
                        <MiniTaskCard
                          key={task.id}
                          task={task}
                          delay={ci * 0.1 + ti * 0.06}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating task cards (3D depth layers) */}
        {/* Top-right floating card */}
        <motion.div
          className="absolute -top-8 -right-6 rounded-xl overflow-hidden"
          style={{
            background: 'rgba(10,10,20,0.9)',
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(99,102,241,0.15)',
            width: '140px',
            transform: 'translateZ(30px)',
          }}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1 h-1 rounded-full bg-blue-400" />
              <span className="text-[8px] font-semibold text-blue-400 uppercase tracking-wide">In Progress</span>
            </div>
            <p className="text-[9px] text-white/80 font-medium leading-tight">Lambda resize pipeline</p>
            <div className="flex items-center gap-1 mt-1.5">
              <div className="h-1 rounded-full flex-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: '65%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
              </div>
              <span className="text-[7px] text-white/30">65%</span>
            </div>
          </div>
        </motion.div>

        {/* Bottom-left floating card */}
        <motion.div
          className="absolute -bottom-6 -left-8 rounded-xl overflow-hidden"
          style={{
            background: 'rgba(10,10,20,0.9)',
            border: '1px solid rgba(16,185,129,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(16,185,129,0.12)',
            width: '150px',
            transform: 'translateZ(25px)',
          }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        >
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <span className="text-[8px] font-semibold text-emerald-400 uppercase tracking-wide">Just completed</span>
            </div>
            <p className="text-[9px] text-white/80 font-medium leading-tight">DynamoDB GSI added</p>
            <div className="flex items-center gap-1 mt-1.5">
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <div className="w-1 h-1 rounded-full bg-emerald-400" />
                <span className="text-[7px] text-emerald-400 font-medium">Done</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Notification badge */}
        <motion.div
          className="absolute -top-3 -left-3 rounded-xl overflow-hidden"
          style={{
            background: 'rgba(10,10,20,0.95)',
            border: '1px solid rgba(139,92,246,0.3)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 0 12px rgba(139,92,246,0.15)',
            transform: 'translateZ(40px)',
          }}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}
            >
              SK
            </div>
            <div>
              <p className="text-[8px] text-white/80 font-medium">Task assigned to you</p>
              <p className="text-[7px] text-white/30">just now</p>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 ml-1 shrink-0 animate-pulse" />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
