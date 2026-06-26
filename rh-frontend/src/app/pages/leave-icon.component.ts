import { NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-icon',
  imports: [NgSwitch, NgSwitchCase, NgSwitchDefault],
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" [ngSwitch]="name">
      <ng-container *ngSwitchCase="'eye'"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></ng-container>
      <ng-container *ngSwitchCase="'check'"><path d="m20 6-11 11-5-5"/></ng-container>
      <ng-container *ngSwitchCase="'x'"><path d="M18 6 6 18M6 6l12 12"/></ng-container>
      <ng-container *ngSwitchCase="'plus'"><path d="M12 5v14M5 12h14"/></ng-container>
      <ng-container *ngSwitchCase="'calendar'"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></ng-container>
      <ng-container *ngSwitchCase="'refresh'"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></ng-container>
      <ng-container *ngSwitchCase="'users'"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></ng-container>
      <ng-container *ngSwitchCase="'file'"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></ng-container>
      <ng-container *ngSwitchCase="'clock'"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></ng-container>
      <ng-container *ngSwitchCase="'edit'"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></ng-container>
      <ng-container *ngSwitchCase="'search'"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></ng-container>
      <ng-container *ngSwitchDefault><circle cx="12" cy="12" r="9"/></ng-container>
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; width: 1em; height: 1em; align-items: center; justify-content: center; line-height: 0; vertical-align: middle; }
    svg { display: block; width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  `],
})
export class LeaveIconComponent {
  @Input() name = 'circle';
}
