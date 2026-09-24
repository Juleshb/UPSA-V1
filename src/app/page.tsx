"use client";

import { useState } from "react";
import {
  ArrowDownLeft, ArrowRight, Bell, BookOpen, Building2, CalendarDays,
  Check, ChevronRight, CircleHelp, CreditCard, Download, GraduationCap,
  Grid2X2, HandCoins, History, Landmark, Menu, MoreHorizontal, Plus,
  ReceiptText, Settings, ShieldCheck, Sparkles, UserRound, WalletCards, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const navItems = [
  { label: "Overview", icon: Grid2X2 },
  { label: "Pay school fees", icon: CreditCard },
  { label: "My children", icon: GraduationCap },
  { label: "Transactions", icon: History },
  { label: "Financing", icon: HandCoins },
];

const transactions = [
  { school: "Greenhill Academy", detail: "Tuition fee · Term 2", date: "22 Sep, 2026", amount: "UGX 850,000", color: "green" },
  { school: "Kampala Junior School", detail: "School transport · September", date: "05 Sep, 2026", amount: "UGX 280,000", color: "orange" },
  { school: "Greenhill Academy", detail: "Meals plan · Term 2", date: "27 Aug, 2026", amount: "UGX 185,000", color: "green" },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="RUPSA NEXT">
      <div className="brand-mark">
        <span className="brand-pillar one" />
        <span className="brand-pillar two" />
        <span className="brand-pillar three" />
        <span className="brand-dot" />
      </div>
      {!compact && <div className="brand-copy"><strong>RUPSA</strong><span>NEXT</span></div>}
    </div>
  );
}

function ChildCard({
  name, school, grade, balance, paid, due, progress, orange = false,
  onPay,
}: {
  name: string; school: string; grade: string; balance: string; paid: string;
  due: string; progress: string; orange?: boolean; onPay: () => void;
}) {
  return (
    <article className="child-card">
      <div className={`school-badge ${orange ? "orange" : "green"}`}>
        {orange ? <Landmark size={22} /> : <BookOpen size={22} />}
      </div>
      <div className="child-info">
        <div className="child-title">
          <div><h3>{name}</h3><p>{school} · {grade}</p></div>
          <span className="term-badge">TERM 2</span>
        </div>
        <div className="fee-row">
          <div><span>Outstanding balance</span><strong>{balance}</strong></div>
          <div className="paid-label"><span>Paid</span><strong>{paid}</strong></div>
        </div>
        <div className={`child-progress ${orange ? "orange" : ""}`}><span style={{ width: progress }} /></div>
        <div className="child-actions">
          <span><CalendarDays size={14} /> Due {due}</span>
          <button onClick={onPay}>Pay now <ArrowRight size={14} /></button>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  const closePayment = () => {
    setPayOpen(false);
    window.setTimeout(() => setSuccess(false), 200);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-eyebrow">MY ACCOUNT</p>
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? "active" : ""}`}
              onClick={() => {
                setActiveNav(label);
                setMobileOpen(false);
                if (label === "Pay school fees") setPayOpen(true);
              }}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Financing" && <span className="new-pill">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="side-support">
          <button className="nav-item"><CircleHelp size={19} /><span>Help & support</span></button>
          <button className="nav-item"><Settings size={19} /><span>Settings</span></button>
        </div>
        <div className="profile-mini">
          <div className="avatar">AM</div>
          <div><strong>Amina Mugisha</strong><span>Parent account</span></div>
          <MoreHorizontal size={19} />
        </div>
      </aside>

      {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
          <div className="mobile-logo"><Logo /></div>
          <div className="topbar-actions">
            <button className="school-switcher"><Building2 size={17} /><span>Parent portal</span><ChevronRight size={15} /></button>
            <button className="icon-button" aria-label="Notifications"><Bell size={20} /><span className="notification-dot" /></button>
            <div className="topbar-avatar">AM</div>
          </div>
        </header>

        <div className="dashboard">
          <section className="welcome-row">
            <div>
              <p className="date-line">THURSDAY, 24 SEPTEMBER</p>
              <h1>Good afternoon, Amina <span>👋🏾</span></h1>
              <p>Here&apos;s an overview of your family&apos;s school finances.</p>
            </div>
            <Button className="pay-button" onClick={() => setPayOpen(true)}><Plus size={18} strokeWidth={2.4} />Pay school fees</Button>
          </section>

          <section className="summary-grid">
            <article className="balance-card">
              <div className="balance-card-head">
                <div><p>Total outstanding</p><h2><small>UGX</small> 1,460,000</h2></div>
                <div className="calendar-icon"><CalendarDays size={20} /></div>
              </div>
              <div className="balance-progress"><span style={{ width: "72%" }} /></div>
              <div className="balance-meta"><span><Check size={14} /> UGX 3.8M paid this term</span><strong>72%</strong></div>
            </article>
            <article className="stat-card">
              <div className="stat-icon green"><GraduationCap size={22} /></div>
              <div><p>Children enrolled</p><h3>2 <span>students</span></h3></div>
              <button aria-label="View children"><ArrowRight size={18} /></button>
            </article>
            <article className="stat-card">
              <div className="stat-icon orange"><ReceiptText size={21} /></div>
              <div><p>Next payment</p><h3>08 <span>Oct 2026</span></h3></div>
              <button aria-label="View payment"><ArrowRight size={18} /></button>
            </article>
          </section>

          <section className="content-grid">
            <div className="left-column">
              <div className="section-heading">
                <div><h2>School fee balances</h2><p>Track and pay for each child</p></div>
                <button>View all <ArrowRight size={15} /></button>
              </div>
              <div className="children-list">
                <ChildCard name="Malika Atwine" school="Greenhill Academy" grade="P.5" balance="UGX 850,000" paid="UGX 2,450,000" due="8 Oct 2026" progress="74%" onPay={() => setPayOpen(true)} />
                <ChildCard name="Micah Atwine" school="Kampala Junior School" grade="P.2" balance="UGX 610,000" paid="UGX 1,380,000" due="12 Oct 2026" progress="69%" orange onPay={() => setPayOpen(true)} />
              </div>
              <div className="transactions-panel">
                <div className="section-heading compact">
                  <div><h2>Recent transactions</h2><p>Your latest school payments</p></div>
                  <button>View history <ArrowRight size={15} /></button>
                </div>
                <div className="transaction-list">
                  {transactions.map((item) => (
                    <div className="transaction" key={`${item.school}-${item.detail}`}>
                      <div className={`transaction-icon ${item.color}`}><ArrowDownLeft size={19} /></div>
                      <div className="transaction-main"><strong>{item.school}</strong><span>{item.detail}</span></div>
                      <span className="transaction-date">{item.date}</span>
                      <div className="transaction-amount"><strong>{item.amount}</strong><span><Check size={11} /> Successful</span></div>
                      <button className="download-button" aria-label="Download receipt"><Download size={17} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="right-column">
              <article className="finance-card">
                <div className="finance-glow" />
                <div className="finance-icon"><Sparkles size={21} /></div>
                <span className="finance-eyebrow">RUPSA FLEX</span>
                <h2>School fees, made more manageable.</h2>
                <p>Access flexible, responsible financing from our regulated financial partners.</p>
                <div className="finance-feature"><ShieldCheck size={17} /><span>Eligible for up to <strong>UGX 5M</strong></span></div>
                <button>Check eligibility <ArrowRight size={16} /></button>
                <small>No impact on your credit score</small>
              </article>
              <article className="quick-card">
                <div className="section-heading compact"><div><h2>Quick actions</h2><p>What would you like to do?</p></div></div>
                <button onClick={() => setPayOpen(true)}><span className="quick-icon"><WalletCards size={19} /></span><span><strong>Make a payment</strong><small>Pay fees securely</small></span><ChevronRight size={17} /></button>
                <button><span className="quick-icon"><ReceiptText size={19} /></span><span><strong>Download statement</strong><small>View payment records</small></span><ChevronRight size={17} /></button>
                <button><span className="quick-icon"><UserRound size={19} /></span><span><strong>Add a child</strong><small>Link another student</small></span><ChevronRight size={17} /></button>
              </article>
              <div className="secure-note"><ShieldCheck size={17} /><p><strong>Your payments are protected</strong><span>Bank-grade encryption · Regulated partners</span></p></div>
            </aside>
          </section>
        </div>

        <footer>
          <div className="footer-brand"><Logo compact /><span>Securely powering education</span></div>
          <p>© 2026 RUPSA NEXT · Privacy · Terms</p>
        </footer>
      </main>

      <Dialog open={payOpen} onOpenChange={(open) => open ? setPayOpen(true) : closePayment()}>
        <DialogContent className="payment-dialog" showCloseButton={!success}>
          {!success ? (
            <>
              <DialogHeader>
                <div className="dialog-icon"><CreditCard size={22} /></div>
                <DialogTitle>Pay school fees</DialogTitle>
                <DialogDescription>Complete a secure payment for Malika Atwine.</DialogDescription>
              </DialogHeader>
              <div className="payment-summary">
                <div><span>Greenhill Academy</span><strong>Term 2 tuition fee</strong></div>
                <div><span>Amount due</span><strong>UGX 850,000</strong></div>
              </div>
              <div className="payment-methods">
                <p>Choose payment method</p>
                <label className="method selected"><input type="radio" name="method" defaultChecked /><span className="method-icon">M</span><span><strong>Mobile money</strong><small>MTN or Airtel Money</small></span><Check size={16} /></label>
                <label className="method"><input type="radio" name="method" /><span className="method-icon bank"><Landmark size={16} /></span><span><strong>Bank or card</strong><small>Visa, Mastercard or bank transfer</small></span></label>
              </div>
              <Button className="dialog-pay" onClick={() => setSuccess(true)}>Continue securely <ArrowRight size={16} /></Button>
              <p className="dialog-security"><ShieldCheck size={14} /> Secured with bank-grade encryption</p>
            </>
          ) : (
            <div className="success-state">
              <div className="success-icon"><Check size={34} /></div>
              <DialogTitle>Payment initiated</DialogTitle>
              <DialogDescription>A payment prompt has been sent to your mobile phone. Your receipt will appear here once confirmed.</DialogDescription>
              <Button className="dialog-pay" onClick={closePayment}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
