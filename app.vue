<template>
  <div>
    <OrientationBlocker>
      <NuxtRouteAnnouncer />
    </OrientationBlocker>
  </div>
  <NuxtPage :key="$route.fullPath" />
</template>
<script setup lang="ts">
import OrientationBlocker from "~/OrientationBlocker.vue";
import { useRoute } from 'vue-router';

const route = useRoute();
</script>