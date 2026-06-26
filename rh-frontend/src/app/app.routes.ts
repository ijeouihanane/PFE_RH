import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { guestGuard } from './core/guest.guard';
import { roleGuard } from './core/role.guard';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './pages/login.component';
import { ChangePasswordComponent } from './pages/change-password.component';
import { DashboardComponent } from './pages/dashboard.component';
import { EmployeesComponent } from './pages/employees.component';
import { AccountsComponent } from './pages/accounts.component';
import { AnnouncementsComponent } from './pages/announcements.component';
import { DocumentsComponent } from './pages/documents.component';
import { ProjectsComponent } from './pages/projects-page.component';
import { PayrollComponent } from './pages/payroll.component';
import { ExpensesComponent } from './pages/expenses.component';
import { MyPayrollComponent } from './pages/my-payroll.component';
import { AppraisalsComponent } from './pages/appraisals.component';
import { AppraisalsViewComponent } from './pages/appraisals-view.component';
import { MyAppraisalsComponent } from './pages/my-appraisals.component';
import { AiDocsComponent } from './pages/ai-docs.component';
import { ChatbotComponent } from './pages/chatbot.component';
import { ContractsListComponent } from './pages/contracts/contracts-list.component';
import { ContractsFormComponent } from './pages/contracts/contracts-form.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'change-password', component: ChangePasswordComponent, canActivate: [authGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'employees', component: EmployeesComponent, canActivate: [roleGuard(['RH'])] },
      { path: 'accounts', component: AccountsComponent, canActivate: [roleGuard(['ADMIN'])] },
      {
        path: 'leaves',
        loadComponent: () => import('./pages/leaves.component').then((m) => m.LeavesComponent),
        canActivate: [roleGuard(['EMPLOYEE', 'MANAGER'])],
      },
      {
        path: 'leaves/manage',
        loadComponent: () => import('./pages/leaves-manage.component').then((m) => m.LeavesManageComponent),
        canActivate: [roleGuard(['RH'])],
      },
      { path: 'documents', component: DocumentsComponent, canActivate: [roleGuard(['RH', 'EMPLOYEE', 'MANAGER'])] },
      { path: 'announcements', component: AnnouncementsComponent, canActivate: [roleGuard(['RH', 'EMPLOYEE', 'MANAGER'])] },
      { path: 'contracts', component: ContractsListComponent, canActivate: [roleGuard(['RH'])] },
      { path: 'contracts/:id', component: ContractsFormComponent, canActivate: [roleGuard(['RH'])] },
      {
        path: 'timesheet',
        loadComponent: () => import('./pages/timesheet.component').then((m) => m.TimesheetComponent),
        canActivate: [roleGuard(['RH', 'EMPLOYEE', 'MANAGER'])],
      },
      { path: 'projects', component: ProjectsComponent, canActivate: [roleGuard(['MANAGER'])] },
      { path: 'payroll', component: PayrollComponent, canActivate: [roleGuard(['RH'])] },
      { path: 'expenses', component: ExpensesComponent, canActivate: [roleGuard(['RH'])] },
      {
        path: 'my-expense-claims',
        loadComponent: () => import('./pages/my-expense-claims.component').then((m) => m.MyExpenseClaimsComponent),
        canActivate: [roleGuard(['EMPLOYEE', 'MANAGER'])],
      },
      {
        path: 'expense-claims',
        loadComponent: () => import('./pages/rh-expense-claims.component').then((m) => m.RhExpenseClaimsComponent),
        canActivate: [roleGuard(['RH'])],
      },
      { path: 'my-payroll', component: MyPayrollComponent, canActivate: [roleGuard(['EMPLOYEE', 'MANAGER'])] },
      { path: 'appraisals/me', component: MyAppraisalsComponent, canActivate: [roleGuard(['EMPLOYEE', 'MANAGER'])] },
      { path: 'appraisals/view', component: AppraisalsViewComponent, canActivate: [roleGuard(['RH'])] },
      { path: 'appraisals', component: AppraisalsComponent, canActivate: [roleGuard(['MANAGER'])] },
      { path: 'ai-docs', component: AiDocsComponent, canActivate: [roleGuard(['RH'])] },
      { path: 'chatbot', component: ChatbotComponent, canActivate: [roleGuard(['RH', 'EMPLOYEE', 'MANAGER'])] },
      {
        path: 'messaging',
        loadComponent: () => import('./pages/messaging.component').then((m) => m.MessagingComponent),
        canActivate: [roleGuard(['RH', 'EMPLOYEE', 'MANAGER'])],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
