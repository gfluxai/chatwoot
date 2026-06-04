<script setup>
import { ref } from 'vue';
import { onMounted, onUnmounted } from 'vue';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { useRouter } from 'vue-router';
import { useAccount } from 'dashboard/composables/useAccount';
import { frontendURL } from 'dashboard/helper/URLHelper';

const router = useRouter();
const { accountId } = useAccount();
const handoffs = ref([]);

const playHandoffSound = () => {
  const audio = new Audio('/audio/handoff-alert.mp3');
  audio.volume = 1.0;
  audio.play().catch(() => {});
};

const dismiss = id => {
  handoffs.value = handoffs.value.filter(h => h.id !== id);
};

const openConversation = (id, conversationId) => {
  dismiss(id);
  if (!conversationId || !accountId.value) return;
  router.push(frontendURL(`accounts/${accountId.value}/conversations/${conversationId}`));
};

const onHandoff = payload => {
  handoffs.value.push({ ...payload, key: Date.now() });
  playHandoffSound();
};

onMounted(() => emitter.on(BUS_EVENTS.TABLO_HUMAN_HANDOFF, onHandoff));
onUnmounted(() => emitter.off(BUS_EVENTS.TABLO_HUMAN_HANDOFF, onHandoff));
</script>

<template>
  <div
    v-if="handoffs.length"
    class="fixed bottom-4 right-4 z-[9991] flex flex-col gap-2 w-80"
  >
    <div
      v-for="h in handoffs"
      :key="h.key"
      class="bg-white dark:bg-slate-800 border-2 border-yellow-400 rounded-lg shadow-xl p-4"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-slate-800 dark:text-slate-100 text-sm">
            🤖 Redirecionamento para humano
          </p>
          <p class="text-slate-600 dark:text-slate-300 text-sm mt-1 font-medium">
            {{ h.telefone }}
          </p>
          <p
            v-if="h.reason"
            class="text-slate-500 dark:text-slate-400 text-xs mt-1"
          >
            {{ h.reason }}
          </p>
        </div>
        <button
          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 text-lg leading-none"
          @click="dismiss(h.id)"
        >
          ✕
        </button>
      </div>
      <div class="mt-3 flex gap-2">
        <button
          v-if="h.conversationId"
          class="flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-xs font-semibold py-2 px-3 rounded-md transition-colors"
          @click="openConversation(h.id, h.conversationId)"
        >
          Abrir conversa
        </button>
        <button
          class="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold py-2 px-3 rounded-md transition-colors"
          @click="dismiss(h.id)"
        >
          Dispensar
        </button>
      </div>
      </div>
    </div>
  </div>
</template>
