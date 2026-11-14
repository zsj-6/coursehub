<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
</script>

<template>
  <AppHeader />
  <main class="main">
    <router-view />
  </main>
</template>

<style scoped>
.main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 24px 40px;
}
@media (max-width: 640px) {
  .main {
    padding: 16px;
  }
}
</style>
