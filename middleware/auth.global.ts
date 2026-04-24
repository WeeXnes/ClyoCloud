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
    } catch (error) {
        console.error('Token verification failed:', error)
        token.value = null
        user.value = null
        return navigateTo('/login')
    }
})