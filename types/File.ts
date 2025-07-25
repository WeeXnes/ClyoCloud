export interface File {
    name: string;
    size: number;
    type: string;
    meta: FileMeta;
    lastModified: number;
    isFolder: boolean;
}

export interface FileMeta {
    tags: Tag[];
}

export interface Tag {
    name: string;
    color: string;
}