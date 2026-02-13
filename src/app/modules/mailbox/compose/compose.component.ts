import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
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
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { APP_CONFIG } from 'app/core/config/app-config';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import Quill from 'quill';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import {
  CreateTaskPayload,
  MailboxService,
  SimpleUser,
  TaskParticipantPayload,
} from '../mailbox.service';
const BlockEmbed: any = Quill.import('blots/block/embed');

@Component({
  selector: 'mailbox-compose',
  templateUrl: './compose.component.html',
  styleUrls: ['./compose.component.scss'],
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
    NgxMatSelectSearchModule,
    MatSnackBarModule,
    MatMenuModule,
  ],
})
export class MailboxComposeComponent implements OnInit {
  @ViewChild('fileInput') fileInput: any;
  isEnviando = false;
  isDragging = false;
  attachedFiles: File[] = [];
  isGuardandoBorrador = false;
  composeForm: UntypedFormGroup;
  filteredCcUsers: SimpleUser[] = [];
  ccFilterCtrl = new FormControl('');
  filteredBccUsers: SimpleUser[] = [];
  bccFilterCtrl = new FormControl('');
  paraFilterCtrl = new FormControl('');
  filteredParaUsers: SimpleUser[] = [];
  usersById = new Map<number, SimpleUser>();
  private previewMap = new Map<string, string>();
  copyFields: { cc: boolean; bcc: boolean } = { cc: false, bcc: false };

  constructor(
    public matDialogRef: MatDialogRef<MailboxComposeComponent>,
    private _formBuilder: UntypedFormBuilder,
    private _mailboxService: MailboxService,
    private _snackBar: MatSnackBar,
    private bo: BreakpointObserver,
  ) {}

  ngOnInit(): void {
    this.composeForm = this._formBuilder.group({
      para: [[], [Validators.required]],
      cc: [[]],
      bcc: [[]],
      Asunto: ['', [Validators.required]],
      body: ['', [Validators.required]],
    });
    this.setupRemoteSearch('para', this.paraFilterCtrl, (list) => (this.filteredParaUsers = list));
    this.setupRemoteSearch('cc', this.ccFilterCtrl, (list) => (this.filteredCcUsers = list));
    this.setupRemoteSearch('bcc', this.bccFilterCtrl, (list) => (this.filteredBccUsers = list));
    setTimeout(() => {
      this._mailboxService.getAllUsers('', 50).subscribe({
        next: (res) => {
          const base = res || [];
          this.upsertUsers(base);

          this.filteredParaUsers = this.mergeKeepingSelected('para', base);
          this.filteredCcUsers = this.mergeKeepingSelected('cc', base);
          this.filteredBccUsers = this.mergeKeepingSelected('bcc', base);
        },
        error: console.error,
      });
    }, 0);
  }

  ngOnDestroy(): void {
    for (const url of this.previewMap.values()) URL.revokeObjectURL(url);
    this.previewMap.clear();
  }

  onSelectChange(controlName: 'para' | 'cc' | 'bcc') {
    const current =
      controlName === 'para'
        ? this.filteredParaUsers
        : controlName === 'cc'
          ? this.filteredCcUsers
          : this.filteredBccUsers;

    const merged = this.mergeKeepingSelected(controlName, current || []);

    if (controlName === 'para') this.filteredParaUsers = merged;
    if (controlName === 'cc') this.filteredCcUsers = merged;
    if (controlName === 'bcc') this.filteredBccUsers = merged;
  }

  showCopyField(name: string): void {
    if (name !== 'cc' && name !== 'bcc') return;
    this.copyFields[name] = true;
  }

  private upsertUsers(list: SimpleUser[]) {
    (list || []).forEach((u) => this.usersById.set(u.id, u));
  }

  getUserById(id: number | null | undefined): SimpleUser | undefined {
    if (!id) return undefined;
    return this.usersById.get(id);
  }

  private mergeKeepingSelected(
    controlName: 'para' | 'cc' | 'bcc',
    results: SimpleUser[],
  ): SimpleUser[] {
    const selectedIds: number[] = this.composeForm.get(controlName)?.value || [];
    const selectedUsers = selectedIds
      .map((id) => this.getUserById(id))
      .filter(Boolean) as SimpleUser[];
    const selectedSet = new Set(selectedIds);
    const rest = (results || []).filter((u) => !selectedSet.has(u.id));
    const merged = [...selectedUsers, ...rest];
    this.upsertUsers(merged);

    return merged;
  }

  private setupRemoteSearch(
    controlName: 'para' | 'cc' | 'bcc',
    filterCtrl: FormControl,
    setFiltered: (list: SimpleUser[]) => void,
  ) {
    filterCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((v) => {
          const query = (v || '').trim();
          return this._mailboxService.getAllUsers(query, 200);
        }),
        tap((res) => this.upsertUsers(res || [])),
      )
      .subscribe({
        next: (res) => {
          const merged = this.mergeKeepingSelected(controlName, res || []);
          setFiltered(merged);
        },
        error: console.error,
      });
  }

  userPhoto(u?: SimpleUser | null): string {
    const p = (u?.photo || '').trim();

    if (p.startsWith('http://') || p.startsWith('https://')) return p;

    const base = (APP_CONFIG.apiBase || '').replace(/\/$/, '');
    const path = p.startsWith('/') ? p : `/${p}`;
    return `${base}${path}`;
  }

  removeFrom(controlName: 'para' | 'cc' | 'bcc', id: number, ev?: MouseEvent): void {
    ev?.stopPropagation();
    const ctrl = this.composeForm.get(controlName);
    const arr: number[] = Array.isArray(ctrl?.value) ? ctrl?.value : [];
    ctrl?.setValue(arr.filter((x) => x !== id));
  }

  private uniq(nums: number[]): number[] {
    return Array.from(new Set(nums.filter((n) => Number.isFinite(n))));
  }

  get isFormValid(): boolean {
    return this.composeForm.valid;
  }

  get isOperationInProgress(): boolean {
    return this.isEnviando || this.isGuardandoBorrador;
  }

  enviar(): void {
    if (this.composeForm.invalid) {
      this.composeForm.markAllAsTouched();
      this._snackBar.open('Por favor completa todos los campos obligatorios', 'OK', {
        duration: 2500,
      });
      return;
    }

    if (this.isEnviando) return;
    this.isEnviando = true;
    const de_id = 1;
    const paraIds: number[] = this.uniq(this.composeForm.value.para || []);
    const ccIds: number[] = this.uniq(this.composeForm.value.cc || []);
    const bccIds: number[] = this.uniq(this.composeForm.value.bcc || []);
    const paraSet = new Set(paraIds);
    const ccClean = ccIds.filter((id) => !paraSet.has(id));
    const ccSet = new Set(ccClean);
    const bccClean = bccIds.filter((id) => !paraSet.has(id) && !ccSet.has(id));
    const paraParticipants: TaskParticipantPayload[] = paraIds.map((id, idx) => ({
      user_id: id,
      role: 'receptor' as const,
      orden: idx + 1,
    }));

    const participants: TaskParticipantPayload[] = [
      ...paraParticipants,
      ...ccClean.map((id, idx) => ({
        user_id: id,
        role: 'cc' as const,
        orden: idx + 1,
      })),
      ...bccClean.map((id, idx) => ({
        user_id: id,
        role: 'bcc' as const,
        orden: idx + 1,
      })),
    ];

    const payload: CreateTaskPayload = {
      de_id,
      para_id: null,
      status_id: 1,
      titulo: this.composeForm.value.Asunto,
      descripcion: this.composeForm.value.body,
      participants: participants.length ? participants : undefined,
    };

    this._mailboxService.createTask(payload, this.attachedFiles).subscribe({
      next: (res) => {
        this._mailboxService.prependMail(res);
        this._snackBar.open('Mensaje enviado correctamente', 'OK', { duration: 2000 });
        this.matDialogRef.close(res);
      },
      error: (err) => {
        console.error('❌ Error enviando mensaje:', err);
        this._snackBar.open('Error al enviar el mensaje. Inténtalo de nuevo.', 'OK', {
          duration: 3000,
        });
        this.isEnviando = false;
      },
    });
  }

  BorradorAndClose(): void {
    if (this.composeForm.invalid) {
      this.composeForm.markAllAsTouched();
      this._snackBar.open('Por favor completa todos los campos obligatorios', 'OK', {
        duration: 2500,
      });
      return;
    }

    if (this.isGuardandoBorrador) return;
    this.isGuardandoBorrador = true;
    const de_id = 1;
    const paraIds: number[] = this.uniq(this.composeForm.value.para || []);
    const ccIds: number[] = this.uniq(this.composeForm.value.cc || []);
    const bccIds: number[] = this.uniq(this.composeForm.value.bcc || []);
    const paraSet = new Set(paraIds);
    const ccClean = ccIds.filter((id) => !paraSet.has(id));
    const ccSet = new Set(ccClean);
    const bccClean = bccIds.filter((id) => !paraSet.has(id) && !ccSet.has(id));

    const paraParticipants: TaskParticipantPayload[] = paraIds.map((id, idx) => ({
      user_id: id,
      role: 'receptor' as const,
      orden: idx + 1,
    }));

    const participants: TaskParticipantPayload[] = [
      ...paraParticipants,
      ...ccClean.map((id, idx) => ({
        user_id: id,
        role: 'cc' as const,
        orden: idx + 1,
      })),
      ...bccClean.map((id, idx) => ({
        user_id: id,
        role: 'bcc' as const,
        orden: idx + 1,
      })),
    ];

    const payload: CreateTaskPayload = {
      de_id,
      para_id: null,
      status_id: 1,
      titulo: this.composeForm.value.Asunto ?? '(Sin asunto)',
      descripcion: this.composeForm.value.body ?? '',
      participants: participants.length ? participants : undefined,
    };

    this._mailboxService.createDraft(payload, this.attachedFiles).subscribe({
      next: (res) => {
        this._snackBar.open('Borrador guardado', 'OK', { duration: 2000 });
        this._mailboxService.prependMail(res);
        this.matDialogRef.close(res);
      },
      error: (err) => {
        console.error('❌ Error guardando borrador:', err);
        this._snackBar.open('No se pudo guardar el borrador', 'OK', { duration: 2500 });
        this.isGuardandoBorrador = false;
      },
    });
  }

  Cancelar(): void {
    if (this.isOperationInProgress) {
      this._snackBar.open('Espera a que termine la operación actual', 'OK', { duration: 2000 });
      return;
    }
    this.matDialogRef.close(null);
  }

  attachAny(): void {
    this.fileInput.nativeElement.click();
  }

  onAnySelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragging = false;
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragging = false;

    const files = Array.from(ev.dataTransfer?.files || []);
    if (files.length) this.addFiles(files);
  }

  private addFiles(files: File[]): void {
    const existing = new Set(
      this.attachedFiles.map((f) => `${f.name}-${f.size}-${f.lastModified}`),
    );
    const incoming = files.filter((f) => !existing.has(`${f.name}-${f.size}-${f.lastModified}`));
    if (!incoming.length) return;
    this.attachedFiles.push(...incoming);
    const count = incoming.length;
    const message = count === 1 ? `Se adjuntó 1 archivo` : `Se adjuntaron ${count} archivos`;
    this._snackBar.open(message, 'OK', { duration: 2500 });
  }

  removeFile(file: File): void {
    const key = this.fileKey(file);

    const url = this.previewMap.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      this.previewMap.delete(key);
    }

    this.attachedFiles = this.attachedFiles.filter((f) => f !== file);
  }

  isImage(file: File): boolean {
    return (file.type || '').startsWith('image/');
  }

  private fileKey(f: File): string {
    return `${f.name}-${f.size}-${f.lastModified}`;
  }

  filePreviewUrl(file: File): string {
    const key = this.fileKey(file);

    if (!this.previewMap.has(key)) {
      this.previewMap.set(key, URL.createObjectURL(file));
    }

    return this.previewMap.get(key)!;
  }

  extOf(name: string): string {
    const parts = (name || '').split('.');
    return parts.length > 1 ? parts.pop()!.toUpperCase() : '';
  }

  prettySize(bytes: number): string {
    if (!bytes && bytes !== 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let val = bytes;
    let i = 0;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  onImgError(ev: Event): void {
    const img = ev.target as HTMLImageElement;

    // Obtener el elemento padre para encontrar el nombre del usuario
    const parentDiv = img.closest('.flex.items-center');
    const nameElement = parentDiv?.querySelector('.font-medium');
    const userName = nameElement?.textContent?.trim() || 'U';

    // Generar avatar con iniciales
    const initials = this.getInitials(userName);
    const color = this.stringToColor(userName);

    img.src = this.generateAvatarDataUrl(initials, color);
  }

  private getInitials(name: string): string {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  private stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    return `hsl(${hue}, 65%, 50%)`;
  }

  private generateAvatarDataUrl(initials: string, bgColor: string): string {
    const svg = `
      <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="20" fill="${bgColor}"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".35em" 
              font-family="Arial, sans-serif" font-size="16" 
              font-weight="bold" fill="white">${initials}</text>
      </svg>
    `;

    return 'data:image/svg+xml;base64,' + btoa(svg);
  }
}
