import { Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { About } from './pages/About'
import { Brand } from './pages/Brand'
import { Compliance } from './pages/Compliance'
import { Developers } from './pages/Developers'
import { Contact } from './pages/Contact'
import { Financing } from './pages/Financing'
import { Guarantee } from './pages/Guarantee'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { Parents } from './pages/Parents'
import { Partners } from './pages/Partners'
import { Payments } from './pages/Payments'
import { Platform } from './pages/Platform'
import { BecomeMember } from './pages/BecomeMember'
import { RegisterSchool } from './pages/RegisterSchool'
import { Schools } from './pages/Schools'
import { VerifyMembership } from './pages/VerifyMembership'
import { AppShell } from './platform/AppShell'
import { RequireAuth } from './platform/RequireAuth'
import { Dashboard } from './pages/app/Dashboard'
import { GuaranteesBoard } from './pages/app/GuaranteesBoard'
import { InvoicesBoard } from './pages/app/InvoicesBoard'
import { LoansBoard } from './pages/app/LoansBoard'
import { MembershipBoard } from './pages/app/MembershipBoard'
import { Login } from './pages/app/Login'
import { PaymentsBoard } from './pages/app/PaymentsBoard'
import { ReportsBoard } from './pages/app/ReportsBoard'
import { SchoolDossier } from './pages/app/SchoolDossier'
import { SchoolsBoard } from './pages/app/SchoolsBoard'
import { StudentsBoard } from './pages/app/StudentsBoard'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={(
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        )}
      >
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/schools" element={<RequireAuth permission="school.read"><SchoolsBoard /></RequireAuth>} />
        <Route path="/app/membership" element={<RequireAuth permission="school.read"><MembershipBoard /></RequireAuth>} />
        <Route path="/app/schools/:schoolId" element={<RequireAuth permission="school.read"><SchoolDossier /></RequireAuth>} />
        <Route path="/app/students" element={<RequireAuth permission="student.read"><StudentsBoard /></RequireAuth>} />
        <Route path="/app/invoices" element={<RequireAuth permission="invoice.read"><InvoicesBoard /></RequireAuth>} />
        <Route path="/app/payments" element={<RequireAuth permission="payment.read"><PaymentsBoard /></RequireAuth>} />
        <Route path="/app/loans" element={<RequireAuth permission="loan.read"><LoansBoard /></RequireAuth>} />
        <Route path="/app/guarantees" element={<RequireAuth permission="guarantee.read"><GuaranteesBoard /></RequireAuth>} />
        <Route path="/app/reports" element={<RequireAuth permission="report.read"><ReportsBoard /></RequireAuth>} />
      </Route>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/platform" element={<Platform />} />
        <Route path="/platform/payments" element={<Payments />} />
        <Route path="/platform/financing" element={<Financing />} />
        <Route path="/platform/guarantee" element={<Guarantee />} />
        <Route path="/platform/compliance" element={<Compliance />} />
        <Route path="/register" element={<RegisterSchool />} />
        <Route path="/membership" element={<BecomeMember />} />
        <Route path="/membership/verify/:code" element={<VerifyMembership />} />
        <Route path="/solutions/schools" element={<Schools />} />
        <Route path="/solutions/parents" element={<Parents />} />
        <Route path="/solutions/partners" element={<Partners />} />
        <Route path="/about" element={<About />} />
        <Route path="/brand" element={<Brand />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/developers" element={<Developers />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
