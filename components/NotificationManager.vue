<template>
  <div class="toast toast-top toast-end z-[9999]">
    <div v-for="(notification, index) in ToastNotify.notifications" :key="index">
      <div class="alert shadow-lg" :class="classMap[notification.type] || 'bg-gray-500 text-white'">
        <div class="flex items-center gap-2">
          <Icon v-if="notification.type === NotificationType.SUCCESS" name="mdi:check-circle" class="w-5 h-5" />
          <Icon v-if="notification.type === NotificationType.ERROR" name="mdi:alert-circle" class="w-5 h-5" />
          <Icon v-if="notification.type === NotificationType.WARNING" name="mdi:alert" class="w-5 h-5" />
          <Icon v-if="notification.type === NotificationType.INFO" name="mdi:information" class="w-5 h-5" />
          <span>{{notification.content}}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {ToastNotify} from "~/core/notificationManager";
import {NotificationType} from "~/types/Notification";



const classMap = {
  [NotificationType.INFO]: "alert-info",
  [NotificationType.SUCCESS]: "alert-success",
  [NotificationType.ERROR]: "alert-error",
  [NotificationType.WARNING]: "alert-warning",
};

</script>