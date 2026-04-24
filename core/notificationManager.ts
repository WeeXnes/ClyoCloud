import { reactive } from 'vue'
import type { Notification } from "~/types/Notification";
import { NotificationType } from "~/types/Notification";

export const ToastNotify = reactive({
    notifications: [] as Notification[],
})

export const createNotification = async (message: string, type: NotificationType = NotificationType.INFO) => {
    const newNotification: Notification = {
        content: message,
        type: type
    }
    ToastNotify.notifications.push(newNotification)

    setTimeout(() => {
        ToastNotify.notifications.splice(ToastNotify.notifications.indexOf(newNotification), 1);
    }, 5000);
}