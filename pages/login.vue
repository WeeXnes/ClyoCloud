<!-- pages/login.vue -->
<template>
  <div class="min-h-screen bg-base-200 font-sans flex flex-col">
    <!-- Simple Header -->
    <header class="w-full py-8 px-8 flex justify-center">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-sm">
          <img src="/clyo.png" class="w-6 h-6 object-contain" alt="Clyo Logo" />
        </div>
        <h1 class="font-bold text-xl tracking-tight leading-none text-base-content">ClyoCloud</h1>
      </div>
    </header>

    <main class="flex-1 flex items-center justify-center p-4 sm:p-8">
      <div class="w-full max-w-[400px]">
        <!-- Login Card -->
        <div class="bg-base-100 rounded-xl shadow-lg border border-base-content/10 overflow-hidden">
          <div class="p-8 sm:p-10">
            <!-- Title -->
            <div class="mb-8 text-center sm:text-left">
              <h2 class="text-2xl font-bold tracking-tight mb-1.5 text-base-content">{{ requires2fa ? 'Security Check' : 'Welcome Back' }}</h2>
              <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-0.5">
                {{ requires2fa ? 'Enter your verification code' : 'Sign in to your secure cloud' }}
              </p>
            </div>

            <form v-if="!requires2fa" @submit.prevent="login" class="space-y-5">
              <!-- Username -->
              <div class="form-control">
                <label class="label mb-1">
                  <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Username</span>
                </label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-base-content/30 group-focus-within:text-primary transition-colors">
                    <Icon name="mdi:account-outline" class="w-5 h-5" />
                  </div>
                  <input
                    v-model="username"
                    type="text"
                    placeholder="Enter username"
                    class="input input-bordered w-full pl-12 h-12 bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs rounded-lg border-base-content/10"
                    required
                  />
                </div>
              </div>

              <!-- Password -->
              <div class="form-control">
                <label class="label mb-1 flex justify-between items-center">
                  <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Password</span>
                </label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-base-content/30 group-focus-within:text-primary transition-colors">
                    <Icon name="mdi:lock-outline" class="w-5 h-5" />
                  </div>
                  <input
                    v-model="password"
                    type="password"
                    placeholder="••••••••"
                    class="input input-bordered w-full pl-12 h-12 bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs rounded-lg border-base-content/10"
                    required
                  />
                </div>
              </div>

              <!-- Error Message -->
              <transition name="fade">
                <div v-if="error" class="alert alert-error py-2.5 rounded-lg text-[10px] font-bold shadow-sm border-none text-white">
                  <Icon name="mdi:alert-circle" class="w-4 h-4" />
                  <span>{{ error }}</span>
                </div>
              </transition>

              <!-- Submit Button -->
              <div class="pt-4">
                <button 
                  type="submit" 
                  class="btn btn-primary btn-block h-12 rounded-lg shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest" 
                  :disabled="isLoading"
                >
                  <span v-if="isLoading" class="loading loading-spinner loading-xs"></span>
                  <span v-else class="flex items-center gap-2">
                    Access Account
                    <Icon name="mdi:chevron-right" class="w-4 h-4" />
                  </span>
                </button>
              </div>
            </form>

            <form v-else @submit.prevent="verify2fa" class="space-y-5">
              <!-- TOTP Code -->
              <div class="form-control">
                <label class="label mb-1">
                  <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">6-Digit Code</span>
                </label>
                <div class="relative group">
                  <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-base-content/30 group-focus-within:text-primary transition-colors">
                    <Icon name="mdi:numeric" class="w-5 h-5" />
                  </div>
                  <input
                    v-model="totpCode"
                    type="text"
                    placeholder="000 000"
                    class="input input-bordered w-full pl-12 h-12 bg-base-200/50 focus:bg-base-100 transition-all font-bold text-center text-lg tracking-[0.4em] rounded-lg border-base-content/10"
                    required
                    maxlength="6"
                    autofocus
                  />
                </div>
              </div>

              <!-- Error Message -->
              <transition name="fade">
                <div v-if="error" class="alert alert-error py-2.5 rounded-lg text-[10px] font-bold shadow-sm border-none text-white">
                  <Icon name="mdi:alert-circle" class="w-4 h-4" />
                  <span>{{ error }}</span>
                </div>
              </transition>

              <!-- Submit Button -->
              <div class="pt-4 flex flex-col gap-2">
                <button 
                  type="submit" 
                  class="btn btn-primary btn-block h-12 rounded-lg shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest" 
                  :disabled="isLoading"
                >
                  <span v-if="isLoading" class="loading loading-spinner loading-xs"></span>
                  <span v-else class="flex items-center gap-2">
                    Verify Identity
                    <Icon name="mdi:shield-check" class="w-4 h-4" />
                  </span>
                </button>
                <button 
                  type="button"
                  @click="requires2fa = false"
                  class="btn btn-ghost btn-block h-12 rounded-lg font-bold text-[10px] uppercase tracking-widest" 
                  :disabled="isLoading"
                >
                  Back to Login
                </button>
              </div>
            </form>

            <!-- Status Footer -->
            <div class="mt-8 pt-6 border-t border-base-content/5 text-center">
              <p class="text-[9px] font-bold text-base-content/20 uppercase tracking-[0.3em]">ClyoCloud - v{{ useRuntimeConfig().public.version }}</p>
            </div>
          </div>
        </div>
        
        <!-- Bottom Links -->
        <div class="mt-8 flex items-center justify-center gap-6 opacity-30">
           <a href="#" class="text-[9px] font-bold uppercase tracking-widest hover:text-primary transition-colors">Privacy</a>
           <div class="w-1 h-1 rounded-full bg-base-content/20"></div>
           <a href="#" class="text-[9px] font-bold uppercase tracking-widest hover:text-primary transition-colors">Terms</a>
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
const totpCode = ref('')
const error = ref('')
const isLoading = ref(false)
const requires2fa = ref(false)
const tempToken = ref('')
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

    if (response.requires2fa) {
      requires2fa.value = true
      tempToken.value = response.tempToken
      createNotification("Two-Factor Authentication required", NotificationType.INFO)
    } else {
      const token = response.token;
      const cookie = useCookie('token', { maxAge: 60 * 60 * 24 * 30 });
      cookie.value = token;
      createNotification("Logged in successfully", NotificationType.SUCCESS)
      router.push('/files');
    }
  } catch (err: any) {
    error.value = err.data?.message || 'Invalid credentials'
    createNotification(error.value, NotificationType.ERROR)
  } finally {
    isLoading.value = false
  }
}

const verify2fa = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const response: any = await $fetch('/api/2fa/verify-login', {
      method: 'POST',
      body: {
        tempToken: tempToken.value,
        code: totpCode.value,
      }
    });

    const token = response.token;
    const cookie = useCookie('token', { maxAge: 60 * 60 * 24 * 30 });
    cookie.value = token;
    createNotification("Logged in successfully", NotificationType.SUCCESS)
    router.push('/files');
  } catch (err: any) {
    error.value = err.data?.message || 'Invalid code'
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
