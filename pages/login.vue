<!-- pages/login.vue -->
<template>
  <div class="min-h-screen bg-base-200 flex items-center justify-center" data-theme="onedev">
    <div class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl font-bold text-center">Clyo Cloud Login</h2>
        <form @submit.prevent="login">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Username</span>
            </label>
            <input
                v-model="username"
                type="text"
                placeholder="Username"
                class="input input-bordered w-full"
                required
            />
          </div>
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Password</span>
            </label>
            <input
                v-model="password"
                type="password"
                placeholder="Password"
                class="input input-bordered w-full"
                required
            />
          </div>
          <div v-if="error" class="text-error text-sm mt-2">{{ error }}</div>
          <div class="form-control mt-6">
            <button type="submit" class="btn btn-primary" :class="{ 'loading': isLoading }">
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {createNotification} from "~/core/notificationManager";
import {NotificationType} from "~/types/Notification";

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
    console.log(response);

    const token = response.token;
    const cookie = useCookie('token');
    cookie.value = token;
    await createNotification("Logged in successfully", NotificationType.SUCCESS)
    await router.push('/files');
  } catch (error: any) {
    await createNotification(error.response?.data?.message || 'An error occurred', NotificationType.ERROR)
  }
}
</script>



