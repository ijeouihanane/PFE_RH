import { Component } from '@angular/core';
import { LeavesComponent } from './leaves.component';

@Component({
  standalone: true,
  selector: 'app-leaves-manage',
  imports: [LeavesComponent],
  template: `<app-leaves></app-leaves>`,
})
export class LeavesManageComponent {}
