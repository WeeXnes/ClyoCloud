// Design tokens live in assets/css/main.css (--bg, --surface, --text, ...).
// The DaisyUI themes below map onto the same values so daisy components follow them.
const tokenColor = (name) => `var(--${name})`

const shared = {
    '--rounded-box': '12px',
    '--rounded-btn': '9999px',
    '--rounded-badge': '6px',
    '--animation-btn': '0',
    '--animation-input': '0',
    '--btn-focus-scale': '1',
    '--border-btn': '1px',
    '--tab-border': '1px',
    '--tab-radius': '9999px',
}

module.exports = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Geist Variable"', 'system-ui', 'sans-serif'],
                mono: ['"Geist Mono Variable"', 'ui-monospace', 'monospace'],
            },
            colors: {
                bg: tokenColor('bg'),
                surface: tokenColor('surface'),
                'surface-2': tokenColor('surface-2'),
                line: tokenColor('line'),
                'line-strong': tokenColor('line-strong'),
                fg: tokenColor('text'),
                'fg-2': tokenColor('text-2'),
                'fg-3': tokenColor('text-3'),
                invert: tokenColor('invert'),
                'on-invert': tokenColor('on-invert'),
            },
            letterSpacing: {
                micro: '0.08em',
                title: '-0.03em',
                section: '-0.01em',
            },
            maxWidth: {
                content: '1120px',
                form: '640px',
            },
            height: {
                header: '60px',
            },
        },
    },
    plugins: [
        require('daisyui'),
        require("@tailwindcss/typography")
    ],
    daisyui: {
        // Two themes only: Dark (default) and Light, a straight inversion of the same design.
        themes: [
            {
                dark: {
                    ...shared,
                    'color-scheme': 'dark',
                    'base-100': '#000000',
                    'base-200': '#0a0a0a',
                    'base-300': '#141414',
                    'base-content': '#fafafa',
                    'primary': '#fafafa',
                    'primary-content': '#000000',
                    'secondary': '#a3a3a3',
                    'secondary-content': '#000000',
                    'accent': '#fafafa',
                    'accent-content': '#000000',
                    'neutral': '#141414',
                    'neutral-content': '#fafafa',
                    'info': '#a3a3a3',
                    'info-content': '#000000',
                    'success': '#4ade80',
                    'success-content': '#000000',
                    'warning': '#fbbf24',
                    'warning-content': '#000000',
                    'error': '#f87171',
                    'error-content': '#000000',
                },
            },
            {
                light: {
                    ...shared,
                    'color-scheme': 'light',
                    'base-100': '#ffffff',
                    'base-200': '#fafafa',
                    'base-300': '#f0f0f0',
                    'base-content': '#0a0a0a',
                    'primary': '#0a0a0a',
                    'primary-content': '#ffffff',
                    'secondary': '#525252',
                    'secondary-content': '#ffffff',
                    'accent': '#0a0a0a',
                    'accent-content': '#ffffff',
                    'neutral': '#f0f0f0',
                    'neutral-content': '#0a0a0a',
                    'info': '#525252',
                    'info-content': '#ffffff',
                    'success': '#15803d',
                    'success-content': '#ffffff',
                    'warning': '#a16207',
                    'warning-content': '#ffffff',
                    'error': '#b91c1c',
                    'error-content': '#ffffff',
                },
            },
        ],
        darkTheme: 'dark',
    }
};
