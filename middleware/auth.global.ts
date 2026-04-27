import { defineNuxtRouteMiddleware, navigateTo, useState } from 'nuxt/app'

export default defineNuxtRouteMiddleware(async (to, from) => {
    const token = useCookie('token')

    const user = useState<{ name: string } | null>('user', () => null)

    if (to.path === '/login' || to.path.startsWith('/p/')) return

    if (!token.value) {
        return navigateTo('/login')
    }

    try {
        const response = await $fetch('/api/verify', {
            method: 'GET',
            headers: {
                Cookie: `token=${token.value}`,
            },
        })

        user.value = response.user
    } catch (error: any) {
        // If it's a 401 and not on login, it might be a partial token or invalid
        if (to.path !== '/login') {
            console.error('Token verification failed:', error)
            // Only clear if it's not a 2FA required error (to keep the tempToken for login.vue)
            if (error.data?.statusMessage !== 'Unauthorized: 2FA required') {
                token.value = null
                user.value = null
                return navigateTo('/login')
            }
        }
    }
})