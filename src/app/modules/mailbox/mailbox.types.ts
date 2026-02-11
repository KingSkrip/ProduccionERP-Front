export interface Mail {
  id?: string | number;
  type?: string;

  from?: {
    avatar?: string;
    contact?: string;
  };

  to?: string[]; // 👈 era string, pero tú usas array
  cc?: string[];
  ccCount?: number;
  bcc?: string[];
  bccCount?: number;

  date?: Date | string; // 👈 tú usas new Date()

  Asunto?: string;
  content?: string;

  attachments?: {
    id?: number;
    type?: string;
    name?: string;
    original_name?: string;
    size?: number;
    preview?: string;
    path?: string;
    downloadUrl?: string;
  }[];

  // 👇 AGREGAR ESTO
  replies?: any[];

  // 👇 AGREGAR ESTO
  mailbox_items?: {
    id?: number;
    is_starred?: boolean;
    is_important?: boolean;
    read_at?: string | null;
  }[];

  destacados?: boolean;
  importantes?: boolean;
  unread?: boolean;

  folder?: string;
  labels?: string[];
}

export interface MailCategory {
  type: 'folder' | 'filter' | 'label';
  name: string;
}

export interface MailFolder {
  id: string;
  title: string;
  slug: string;
  icon: string;
  count?: number;
}

export interface MailFilter {
  id: string;
  title: string;
  slug: string;
  icon: string;
}

export interface MailLabel {
  id: string;
  title: string;
  slug: string;
  color: string;
}
