<!-- pages/login.vue -->
<template>
  <div class="min-h-screen bg-base-100 font-sans flex flex-col">
    <header class="h-header border-b border-line">
      <div class="page-wrap h-full flex items-center">
        <span class="text-[15px] font-semibold text-fg tracking-section">ClyoCloud</span>
      </div>
    </header>

    <main class="flex-1 flex items-start sm:items-center justify-center px-4 py-16">
      <div class="w-full max-w-[380px]">
        <h1 class="page-title mb-2">{{ requires2fa ? 'Verify it’s you' : 'Sign in' }}</h1>
        <p class="text-fg-2 mb-10">
          {{ requires2fa ? 'Enter the code from your authenticator app.' : 'Use your ClyoCloud account.' }}
        </p>

        <form v-if="!requires2fa" @submit.prevent="login" class="space-y-5">
          <div>
            <label for="login-username" class="block text-[13px] text-fg-2 mb-1.5">Username</label>
            <input
              id="login-username"
              v-model="username"
              type="text"
              autocomplete="username"
              class="input w-full"
              required
            />
          </div>

          <div>
            <label for="login-password" class="block text-[13px] text-fg-2 mb-1.5">Password</label>
            <input
              id="login-password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="input w-full"
              required
            />
          </div>

          <p v-if="error" class="flex items-center gap-2 text-[13px] text-fg" role="alert">
            <span class="dot text-error"></span>{{ error }}
          </p>

          <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
            <span v-if="isLoading" class="loading loading-spinner loading-xs"></span>
            <span v-else>Sign in</span>
          </button>
        </form>

        <form v-else @submit.prevent="verify2fa" class="space-y-5">
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="login-code" class="text-[13px] text-fg-2">
                {{ isRecoveryMode ? 'Recovery code' : '6-digit code' }}
              </label>
              <button
                type="button"
                class="text-[13px] text-fg-2 hover:text-fg underline underline-offset-4 decoration-line-strong transition-colors"
                @click="isRecoveryMode = !isRecoveryMode; totpCode = ''; error = ''"
              >
                {{ isRecoveryMode ? 'Use authenticator app' : 'Use a recovery code' }}
              </button>
            </div>
            <input
              id="login-code"
              v-model="totpCode"
              type="text"
              inputmode="text"
              autocomplete="one-time-code"
              :placeholder="isRecoveryMode ? 'XXXX-XXXX' : '000000'"
              class="input w-full num text-center text-lg tracking-[0.2em]"
              required
              :maxlength="isRecoveryMode ? 12 : 6"
              autofocus
            />
          </div>

          <p v-if="error" class="flex items-center gap-2 text-[13px] text-fg" role="alert">
            <span class="dot text-error"></span>{{ error }}
          </p>

          <div class="flex flex-col gap-2">
            <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
              <span v-if="isLoading" class="loading loading-spinner loading-xs"></span>
              <span v-else>Verify</span>
            </button>
            <button type="button" @click="requires2fa = false" class="btn btn-ghost w-full" :disabled="isLoading">
              Back to sign in
            </button>
          </div>
        </form>
      </div>
    </main>

    <footer class="border-t border-line">
      <div class="page-wrap py-4 text-[13px] text-fg-3">
        ClyoCloud <span class="num">v{{ useRuntimeConfig().public.version }}</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

useHead({
  title: 'Login'
})
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
const isRecoveryMode = ref(false)
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
