<template>
  <div class="toast toast-top toast-end z-[9999] p-4 flex flex-col items-end pointer-events-none max-w-full">
    <!-- Progress Operations -->
    <div v-for="op in ProgressManager.operations" :key="op.id" class="mb-2 w-[320px] max-w-full pointer-events-auto">
      <div class="bg-base-200 rounded-xl border border-line p-4">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <span v-if="op.status === 'processing'" class="loading loading-spinner loading-xs"></span>
            <span v-else class="dot" :class="op.status === 'completed' ? 'text-success' : 'text-error'"></span>
            <span class="text-[13px] font-medium text-fg truncate">{{ op.title }}</span>
          </div>
          <span class="num text-[12px] text-fg-2">{{ Math.round((op.current / op.total) * 100) }}%</span>
        </div>

        <div class="w-full bg-surface-2 rounded-full h-1 overflow-hidden">
          <div
            class="h-full"
            :class="{
              'bg-invert': op.status === 'processing',
              'bg-success': op.status === 'completed',
              'bg-error': op.status === 'error'
            }"
            :style="{ width: `${(op.current / op.total) * 100}%` }"
          ></div>
        </div>

        <div class="flex justify-between mt-2">
          <span class="micro num">{{ op.current }} / {{ op.total }} items</span>
          <span v-if="op.status === 'completed'" class="text-[12px] text-success">Done</span>
          <span v-else-if="op.status === 'error'" class="text-[12px] text-error">Failed</span>
        </div>
      </div>
    </div>

    <!-- Regular Notifications -->
    <div v-for="(notification, index) in ToastNotify.notifications" :key="index" class="mb-2 pointer-events-auto max-w-full">
      <div class="flex items-center gap-3 bg-base-200 border border-line rounded-xl py-3 px-4 min-w-[280px] max-w-[360px]" role="status">
        <span class="dot" :class="dotMap[notification.type] || 'text-fg-3'"></span>
        <span class="sr-only">{{ labelMap[notification.type] }}:</span>
        <span class="text-[13px] text-fg flex-1">{{ notification.content }}</span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {ToastNotify} from "~/core/notificationManager";
import {ProgressManager} from "~/core/progressManager";
import {NotificationType} from "~/types/Notification";

const dotMap = {
  [NotificationType.INFO]: "text-fg-2",
  [NotificationType.SUCCESS]: "text-success",
  [NotificationType.ERROR]: "text-error",
  [NotificationType.WARNING]: "text-warning",
};

const labelMap = {
  [NotificationType.INFO]: "Info",
  [NotificationType.SUCCESS]: "Success",
  [NotificationType.ERROR]: "Error",
  [NotificationType.WARNING]: "Warning",
};
</script>
