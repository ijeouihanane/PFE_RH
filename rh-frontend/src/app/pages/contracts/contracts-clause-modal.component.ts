import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';

@Component({
  standalone: true,
  selector: 'app-contracts-clause-modal',
  imports: [CommonModule, FormsModule, QuillModule],
  styles: [`
    /* Overlay */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 1200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    /* Modal container — never exceeds viewport */
    .modal {
      background: white;
      border-radius: 10px;
      width: 720px;
      max-width: 92vw;
      max-height: calc(100vh - 48px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    }

    /* Header — always visible, never scrolls */
    .modal-head {
      flex-shrink: 0;
      padding: 18px 24px 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    .modal-head h4 {
      margin: 0 0 4px;
      font-size: 15px;
      font-weight: 700;
      color: #111827;
    }
    .modal-head .hint {
      margin: 0;
      font-size: 12px;
      color: #6b7280;
    }

    /* Body — takes remaining height, never overflows */
    .modal-body {
      flex: 1;
      min-height: 0;
      padding: 16px 24px 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* Footer — always visible at bottom */
    .modal-foot {
      flex-shrink: 0;
      padding: 14px 24px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: white;
    }
    .btn-cancel {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 22px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
    }
    .btn-cancel:hover { background: #f9fafb; }

    .btn-apply {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 22px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-apply:hover { background: #1d4ed8; }

    /*
     * Quill overrides — scoped to this component.
     * quill.snow.css is loaded globally via angular.json,
     * so we only need to constrain layout here.
     */
    ::ng-deep .cq-wrap quill-editor {
      display: block;
      width: 100%;
    }
    /* Toolbar — keep it compact */
    ::ng-deep .cq-wrap .ql-toolbar.ql-snow {
      border: 1px solid #d1d5db;
      border-bottom: none;
      border-radius: 6px 6px 0 0;
      background: #f9fafb;
      padding: 6px 8px;
    }
    /* Editor container — fixed height so footer stays visible */
    ::ng-deep .cq-wrap .ql-container.ql-snow {
      border: 1px solid #d1d5db;
      border-top: none;
      border-radius: 0 0 6px 6px;
      height: 300px;
    }
    /* Editor content */
    ::ng-deep .cq-wrap .ql-editor {
      height: 100%;
      overflow-y: auto;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 14px;
      line-height: 1.55;
      color: #111827;
      padding: 12px 16px;
    }
    ::ng-deep .cq-wrap .ql-editor p  { margin-bottom: 6px; }
    ::ng-deep .cq-wrap .ql-editor ul,
    ::ng-deep .cq-wrap .ql-editor ol { margin: 4px 0 6px 20px; }
    ::ng-deep .cq-wrap .ql-editor li { margin-bottom: 3px; }
    /* Toolbar buttons — ensure real icons render (Snow CSS handles SVG) */
    ::ng-deep .cq-wrap .ql-toolbar button,
    ::ng-deep .cq-wrap .ql-toolbar .ql-picker { color: #374151; }
  `],
  template: `
    <div class="overlay" *ngIf="isOpen" (click)="onCancel()">
      <div class="modal" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="modal-head">
          <h4>Modifier — {{ clauseTitle }}</h4>
          <p class="hint">Les valeurs ont déjà été remplacées. Modifiez le texte comme dans un traitement de texte.</p>
        </div>

        <!-- Quill editor — no [styles] binding on quill-editor -->
        <div class="modal-body">
          <div class="cq-wrap">
            <quill-editor
              [(ngModel)]="localContent"
              [modules]="modules"
              theme="snow">
            </quill-editor>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-foot">
          <button class="btn-cancel" (click)="onCancel()">Annuler</button>
          <button class="btn-apply"  (click)="onApply()">Appliquer</button>
        </div>

      </div>
    </div>
  `
})
export class ContractsClauseModalComponent implements OnChanges {
  @Input() isOpen      = false;
  @Input() clauseTitle = '';
  @Input() content     = '';

  @Output() apply  = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  localContent = '';

  /** Toolbar: bold, italic, underline | bullet, ordered | align | clean */
  modules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'bullet' }, { list: 'ordered' }],
      [{ align: '' }, { align: 'center' }, { align: 'right' }],
      ['clean']
    ]
  };

  ngOnChanges(c: SimpleChanges) {
    if (c['content'] || c['isOpen']) {
      this.localContent = this.content;
    }
  }

  onApply()  { this.apply.emit(this.localContent); }
  onCancel() { this.cancel.emit(); }
}
