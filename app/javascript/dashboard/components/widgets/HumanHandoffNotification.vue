<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { useAccount } from 'dashboard/composables/useAccount';
import { frontendURL } from 'dashboard/helper/URLHelper';
import Button from 'dashboard/components-next/button/Button.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';

const router = useRouter();
const { accountId } = useAccount();
const queue = ref([]);

const current = computed(() => queue.value[0] ?? null);

const playHandoffSound = () => {
  const audio = new Audio('/audio/handoff-alert.mp3');
  audio.volume = 1.0;
  audio.play().catch(() => {});
};

const dismiss = () => {
  queue.value.shift();
};

const openConversation = () => {
  const item = current.value;
  dismiss();
  if (!item?.conversationId || !accountId.value) return;
  router.push(
    frontendURL(
      `accounts/${accountId.value}/conversations/${item.conversationId}`
    )
  );
};

const onHandoff = payload => {
  queue.value.push(payload);
  playHandoffSound();
};

onMounted(() => emitter.on(BUS_EVENTS.HUMAN_HANDOFF, onHandoff));
onUnmounted(() => emitter.off(BUS_EVENTS.HUMAN_HANDOFF, onHandoff));
</script>

<!-- eslint-disable vue/no-bare-strings-in-template -->
<template>
  <div
    v-show="current"
    class="fixed inset-0 z-[99999] flex items-center justify-center bg-n-alpha-black2 backdrop-blur-[4px]"
  >
    <div
      class="flex flex-col items-center gap-3 w-full max-w-sm m-4 p-6 rounded-xl border border-n-amber-9 bg-n-alpha-3 backdrop-blur-[100px] shadow-xl text-center"
    >
      <div
        class="flex items-center justify-center h-14 w-14 rounded-full bg-n-amber-9 text-white"
      >
        <Icon icon="i-lucide-headset" class="size-7" />
      </div>

      <p class="m-0 text-base font-semibold text-n-slate-12">
        Nova solicitação de atendimento humano!
      </p>

      <p v-if="current?.contactName" class="m-0 text-sm text-n-slate-11">
        {{ current.contactName }}
      </p>
      <p v-if="current?.telefone" class="m-0 text-sm text-n-slate-11">
        {{ current.telefone }}
      </p>
      <p v-if="current?.reason" class="m-0 text-xs text-n-slate-11">
        {{ current.reason }}
      </p>

      <p v-if="queue.length > 1" class="m-0 text-xs text-n-amber-9">
        +{{ queue.length - 1 }}
        {{ queue.length > 2 ? 'solicitações' : 'solicitação' }} na fila
      </p>

      <div class="flex gap-3 w-full">
        <Button
          variant="faded"
          color="slate"
          label="Dispensar"
          class="w-full"
          @click="dismiss"
        />
        <Button
          v-if="current?.conversationId"
          color="amber"
          label="Abrir conversa"
          class="w-full"
          @click="openConversation"
        />
      </div>
    </div>
  </div>
</template>
