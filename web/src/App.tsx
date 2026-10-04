import { Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { About } from './pages/About'
import { Brand } from './pages/Brand'
import { Compliance } from './pages/Compliance'
import { Developers } from './pages/Developers'
import { Contact } from './pages/Contact'
import { PublicTraining } from './pages/Training'
import { OnlineServices } from './pages/Services'
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
import { LendingLayout } from './pages/app/lending/Layout'
import { LendingDashboard } from './pages/app/lending/Dashboard'
import { ApplicationFilePage as LendingApplicationFile, ApplicationForm as LendingApplicationForm, ApplicationList as LendingApplicationList } from './pages/app/lending/Applications'
import { LoanFilePage as LendingLoanFile, LoanList as LendingLoanList } from './pages/app/lending/Book'
import { LendingAuditBoard, LendingNoticeBoard, LendingReportBoard, ProductBoard } from './pages/app/lending/Office'
import { MembershipBoard } from './pages/app/MembershipBoard'
import { MembershipLayout } from './pages/app/membership/Layout'
import { MembershipDashboard } from './pages/app/membership/Dashboard'
import { MemberFilePage, MemberForm, MemberList } from './pages/app/membership/Members'
import { CategoryBoard, MembershipAuditBoard, MembershipNoticeBoard, MembershipReportBoard } from './pages/app/membership/Office'
import { Login } from './pages/app/Login'
import { PaymentsBoard } from './pages/app/PaymentsBoard'
import { DonationLayout } from './pages/app/donations/Layout'
import { DonationDashboard } from './pages/app/donations/Dashboard'
import { DonorFile, DonorForm, DonorList } from './pages/app/donations/Donors'
import { CampaignFile, CampaignForm, CampaignList } from './pages/app/donations/Campaigns'
import { GiftFile, GiftForm, GiftList, PledgeBoard } from './pages/app/donations/Gifts'
import { BeneficiaryFile, BeneficiaryForm, BeneficiaryList } from './pages/app/donations/Beneficiaries'
import { AllocationBoard, DistributionBoard } from './pages/app/donations/Flow'
import { AuditBoard, ImpactBoard, MessageBoard, PaymentBoard, ReceiptBoard, ReportBoard } from './pages/app/donations/Insights'
import { InvestmentLayout } from './pages/app/investments/Layout'
import { InvestmentDashboard } from './pages/app/investments/Dashboard'
import { OpportunityFile, OpportunityForm, OpportunityList } from './pages/app/investments/Opportunities'
import { ApplicationFile, ApplicationForm, ApplicationList } from './pages/app/investments/Applications'
import { PositionFile, PositionList } from './pages/app/investments/Positions'
import { ExitBoard, MaturityBoard, PortfolioBoard, ReturnBoard } from './pages/app/investments/Flow'
import { AuditBoard as InvestmentAuditBoard, MessageBoard as InvestmentMessageBoard, ReportBoard as InvestmentReportBoard } from './pages/app/investments/Insights'
import { AccountLayout } from './pages/app/accounts/Layout'
import { AccountDashboard } from './pages/app/accounts/Dashboard'
import { AccountList, ApplicationForm as AccountApplicationForm, ApplicationList as AccountApplicationList } from './pages/app/accounts/Applications'
import { AccountFilePage } from './pages/app/accounts/File'
import { AccountAuditBoard, AccountMessageBoard, AccountReportBoard } from './pages/app/accounts/Insights'
import { LiteracyLayout } from './pages/app/literacy/Layout'
import { LiteracyHome } from './pages/app/literacy/Dashboard'
import { StudyRoom } from './pages/app/literacy/Study'
import { ProgrammeForm, ProgrammeList } from './pages/app/literacy/Programmes'
import { CourseForm, CourseList } from './pages/app/literacy/Courses'
import { LearnerFilePage, LearnerForm, LearnerList } from './pages/app/literacy/Learners'
import { TrainingBoard } from './pages/app/literacy/Training'
import { PracticeBoard } from './pages/app/literacy/Practice'
import { LiteracyAuditBoard, LiteracyCertificateBoard, LiteracyMessageBoard, LiteracyReportBoard } from './pages/app/literacy/Insights'
import { EscrowLayout } from './pages/app/escrow/Layout'
import { EscrowDashboard } from './pages/app/escrow/Dashboard'
import { GroupFilePage, GroupForm, GroupList } from './pages/app/escrow/Groups'
import { AccountFilePage as EscrowAccountFile, AccountForm as EscrowAccountForm, AccountList as EscrowAccountList } from './pages/app/escrow/Accounts'
import { CollateralFilePage, CollateralForm, CollateralList } from './pages/app/escrow/Collateral'
import { ApplicationFilePage as EscrowApplicationFile, ApplicationForm as EscrowApplicationForm, ApplicationList as EscrowApplicationList, ClaimFilePage, FacilityList, GuaranteeFilePage, GuaranteeList } from './pages/app/escrow/Cover'
import { AuditBoard as EscrowAuditBoard, DocumentBoard, NoticeBoard, ReconciliationBoard, ReportBoard as EscrowReportBoard } from './pages/app/escrow/Insights'
import { RegistrationBoard } from './pages/app/RegistrationBoard'
import { RegistrationFile } from './pages/app/RegistrationFile'
import { RegistrationForm } from './pages/app/RegistrationForm'
import { ReportsBoard } from './pages/app/ReportsBoard'
import { SchoolDossier } from './pages/app/SchoolDossier'
import { SchoolsBoard } from './pages/app/SchoolsBoard'
import { StudentFile } from './pages/app/StudentFile'
import { StudentRegister } from './pages/app/StudentRegister'
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
        <Route path="/app/registration" element={<RequireAuth permission="school.read"><RegistrationBoard /></RequireAuth>} />
        <Route path="/app/registration/new/:kind" element={<RequireAuth permission="school.write"><RegistrationForm /></RequireAuth>} />
        <Route path="/app/registration/:registrationId" element={<RequireAuth permission="school.read"><RegistrationFile /></RequireAuth>} />
        <Route path="/app/schools" element={<RequireAuth permission="school.read"><SchoolsBoard /></RequireAuth>} />
        <Route path="/app/membership" element={<RequireAuth permission="school.read"><MembershipLayout /></RequireAuth>}>
          <Route index element={<MembershipDashboard />} />
          <Route path="members" element={<MemberList />} />
          <Route path="members/new" element={<RequireAuth permission="school.write"><MemberForm /></RequireAuth>} />
          <Route path="members/:memberId" element={<MemberFilePage />} />
          <Route path="categories" element={<CategoryBoard />} />
          <Route path="reports" element={<MembershipReportBoard />} />
          <Route path="notices" element={<MembershipNoticeBoard />} />
          <Route path="audit" element={<MembershipAuditBoard />} />
          <Route path="requests" element={<MembershipBoard />} />
        </Route>
        <Route path="/app/schools/:schoolId" element={<RequireAuth permission="school.read"><SchoolDossier /></RequireAuth>} />
        <Route path="/app/students" element={<RequireAuth permission="student.read"><StudentsBoard /></RequireAuth>} />
        <Route path="/app/students/new" element={<RequireAuth permission="student.write"><StudentRegister /></RequireAuth>} />
        <Route path="/app/students/:studentId" element={<RequireAuth permission="student.read"><StudentFile /></RequireAuth>} />
        <Route path="/app/invoices" element={<RequireAuth permission="invoice.read"><InvoicesBoard /></RequireAuth>} />
        <Route path="/app/payments" element={<RequireAuth permission="payment.read"><PaymentsBoard /></RequireAuth>} />
        <Route path="/app/loans" element={<RequireAuth permission="loan.read"><LendingLayout /></RequireAuth>}>
          <Route index element={<LendingDashboard />} />
          <Route path="products" element={<ProductBoard />} />
          <Route path="applications" element={<LendingApplicationList />} />
          <Route path="applications/new" element={<RequireAuth permission="loan.write"><LendingApplicationForm /></RequireAuth>} />
          <Route path="applications/:applicationId" element={<LendingApplicationFile />} />
          <Route path="book" element={<LendingLoanList />} />
          <Route path="book/:loanId" element={<LendingLoanFile />} />
          <Route path="reports" element={<LendingReportBoard />} />
          <Route path="notices" element={<LendingNoticeBoard />} />
          <Route path="audit" element={<LendingAuditBoard />} />
        </Route>
        <Route path="/app/guarantees" element={<RequireAuth permission="guarantee.read"><GuaranteesBoard /></RequireAuth>} />
        <Route path="/app/escrow" element={<RequireAuth permission="guarantee.read"><EscrowLayout /></RequireAuth>}>
          <Route index element={<EscrowDashboard />} />
          <Route path="groups" element={<GroupList />} />
          <Route path="groups/new" element={<RequireAuth permission="guarantee.write"><GroupForm /></RequireAuth>} />
          <Route path="groups/:groupId" element={<GroupFilePage />} />
          <Route path="accounts" element={<EscrowAccountList />} />
          <Route path="accounts/new" element={<RequireAuth permission="guarantee.write"><EscrowAccountForm /></RequireAuth>} />
          <Route path="accounts/:accountId" element={<EscrowAccountFile />} />
          <Route path="collateral" element={<CollateralList />} />
          <Route path="collateral/new" element={<RequireAuth permission="guarantee.write"><CollateralForm /></RequireAuth>} />
          <Route path="collateral/:assetId" element={<CollateralFilePage />} />
          <Route path="facilities" element={<FacilityList />} />
          <Route path="applications" element={<EscrowApplicationList />} />
          <Route path="applications/new" element={<RequireAuth permission="guarantee.write"><EscrowApplicationForm /></RequireAuth>} />
          <Route path="applications/:applicationId" element={<EscrowApplicationFile />} />
          <Route path="guarantees" element={<GuaranteeList />} />
          <Route path="guarantees/:guaranteeId" element={<GuaranteeFilePage />} />
          <Route path="claims/:claimId" element={<ClaimFilePage />} />
          <Route path="reports" element={<EscrowReportBoard />} />
          <Route path="reconciliation" element={<ReconciliationBoard />} />
          <Route path="documents" element={<DocumentBoard />} />
          <Route path="notices" element={<NoticeBoard />} />
          <Route path="audit" element={<EscrowAuditBoard />} />
        </Route>
        <Route path="/app/reports" element={<RequireAuth permission="report.read"><ReportsBoard /></RequireAuth>} />
        <Route path="/app/donations" element={<RequireAuth permission="donation.read"><DonationLayout /></RequireAuth>}>
          <Route index element={<DonationDashboard />} />
          <Route path="donors" element={<DonorList />} />
          <Route path="donors/new" element={<RequireAuth permission="donation.write"><DonorForm /></RequireAuth>} />
          <Route path="donors/:donorId" element={<DonorFile />} />
          <Route path="campaigns" element={<CampaignList />} />
          <Route path="campaigns/new" element={<RequireAuth permission="donation.write"><CampaignForm /></RequireAuth>} />
          <Route path="campaigns/:campaignId" element={<CampaignFile />} />
          <Route path="pledges" element={<PledgeBoard />} />
          <Route path="gifts" element={<GiftList />} />
          <Route path="gifts/new" element={<RequireAuth permission="donation.write"><GiftForm /></RequireAuth>} />
          <Route path="gifts/:giftId" element={<GiftFile />} />
          <Route path="payments" element={<PaymentBoard />} />
          <Route path="beneficiaries" element={<BeneficiaryList />} />
          <Route path="beneficiaries/new" element={<RequireAuth permission="donation.write"><BeneficiaryForm /></RequireAuth>} />
          <Route path="beneficiaries/:beneficiaryId" element={<BeneficiaryFile />} />
          <Route path="allocations" element={<AllocationBoard />} />
          <Route path="distributions" element={<DistributionBoard />} />
          <Route path="receipts" element={<ReceiptBoard />} />
          <Route path="impact" element={<ImpactBoard />} />
          <Route path="messages" element={<MessageBoard />} />
          <Route path="reports" element={<ReportBoard />} />
          <Route path="audit" element={<AuditBoard />} />
        </Route>
        <Route path="/app/investments" element={<RequireAuth permission="investment.read"><InvestmentLayout /></RequireAuth>}>
          <Route index element={<InvestmentDashboard />} />
          <Route path="opportunities" element={<OpportunityList />} />
          <Route path="opportunities/new" element={<RequireAuth permission="investment.write"><OpportunityForm /></RequireAuth>} />
          <Route path="opportunities/:opportunityId" element={<OpportunityFile />} />
          <Route path="applications" element={<ApplicationList />} />
          <Route path="applications/new" element={<RequireAuth permission="investment.write"><ApplicationForm /></RequireAuth>} />
          <Route path="applications/:applicationId" element={<ApplicationFile />} />
          <Route path="positions" element={<PositionList />} />
          <Route path="positions/:positionId" element={<PositionFile />} />
          <Route path="portfolio" element={<PortfolioBoard />} />
          <Route path="returns" element={<ReturnBoard />} />
          <Route path="exits" element={<ExitBoard />} />
          <Route path="maturity" element={<MaturityBoard />} />
          <Route path="reports" element={<InvestmentReportBoard />} />
          <Route path="messages" element={<InvestmentMessageBoard />} />
          <Route path="audit" element={<InvestmentAuditBoard />} />
        </Route>
        <Route path="/app/accounts" element={<RequireAuth permission="account.read"><AccountLayout /></RequireAuth>}>
          <Route index element={<AccountDashboard />} />
          <Route path="applications" element={<AccountApplicationList />} />
          <Route path="applications/new" element={<RequireAuth permission="account.write"><AccountApplicationForm /></RequireAuth>} />
          <Route path="applications/:accountId" element={<AccountFilePage />} />
          <Route path="register" element={<AccountList />} />
          <Route path="reports" element={<AccountReportBoard />} />
          <Route path="messages" element={<AccountMessageBoard />} />
          <Route path="audit" element={<AccountAuditBoard />} />
        </Route>
        <Route path="/app/literacy" element={<RequireAuth permission="literacy.read"><LiteracyLayout /></RequireAuth>}>
          <Route index element={<LiteracyHome />} />
          <Route path="study" element={<StudyRoom />} />
          <Route path="study/:learnerId" element={<StudyRoom />} />
          <Route path="study/:learnerId/:enrollmentId" element={<StudyRoom />} />
          <Route path="programmes" element={<ProgrammeList />} />
          <Route path="programmes/new" element={<RequireAuth permission="literacy.write"><ProgrammeForm /></RequireAuth>} />
          <Route path="courses" element={<CourseList />} />
          <Route path="courses/new" element={<RequireAuth permission="literacy.write"><CourseForm /></RequireAuth>} />
          <Route path="learners" element={<LearnerList />} />
          <Route path="learners/new" element={<RequireAuth permission="literacy.write"><LearnerForm /></RequireAuth>} />
          <Route path="learners/:learnerId" element={<LearnerFilePage />} />
          <Route path="training" element={<TrainingBoard />} />
          <Route path="practice" element={<PracticeBoard />} />
          <Route path="certificates" element={<LiteracyCertificateBoard />} />
          <Route path="reports" element={<LiteracyReportBoard />} />
          <Route path="messages" element={<LiteracyMessageBoard />} />
          <Route path="audit" element={<LiteracyAuditBoard />} />
        </Route>
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
        <Route path="/membership/verify" element={<VerifyMembership />} />
        <Route path="/membership/verify/:code" element={<VerifyMembership />} />
        <Route path="/solutions/schools" element={<Schools />} />
        <Route path="/solutions/parents" element={<Parents />} />
        <Route path="/solutions/partners" element={<Partners />} />
        <Route path="/services" element={<OnlineServices />} />
        <Route path="/about" element={<About />} />
        <Route path="/brand" element={<Brand />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/training" element={<PublicTraining />} />
        <Route path="/training/:enrollmentId" element={<PublicTraining />} />
        <Route path="/developers" element={<Developers />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
