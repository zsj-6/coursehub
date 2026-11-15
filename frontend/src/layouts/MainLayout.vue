<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
</script>

<template>
  <AppHeader />
  <main class="main page-container">
    <router-view />
  </main>
</template>

<style scoped>
.main {
  padding-top: 24px;
  padding-bottom: 48px;
}
</style>
