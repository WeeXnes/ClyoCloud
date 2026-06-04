<template>
  <div class="toast toast-top toast-end z-[9999] p-4">
    <div v-for="(notification, index) in ToastNotify.notifications" :key="index" class="animate-in slide-in-from-right-4 duration-300 mb-2">
      <div class="alert shadow-md py-3 px-4 border border-white/10 flex items-center gap-3 rounded-lg min-w-[280px]" :class="classMap[notification.type] || 'bg-gray-700 text-white'">
        <div class="flex items-center gap-3 w-full">
          <div class="shrink-0">
            <Icon v-if="notification.type === NotificationType.SUCCESS" name="mdi:check-circle" class="w-5 h-5 text-white" />
            <Icon v-if="notification.type === NotificationType.ERROR" name="mdi:alert-circle" class="w-5 h-5 text-white" />
            <Icon v-if="notification.type === NotificationType.WARNING" name="mdi:alert" class="w-5 h-5 text-white" />
            <Icon v-if="notification.type === NotificationType.INFO" name="mdi:information" class="w-5 h-5 text-white" />
          </div>
          <span class="text-xs font-bold uppercase tracking-wide flex-1">{{notification.content}}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {ToastNotify} from "~/core/notificationManager";
import {NotificationType} from "~/types/Notification";



const classMap = {
  [NotificationType.INFO]: "alert-info bg-primary border-primary/20 text-primary-content",
  [NotificationType.SUCCESS]: "alert-success bg-success border-success/20 text-white",
  [NotificationType.ERROR]: "alert-error bg-error border-error/20 text-white",
  [NotificationType.WARNING]: "alert-warning bg-warning border-warning/20 text-white",
};

</script>