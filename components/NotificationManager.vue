<template>
  <div class="toast toast-top toast-end z-[9999] p-4 flex flex-col items-end pointer-events-none">
    <!-- Progress Operations -->
    <div v-for="op in ProgressManager.operations" :key="op.id" class="animate-in slide-in-from-right-4 duration-300 mb-3 w-full max-w-[320px] pointer-events-auto">
      <div class="bg-base-100 shadow-2xl rounded-2xl border border-base-content/10 overflow-hidden">
        <div class="p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div v-if="op.status === 'processing'" class="loading loading-spinner loading-xs text-primary"></div>
              <Icon v-else-if="op.status === 'completed'" name="mdi:check-circle" class="w-4 h-4 text-success" />
              <Icon v-else-if="op.status === 'error'" name="mdi:alert-circle" class="w-4 h-4 text-error" />
              <span class="text-[10px] font-black uppercase tracking-widest text-base-content">{{ op.title }}</span>
            </div>
            <span class="text-[10px] font-black text-base-content/40">{{ Math.round((op.current / op.total) * 100) }}%</span>
          </div>
          
          <div class="w-full bg-base-200 rounded-full h-1.5 overflow-hidden">
            <div 
              class="h-full transition-all duration-300 ease-out" 
              :class="{
                'bg-primary': op.status === 'processing',
                'bg-success': op.status === 'completed',
                'bg-error': op.status === 'error'
              }"
              :style="{ width: `${(op.current / op.total) * 100}%` }"
            ></div>
          </div>
          
          <div class="flex justify-between mt-2">
            <span class="text-[9px] font-bold text-base-content/30 uppercase tracking-tighter">
              {{ op.current }} / {{ op.total }} items
            </span>
            <span v-if="op.status === 'completed'" class="text-[9px] font-bold text-success uppercase tracking-widest">Done</span>
            <span v-else-if="op.status === 'error'" class="text-[9px] font-bold text-error uppercase tracking-widest">Failed</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Regular Notifications -->
    <div v-for="(notification, index) in ToastNotify.notifications" :key="index" class="animate-in slide-in-from-right-4 duration-300 mb-2 pointer-events-auto">
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
import {ProgressManager} from "~/core/progressManager";
import {NotificationType} from "~/types/Notification";



const classMap = {
  [NotificationType.INFO]: "alert-info bg-primary border-primary/20 text-primary-content",
  [NotificationType.SUCCESS]: "alert-success bg-success border-success/20 text-white",
  [NotificationType.ERROR]: "alert-error bg-error border-error/20 text-white",
  [NotificationType.WARNING]: "alert-warning bg-warning border-warning/20 text-white",
};

</script>