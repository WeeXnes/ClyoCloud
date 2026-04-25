<!-- pages/login.vue -->
<template>
  <div class="min-h-screen bg-base-200/50 flex flex-col font-sans" data-theme="onedev">
    <!-- Simple Header -->
    <header class="w-full py-6 px-8 flex justify-center sm:justify-start">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <img src="/clyo.png" class="w-6 h-6 object-contain" alt="Clyo Logo" />
        </div>
        <h1 class="font-black text-xl tracking-tight leading-none text-base-content">ClyoCloud</h1>
      </div>
    </header>

    <main class="flex-1 flex items-center justify-center p-4 sm:p-8">
      <div class="w-full max-w-[440px]">
        <!-- Login Card -->
        <div class="bg-base-100 rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-base-content/5 overflow-hidden transition-all duration-500 hover:shadow-primary/10">
          <div class="p-8 sm:p-12">
            <!-- Title -->
            <div class="mb-10 text-center sm:text-left">
              <h2 class="text-3xl font-black tracking-tight mb-2">Welcome Back</h2>
              <p class="text-sm font-bold text-base-content/40 uppercase tracking-widest">Sign in to your secure cloud</p>
            </div>

            <form @submit.prevent="login" class="space-y-6">
              <!-- Username -->
              <div class="form-control">
                <label class="label mb-1.5">
                  <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/50">Username</span>
                </label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-base-content/30 group-focus-within:text-primary transition-colors">
                    <Icon name="mdi:account-outline" class="w-5 h-5" />
                  </div>
                  <input
                    v-model="username"
                    type="text"
                    placeholder="Enter your username"
                    class="input input-bordered w-full pl-12 h-14 bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm rounded-2xl border-base-content/10"
                    required
                  />
                </div>
              </div>

              <!-- Password -->
              <div class="form-control">
                <label class="label mb-1.5 flex justify-between items-center">
                  <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/50">Password</span>
                </label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-base-content/30 group-focus-within:text-primary transition-colors">
                    <Icon name="mdi:lock-outline" class="w-5 h-5" />
                  </div>
                  <input
                    v-model="password"
                    type="password"
                    placeholder="••••••••"
                    class="input input-bordered w-full pl-12 h-14 bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm rounded-2xl border-base-content/10"
                    required
                  />
                </div>
              </div>

              <!-- Error Message -->
              <transition name="fade">
                <div v-if="error" class="alert alert-error py-3 rounded-xl text-xs font-bold shadow-lg shadow-error/10">
                  <Icon name="mdi:alert-circle" class="w-4 h-4" />
                  <span>{{ error }}</span>
                </div>
              </transition>

              <!-- Submit Button -->
              <div class="pt-4">
                <button 
                  type="submit" 
                  class="btn btn-primary btn-block h-14 rounded-2xl shadow-xl shadow-primary/25 gap-3" 
                  :disabled="isLoading"
                >
                  <span v-if="isLoading" class="loading loading-spinner loading-sm"></span>
                  <span v-else class="flex items-center gap-2">
                    <span class="font-black tracking-tight">Access Account</span>
                    <Icon name="mdi:arrow-right" class="w-5 h-5" />
                  </span>
                </button>
              </div>
            </form>

            <!-- Sign Up/Forgot Fallback -->
            <div class="mt-10 pt-8 border-t border-base-content/5 flex flex-col gap-4 text-center">
              <p class="text-[10px] font-bold text-base-content/30 uppercase tracking-[0.2em]">End-to-End Secure Storage</p>
            </div>
          </div>
        </div>
        
        <!-- Bottom Links -->
        <div class="mt-8 flex items-center justify-center gap-6 opacity-40">
           <a href="#" class="text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors">Privacy Policy</a>
           <div class="w-1 h-1 rounded-full bg-base-content/20"></div>
           <a href="#" class="text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors">Terms of Service</a>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createNotification } from "~/core/notificationManager";
import { NotificationType } from "~/types/Notification";

const username = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)
const router = useRouter()

const login = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const response: any = await $fetch('/api/login', {
      method: 'POST',
      body: {
        username: username.value,
        password: password.value,
      }
    });

    const token = response.token;
    const cookie = useCookie('token');
    cookie.value = token;
    createNotification("Logged in successfully", NotificationType.SUCCESS)
    router.push('/files');
  } catch (err: any) {
    error.value = err.data?.message || 'Invalid credentials'
    createNotification(error.value, NotificationType.ERROR)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
