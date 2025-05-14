<template>
  <div>
    <NuxtRouteAnnouncer />
    <OrientationBlocker>
      <NuxtRouteAnnouncer />
      <NuxtPage />
    </OrientationBlocker>
  </div>
  <NuxtPage />
</template>
<script setup lang="ts">
import OrientationBlocker from "~/OrientationBlocker.vue";
</script>