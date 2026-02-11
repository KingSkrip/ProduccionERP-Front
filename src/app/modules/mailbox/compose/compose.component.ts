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

  composeForm: UntypedFormGroup;
  users: SimpleUser[] = [];
  recentEmojis: string[] = [];
  paraSearch = '';
  ccSearch = '';
  bccSearch = '';
  private previewMap = new Map<string, string>();
  trackByFile = (_: number, f: File) => `${f.name}-${f.size}-${f.lastModified}`;
  filteredParaUsers: SimpleUser[] = [];
  filteredCcUsers: SimpleUser[] = [];
  filteredBccUsers: SimpleUser[] = [];
  copyFields: { cc: boolean; bcc: boolean } = { cc: false, bcc: false };
  usersById = new Map<number, SimpleUser>();
  quillModules: any = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ align: [] }, { list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  // readonly defaultAvatar = 'assets/images/avatars/default-avatar.png';

  paraFilterCtrl = new FormControl('');
  ccFilterCtrl = new FormControl('');
  bccFilterCtrl = new FormControl('');

  attachedFiles: File[] = [];
  quillEditor: any;
  private linkifyTimeout: any;

  // ========== EMOJIS ==========
  emojiSearch = '';
  selectedCategory = 'smileys';

  filteredEmojis: string[] = [];

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

    // Carga inicial de usuarios
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

    // ✅ CAMBIO: Configurar búsqueda remota que SIEMPRE hace petición al servidor
    this.setupRemoteSearch('para', this.paraFilterCtrl, (list) => (this.filteredParaUsers = list));
    this.setupRemoteSearch('cc', this.ccFilterCtrl, (list) => (this.filteredCcUsers = list));
    this.setupRemoteSearch('bcc', this.bccFilterCtrl, (list) => (this.filteredBccUsers = list));
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

  // ========== QUILL EDITOR ==========
  onEditorCreated(quill: any): void {
    this.quillEditor = quill;

    // ✅ Auto-linkify optimizado con debounce
    quill.on('text-change', () => {
      clearTimeout(this.linkifyTimeout);
      this.linkifyTimeout = setTimeout(() => {
        const text = quill.getText();
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex);

        if (matches) {
          matches.forEach((url: string) => {
            const index = text.indexOf(url);
            if (index !== -1) {
              const currentFormat = quill.getFormat(index, url.length);
              if (!currentFormat.link) {
                quill.formatText(index, url.length, 'link', url);
              }
            }
          });
        }
      }, 300);
    });

    quill.root.addEventListener('click', (ev: MouseEvent) => {
      const el = ev.target as HTMLElement;

      if (el?.classList?.contains('ql-img-remove')) {
        ev.preventDefault();
        ev.stopPropagation();

        const wrapper = el.closest('.ql-img-wrap') as HTMLElement | null;
        if (!wrapper) return;

        const blot = Quill.find(wrapper);
        if (!blot) return;

        const index = quill.getIndex(blot);
        quill.deleteText(index, 1, 'user');

        this._snackBar.open('Imagen eliminada', 'OK', { duration: 1200 });
      }
    });
  }

  // ========== FUNCIONES DE BOTONES ==========

  attachFile(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.attachedFiles.push(...files);

      const fileNames = files.map((f) => f.name).join(', ');
      this._snackBar.open(`Archivo(s) adjunto(s): ${fileNames}`, 'OK', {
        duration: 3000,
      });

  
    }
    input.value = '';
  }

  insertLink(): void {
    if (!this.quillEditor) return;

    const range = this.quillEditor.getSelection();
    if (!range) {
      this._snackBar.open('Selecciona el texto donde quieres insertar el enlace', 'OK', {
        duration: 2000,
      });
      return;
    }

    const url = prompt('Ingresa la URL:');
    if (url) {
      this.quillEditor.formatText(range.index, range.length, 'link', url);
      this._snackBar.open('Enlace insertado', 'OK', { duration: 2000 });
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && this.quillEditor) {
      const files = Array.from(input.files);

      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const base64Image = e.target.result;
          const range = this.quillEditor.getSelection(true);

          this.quillEditor.insertEmbed(range.index, 'imageWithDelete', base64Image, 'user');
          this.quillEditor.setSelection(range.index + 1, 0);
        };
        reader.readAsDataURL(file);
      });

      this._snackBar.open('Imagen(es) insertada(s)', 'OK', { duration: 2000 });
    }
    input.value = '';
  }

  // ========== RESTO DE FUNCIONES ==========

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

  // ✅ SOLUCIÓN: Nueva función que SIEMPRE hace petición al servidor
  private setupRemoteSearch(
    controlName: 'para' | 'cc' | 'bcc',
    filterCtrl: FormControl,
    setFiltered: (list: SimpleUser[]) => void,
  ) {
    filterCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        // ✅ SIEMPRE hace petición, incluso si el valor está vacío
        switchMap((v) => {
          const query = (v || '').trim();
          // Hacer petición al servidor con el término de búsqueda actual
          return this._mailboxService.getAllUsers(query, 200);
        }),
        tap((res) => this.upsertUsers(res || [])),
      )
      .subscribe({
        next: (res) => {
          // Combinar resultados del servidor con usuarios ya seleccionados
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

  // onImgError(ev: Event): void {
  //   const img = ev.target as HTMLImageElement;
  //   img.src = this.defaultAvatar;
  // }

  removeFrom(controlName: 'para' | 'cc' | 'bcc', id: number, ev?: MouseEvent): void {
    ev?.stopPropagation();
    const ctrl = this.composeForm.get(controlName);
    const arr: number[] = Array.isArray(ctrl?.value) ? ctrl?.value : [];
    ctrl?.setValue(arr.filter((x) => x !== id));
  }

  private uniq(nums: number[]): number[] {
    return Array.from(new Set(nums.filter((n) => Number.isFinite(n))));
  }

  enviar(): void {
    if (this.composeForm.invalid) {
      this.composeForm.markAllAsTouched();
      return;
    }

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
      next: (res) => this.matDialogRef.close(res),
      error: (err) => console.error(err),
    });
  }

  BorradorAndClose(): void {
    const de_id = 1;

    // 👇 MISMO CÓDIGO QUE EN enviar() para construir participants
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
      participants: participants.length ? participants : undefined, // 👈 AHORA SÍ SE ENVÍAN
    };

    this._mailboxService.createDraft(payload, this.attachedFiles).subscribe({
      next: (res) => {
        this._snackBar.open('Borrador guardado', 'OK', { duration: 2000 });
        this.matDialogRef.close(res);
      },
      error: (err) => {
        console.error('❌ Error guardando borrador:', err);
        this._snackBar.open('No se pudo guardar el borrador', 'OK', { duration: 2500 });
      },
    });
  }

  Cancelar(): void {
    this.matDialogRef.close(null);
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

  isDragging = false;

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

    const names = incoming.map((f) => f.name).join(', ');
    this._snackBar.open(`Adjunto(s): ${names}`, 'OK', { duration: 2500 });
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
}
