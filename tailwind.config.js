module.exports = {
    plugins: [
        require('daisyui'),
        require("@tailwindcss/typography")
    ],
    daisyui: {
        themes: [
            'light',
            'dark',
            'dracula',
            'forest',
            {
                onedev: {
                    'color-scheme': 'dark',

                    'base-100': 'oklch(25% 0.01 280)',   // Very dark gray, slight purple hue
                    'base-200': 'oklch(22% 0.01 280)',   // Slightly darker
                    'base-300': 'oklch(18% 0.008 280)',  // Even darker
                    'base-content': 'oklch(85% 0 0)',    // High contrast white/near-white for readability

                    'primary': 'oklch(70% 0.19 260)',    // Vibrant purple-blue (like accent in OneDev)
                    'primary-content': 'oklch(0% 0 0)',

                    'secondary': 'oklch(72% 0.15 240)',  // Cyan-like for hover/highlights
                    'secondary-content': 'oklch(10% 0 0)',

                    'accent': 'oklch(68% 0.18 280)',     // Purple, leans more magenta for buttons, toggles
                    'accent-content': 'oklch(10% 0 0)',

                    'neutral': 'oklch(32% 0.02 280)',    // Soft gray-purple for panels
                    'neutral-content': 'oklch(85% 0 0)',

                    'info': 'oklch(75% 0.18 250)',       // Vibrant blue-cyan
                    'info-content': 'oklch(0% 0 0)',
                    'success': 'oklch(70% 0.15 160)',    // Green (standard success)
                    'success-content': 'oklch(0% 0 0)',
                    'warning': 'oklch(85% 0.2 90)',      // Yellow/orange for warnings
                    'warning-content': 'oklch(0% 0 0)',
                    'error': 'oklch(75% 0.23 20)',       // Red for errors
                    'error-content': 'oklch(0% 0 0)',
                },
            }
        ]
    }
};
