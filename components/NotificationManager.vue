<template>
  <div class="toast toast-top toast-start">
    <div v-for="notification in ToastNotify.notifications">
      <div class="alert" :class="classMap[notification.type] || 'bg-gray-500 text-white'">
        <span>{{notification.content}}</span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {ToastNotify} from "~/core/notificationManager";
import {NotificationType} from "~/types/Notification";



const classMap = {
  [NotificationType.INFO]: "bg-blue-500 text-white",
  [NotificationType.SUCCESS]: "bg-green-500 text-white",
  [NotificationType.ERROR]: "bg-red-500 text-white",
  [NotificationType.WARNING]: "bg-yellow-500 text-black",
};

</script>