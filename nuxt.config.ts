import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss()
    ],
  },

  modules: [
    //'@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    '@nuxt/ui'
  ],

  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'orientation', content: 'portrait' }
      ]
    }
  },

  runtimeConfig: {
    tram: {
      url: 'https://opendata.tram.cat/api/v1/',
      clientId: 'neilagaliza1@gmail.com',
      clientSecret: process.env.TRAM_SECRET
    },  
    metro: {
      url: 'https://api.tmb.cat/v1/imetro',
      appId: '5ceb8a77',
      appKey: process.env.METRO_API_KEY
    }
  },
})