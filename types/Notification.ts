export enum NotificationType {
    INFO = "info",
    SUCCESS = "success",
    ERROR = "error",
    WARNING = "warning",
}


export interface Notification {
    content: string;
    type: NotificationType;
}

