import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { APP_CONFIG } from 'app/core/config/app-config';
import { QuillEditorComponent } from 'ngx-quill';
import { MailboxService, SimpleUser } from '../mailbox.service';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';

@Component({
  selector: 'mailbox-compose',
  templateUrl: './compose.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    QuillEditorComponent,
      NgxMatSelectSearchModule
  ],
})
export class MailboxComposeComponent implements OnInit {
  composeForm: UntypedFormGroup;

  users: SimpleUser[] = [];

  paraSearch = '';
  ccSearch = '';
  bccSearch = '';

  filteredParaUsers: SimpleUser[] = [];
  filteredCcUsers: SimpleUser[] = [];
  filteredBccUsers: SimpleUser[] = [];
  copyFields: { cc: boolean; bcc: boolean } = { cc: false, bcc: false };

  quillModules: any = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ align: [] }, { list: 'ordered' }, { list: 'bullet' }],
      ['clean'],
    ],
  };

  readonly defaultAvatar = 'assets/images/avatars/default-avatar.png';

  paraFilterCtrl = new FormControl('');
ccFilterCtrl   = new FormControl('');
bccFilterCtrl  = new FormControl('');


  constructor(
    public matDialogRef: MatDialogRef<MailboxComposeComponent>,
    private _formBuilder: UntypedFormBuilder,
    private _mailboxService: MailboxService,
  ) {}

  ngOnInit(): void {
    this.composeForm = this._formBuilder.group({
      para: [[], [Validators.required]],
      cc: [[]],
      bcc: [[]],
      Asunto: ['', [Validators.required]],
      body: ['', [Validators.required]],
    });

   this._mailboxService.getAllUsers('', 200).subscribe({
    next: (res) => {
      this.users = res || [];
      this.applyFilters();
    },
    error: console.error
  });

  this.paraFilterCtrl.valueChanges.subscribe(v => {
    this.paraSearch = v || '';
    this.applyFilters();
  });

  this.ccFilterCtrl.valueChanges.subscribe(v => {
    this.ccSearch = v || '';
    this.applyFilters();
  });

  this.bccFilterCtrl.valueChanges.subscribe(v => {
    this.bccSearch = v || '';
    this.applyFilters();
  });



  }

  showCopyField(name: string): void {
    if (name !== 'cc' && name !== 'bcc') return;
    this.copyFields[name] = true;
  }

  getUserById(id: number | null | undefined): SimpleUser | undefined {
    if (!id) return undefined;
    return this.users.find((u) => u.id === id);
  }

  userPhoto(u?: SimpleUser | null): string {
    const p = (u?.photo || '').trim();
    if (!p) return this.defaultAvatar;

    if (p.startsWith('http://') || p.startsWith('https://')) return p;

    const base = (APP_CONFIG.apiBase || '').replace(/\/$/, '');
    const path = p.startsWith('/') ? p : `/${p}`;
    return `${base}${path}`;
  }

  onImgError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    img.src = this.defaultAvatar;
  }

  // quita un id de un control array (para chips)
  removeFrom(controlName: 'para' | 'cc' | 'bcc', id: number, ev?: MouseEvent): void {
    ev?.stopPropagation();
    const ctrl = this.composeForm.get(controlName);
    const arr: number[] = Array.isArray(ctrl?.value) ? ctrl?.value : [];
    ctrl?.setValue(arr.filter((x) => x !== id));
  }

  private uniq(nums: number[]): number[] {
    return Array.from(new Set(nums.filter((n) => Number.isFinite(n))));
  }

  send(): void {
    if (this.composeForm.invalid) {
      this.composeForm.markAllAsTouched();
      return;
    }

    const de_id = 1; // TODO: del usuario logueado

    const paraIds: number[] = this.uniq(this.composeForm.value.para || []);
    const ccIds: number[] = this.uniq(this.composeForm.value.cc || []);
    const bccIds: number[] = this.uniq(this.composeForm.value.bcc || []);

    // compatibilidad: para_id “principal”
    const para_id = paraIds.length ? paraIds[0] : null;

    // evita duplicados entre listas (prioridad: Para > Cc > Bcc)
    const paraSet = new Set(paraIds);
    const ccClean = ccIds.filter((id) => !paraSet.has(id));
    const ccSet = new Set(ccClean);
    const bccClean = bccIds.filter((id) => !paraSet.has(id) && !ccSet.has(id));

    // “Para” extra (aparte del principal) como role 'to'
    const paraExtras = paraIds.slice(1).map((id, idx) => ({
      user_id: id,
      role: 'to',
      orden: idx + 1,
    }));

    const participants = [
      ...paraExtras,
      ...ccClean.map((id, idx) => ({ user_id: id, role: 'watcher', orden: idx + 1 })),
      ...bccClean.map((id, idx) => ({ user_id: id, role: 'watcher', orden: idx + 1 })),
    ];

    const payload = {
      de_id,
      para_id, // si tu backend luego acepta array, lo cambiamos a para_ids
      status_id: 1,
      titulo: this.composeForm.value.Asunto,
      descripcion: this.composeForm.value.body,
      participants: participants.length ? participants : undefined,
    };

    this._mailboxService.createTask(payload).subscribe({
      next: (res) => this.matDialogRef.close(res),
      error: (err) => console.error(err),
    });
  }

  saveAsDraft(): void {}

  enviar(): void {
    this.send();
  }

  Cancelar(): void {
    this.discard();
  }

  discard(): void {
    this.matDialogRef.close(null);
  }

  saveAndClose(): void {
    this.saveAsDraft();
    this.matDialogRef.close();
  }

  private matchUser(u: SimpleUser, q: string): boolean {
    const s = (q || '').trim().toLowerCase();
    if (!s) return true;

    const nombre = (u.nombre || '').toLowerCase();
    const correo = (u.correo || '').toLowerCase();
    return nombre.includes(s) || correo.includes(s);
  }

  applyFilters(): void {
    this.filteredParaUsers = this.users.filter((u) => this.matchUser(u, this.paraSearch));
    this.filteredCcUsers = this.users.filter((u) => this.matchUser(u, this.ccSearch));
    this.filteredBccUsers = this.users.filter((u) => this.matchUser(u, this.bccSearch));
  }

  onSearchChange(which: 'para' | 'cc' | 'bcc', value: string): void {
    if (which === 'para') this.paraSearch = value;
    if (which === 'cc') this.ccSearch = value;
    if (which === 'bcc') this.bccSearch = value;
    this.applyFilters();
  }

  clearSearch(which: 'para' | 'cc' | 'bcc', ev?: MouseEvent): void {
    ev?.stopPropagation();
    this.onSearchChange(which, '');
  }
}
