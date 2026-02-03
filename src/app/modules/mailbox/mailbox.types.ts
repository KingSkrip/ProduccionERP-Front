export interface Mail {
    id?: string;
    type?: string;
    from?: {
        avatar?: string;
        contact?: string;
    };
    to?: string;
    cc?: string[];
    ccCount?: number;
    bcc?: string[];
    bccCount?: number;
    date?: string;
    Asunto?: string;
    content?: string;
    attachments?: {
        type?: string;
        name?: string;
        size?: number;
        preview?: string;
        downloadUrl?: string;
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
